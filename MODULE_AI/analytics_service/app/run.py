import json
import logging

from pydantic import ValidationError

from app.config import settings
from app.communication.redis_consumer import RedisConsumer
from app.communication.redis_producer import RedisProducer
from app.communication.event_dispatcher import EventDispatcher
from app.core.analyzer_registry import CameraAnalyzerRegistry
from app.utils.zone_provider import ZoneProvider
from app.processor import process_event
from app.schemas.tracking_event import TrackingEventSchema

logger = logging.getLogger("AnalyticsService")


def run_analytics():
    consumer = RedisConsumer(
        stream=settings.REDIS_INPUT_STREAM,
        group=settings.REDIS_INPUT_GROUP,
        consumer_name=settings.REDIS_INPUT_CONSUMER,
    )
    producer = RedisProducer()
    dispatcher = EventDispatcher(
        producer,
        zone_stream=settings.REDIS_ZONE_EVENT_STREAM,
        dwell_stream=settings.REDIS_DWELL_EVENT_STREAM,
        dwell_ping_stream=settings.REDIS_DWELL_PING_STREAM,
        heatmap_stream=settings.REDIS_HEATMAP_STREAM,
        heatmap_interval_sec=settings.HEATMAP_PUBLISH_INTERVAL_SEC,
    )
    zone_provider = ZoneProvider()
    registry = CameraAnalyzerRegistry(
        zone_provider,
        default_w=settings.DEFAULT_FRAME_WIDTH,
        default_h=settings.DEFAULT_FRAME_HEIGHT,
        dwell_iou_threshold=settings.DWELL_IOU_THRESHOLD,
        dwell_time_threshold_sec=settings.DWELL_TIME_THRESHOLD_SEC,
        ping_threshold=settings.DWELL_PING_ALERT_THRESHOLD_SEC,
    )

    logger.info(f"Analytics Service listening on Redis Stream: {settings.REDIS_INPUT_STREAM}")

    while True:
        for message_id, raw_payload in consumer.read():
            if not raw_payload:
                consumer.ack(message_id)
                continue
            try:
                event = TrackingEventSchema.model_validate_json(raw_payload)
                process_event(event, registry, dispatcher)
                consumer.ack(message_id)
            except (ValidationError, json.JSONDecodeError) as e:
                logger.error(f"Invalid tracking event, skipping: {e}")
                consumer.ack(message_id)
            except Exception as e:
                logger.error(f"Error processing message {message_id}: {e}")

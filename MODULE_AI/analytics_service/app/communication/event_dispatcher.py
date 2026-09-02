import time

from app.communication.redis_producer import RedisProducer
from app.schemas.analytics_event import ZoneEventPayload, DwellEventPayload, HeatmapEventPayload


class EventDispatcher:
    def __init__(
        self,
        producer: RedisProducer,
        zone_stream: str,
        dwell_stream: str,
        dwell_ping_stream: str,
        heatmap_stream: str,
        heatmap_interval_sec: float,
    ):
        self._producer = producer
        self._zone_stream = zone_stream
        self._dwell_stream = dwell_stream
        self._dwell_ping_stream = dwell_ping_stream
        self._heatmap_stream = heatmap_stream
        self._heatmap_interval_sec = heatmap_interval_sec
        self._last_sent: dict[tuple[str, str], float] = {}

    def dispatch(self, event) -> None:
        if isinstance(event, ZoneEventPayload):
            self._producer.publish(self._zone_stream, event.model_dump())
        elif isinstance(event, DwellEventPayload):
            if event.event_type == "dwell_ping":
                self._producer.publish(self._dwell_ping_stream, event.model_dump())
            else:
                self._producer.publish(self._dwell_stream, event.model_dump())
        elif isinstance(event, HeatmapEventPayload):
            self._dispatch_heatmap(event)
        else:
            raise TypeError(f"EventDispatcher: unknown event payload type: {type(event)!r}")

    def _dispatch_heatmap(self, event: HeatmapEventPayload) -> None:
        key = (event.event_type, event.camera_id)
        now = time.monotonic()
        last = self._last_sent.get(key, 0.0)
        if now - last < self._heatmap_interval_sec:
            return
        self._last_sent[key] = now
        self._producer.publish(self._heatmap_stream, event.model_dump())

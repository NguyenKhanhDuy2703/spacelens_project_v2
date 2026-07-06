import logging
import json
import time
from app.config import settings
from app.core.redis import redis_client
from app.core.zone_analysis import ZoneAnalysis
from app.core.dwelltime_analysis import DwellTimeAnalysis
from app.core.heatmap_analysis import HeatmapAnalysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AnalyticsService")

def run_analytics():
    stream_name = "tracking_events"
    group_name = "analytics_group"
    consumer_name = "consumer-1"

    # 1. Create Consumer Group if it doesn't exist
    try:
        redis_client.xgroup_create(stream_name, group_name, id="0", mkstream=True)
        logger.info(f"Created consumer group {group_name} for stream {stream_name}")
    except Exception:
        pass # Group probably already exists

    logger.info(f"Listening to Redis Stream: {stream_name} as {consumer_name}")
    
    # Initialize Business Logic Modules
    # Here you would load actual zone polygons from DB or settings
    zone_analyzer = ZoneAnalysis(zones=[]) 
    dwell_analyzer = DwellTimeAnalysis()
    heatmap_analyzer = HeatmapAnalysis()

    logger.info("Analytics Service is waiting for tracking data...")

    while True:
        # Read from stream blockingly for 500ms
        messages = redis_client.xreadgroup(group_name, consumer_name, {stream_name: ">"}, count=1, block=500)
        
        if not messages:
            continue
            
        for stream, message_list in messages:
            for message_id, data in message_list:
                try:
                    # decode_responses=False means keys and values are bytes
                    raw_payload = data.get(b'payload') or data.get('payload')
                    if not raw_payload:
                        redis_client.xack(stream_name, group_name, message_id)
                        continue
                        
                    payload = json.loads(raw_payload)
                    # Payload could contain: camera_id, timestamp, tracks (id, bbox, etc.)
                    
                    # 1. Zone Analysis
                    # zone_events = zone_analyzer.analyze(payload)
                    
                    # 2. Dwell Time Analysis
                    # dwell_events = dwell_analyzer.update_dwell_time(payload)
                    
                    # 3. Heatmap Analysis
                    # heatmap_analyzer.update_grid_cell(payload)
                    
                    # Further dispatch analyzed events to Backend via another Redis channel
                    
                    logger.debug(f"Processed tracking payload from camera: {payload.get('camera_id')}")
                    
                    # ACK the message so it is removed from Pending list
                    redis_client.xack(stream_name, group_name, message_id)

                except json.JSONDecodeError:
                    logger.error("Failed to decode message.")
                    redis_client.xack(stream_name, group_name, message_id)
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")

if __name__ == "__main__":
    while True:
        try:
            run_analytics()
        except Exception as e:
            logger.error(f"Redis connection dropped, reconnecting in 5s... Error: {e}")
            time.sleep(5)

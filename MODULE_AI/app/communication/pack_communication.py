import time
from app.communication.redis_publish import RedisPublisher
class PackCommunication:
    def __init__(self):
        self.time_send_payload = {
            "tracking": 10.0,
            "dwell_time": 10.0,
            "heatmap": 20.0,
            "zone_analysis": 1.0,
            "zone_analysis_event": 10.0,
        }
        self.last_sent = {
                "heatmap": time.time(),
                "zone_analysis": time.time(),
                "tracking": time.time(),
                "zone_analysis_event": time.time(),
                "dwell_time": time.time(),
            }
        self.current_tracking = {}
        self.redis_publisher = RedisPublisher()
        self.event_person_in_zone = {}
    
    def dispatch_payload(self , payload_data):
        now = time.time()
        for data in payload_data:
            match data["type"]:
                case "tracking":
                    pass
                case "dwell_time":
                    # Không throttle — finished_events chỉ xuất hiện khi người dừng xong,
                    # không spam như heatmap. Throttle sẽ làm mất data do clear() sau dispatch.
                    self.redis_publisher.publish("dwell_time_channel", message={"data": data["data"], "infor": data["info"]})
                case "heatmap":
                    if now - self.last_sent["heatmap"] >= self.time_send_payload["heatmap"]:
                        payload_data = data["data"]() if callable(data["data"]) else data["data"]
                        self.redis_publisher.publish("heatmap_channel", message={"data": payload_data, "infor": data["info"]})
                        self.last_sent["heatmap"] = now
                case "zone_analysis":
                    if now - self.last_sent["zone_analysis"] >= self.time_send_payload["zone_analysis"]:
                        self.redis_publisher.publish("zone_analysis_channel", message= {"data": data["data"] ,"infor": data["info"]})
                        self.last_sent["zone_analysis"] = now
                case "zone_analysis_event":
                    # Không throttle — Đây là sự kiện độc lập khi người dùng vào/ra/chuyển zone.
                    # Throttle sẽ làm mất event ENTRY -> không tạo Session -> Total Visitors bị đếm thiếu trầm trọng.
                    self.redis_publisher.publish("zone_analysis_event_channel", message={"data": data["data"], "infor": data["info"]})
                case "dwell_time_realtime":
                    self.redis_publisher.publish("dwell_time_realtime_channel",message= {"data": data["data"] ,"infor": data["info"]})
                case _:
                    pass
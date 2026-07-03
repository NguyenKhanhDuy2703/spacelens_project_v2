import json
from app.config import settings_dev
from app.core.redis import redis_client
class RedisPublisher:
    def __init__(self):
        self.redis_client = redis_client
    def publish(self, channel: str, message: dict):
        try:
            self.redis_client.lpush(channel, json.dumps(message, ensure_ascii=False))
        except Exception as e:
            raise Exception(f"Error publishing to Redis: {str(e)}")
   
    
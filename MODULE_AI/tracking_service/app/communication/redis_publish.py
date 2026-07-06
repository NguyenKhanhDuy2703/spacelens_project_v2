import json
from app.config import settings
from app.core.redis import redis_client

class RedisPublisher:
    def __init__(self):
        self.redis_client = redis_client
        self.max_queue_len = 100  # Cap the queue size to prevent memory leaks

    def publish(self, channel: str, message: dict):
        try:
            payload = json.dumps(message, ensure_ascii=False)

            message_id = self.redis_client.xadd(
                name=channel, 
                fields={"payload": payload}, 
                maxlen=self.max_queue_len
            )
            return message_id
        except Exception as e:
            raise RuntimeError(f"Error publishing to Redis: {str(e)}")
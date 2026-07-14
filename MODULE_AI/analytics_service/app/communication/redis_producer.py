import json
from app.core.redis import redis_client


class RedisProducer:
    def __init__(self, max_queue_len: int = 1000):
        self.redis_client = redis_client
        self.max_queue_len = max_queue_len

    def publish(self, stream_name: str, message: dict):
        try:
            payload = json.dumps(message, ensure_ascii=False)
            print("payload : " , payload)
            return self.redis_client.xadd(
                name=stream_name,
                fields={"payload": payload},
                maxlen=self.max_queue_len,
            )
        except Exception as e:
            raise RuntimeError(f"Error publishing to Redis stream '{stream_name}': {str(e)}")

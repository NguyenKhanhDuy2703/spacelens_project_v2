import logging
from app.core.redis import redis_client

logger = logging.getLogger("AnalyticsService.RedisConsumer")


class RedisConsumer:
    def __init__(self, stream: str, group: str, consumer_name: str, block_ms: int = 500, count: int = 1):
        self.redis_client = redis_client
        self.stream = stream
        self.group = group
        self.consumer_name = consumer_name
        self.block_ms = block_ms  
        self.count = count
        self._ensure_group()

    def _ensure_group(self):
        try:
            self.redis_client.xgroup_create(self.stream, self.group, id="0", mkstream=True)
            logger.info(f"Created consumer group {self.group} for stream {self.stream}")
        except Exception:
            pass  # Group probably already exists

    def read(self):
        """Yield (message_id, raw_payload_bytes) for each pending message. Blocking read."""
        messages = self.redis_client.xreadgroup(
            self.group, self.consumer_name, {self.stream: ">"}, count=self.count, block=self.block_ms
        )
        if not messages:
            return
        for _stream, message_list in messages:
            for message_id, data in message_list:
                raw_payload = data.get(b"payload") or data.get("payload")
                yield message_id, raw_payload

    def ack(self, message_id):
        self.redis_client.xack(self.stream, self.group, message_id)

import redis
from app.config import settings_dev

class RedisManager:
    _shared_pool = None

    @classmethod
    def get_pool(cls):
        if cls._shared_pool is None:
            cls._shared_pool = redis.ConnectionPool(
                host=settings_dev.REDIS_HOST,
                port=settings_dev.REDIS_PORT,
                db=0,
                max_connections=10 
            )
        return cls._shared_pool

    @classmethod
    def get_bytes_client(cls):
        return redis.Redis(connection_pool=cls.get_pool(), decode_responses=False)
    @classmethod
    def get_text_client(cls):
        return redis.Redis(connection_pool=cls.get_pool(), decode_responses=True)

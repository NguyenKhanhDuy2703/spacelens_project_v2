from redis import Redis, ConnectionPool
from app.config import settings

redis_pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=False)

redis_client = Redis(connection_pool=redis_pool)

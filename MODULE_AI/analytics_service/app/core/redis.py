from redis import Redis, ConnectionPool
from app.config import settings

# Create a connection pool to avoid creating new connections on every request
redis_pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=False)

# Global redis client using the pool
redis_client = Redis(connection_pool=redis_pool)

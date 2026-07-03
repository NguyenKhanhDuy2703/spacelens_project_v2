from redis import Redis
from app.config import settings_dev

redis_client = Redis(
    host=settings_dev.REDIS_HOST,
    port=settings_dev.REDIS_PORT,
    db=0,
    decode_responses=False,
)

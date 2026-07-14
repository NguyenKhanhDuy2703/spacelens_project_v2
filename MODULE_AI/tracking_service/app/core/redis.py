from redis import Redis, ConnectionPool
from app.config import settings
import numpy as np
import json

redis_pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=False)

redis_client = Redis(connection_pool=redis_pool)

def get_all_reid_vectors(camera_id: str) -> dict:
    key = f"camera:{camera_id}:vectors"
    raw_data = redis_client.hgetall(key)
    vectors = {}
    for k, v in raw_data.items():
        # k and v are bytes because decode_responses=False
        track_id = k.decode('utf-8') if isinstance(k, bytes) else k
        try:
            vec_list = json.loads(v.decode('utf-8') if isinstance(v, bytes) else v)
            vectors[track_id] = np.array(vec_list, dtype=np.float32)
        except Exception:
            continue
    return vectors

def save_reid_vector(camera_id: str, final_track_id: str, vector: np.ndarray):
    key = f"camera:{camera_id}:vectors"
    vec_list = vector.tolist()
    redis_client.hset(key, final_track_id, json.dumps(vec_list))
    redis_client.expire(key, settings.REDIS_EXPIRE_TIME)

def refresh_ttl(camera_id: str):
    key = f"camera:{camera_id}:vectors"
    redis_client.expire(key, settings.REDIS_EXPIRE_TIME)

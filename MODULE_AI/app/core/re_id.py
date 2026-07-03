from app.core.redis import redis_client
import numpy as np
from scipy.spatial.distance import cosine

class Re_ID:
    def __init__(self):
        self.redis_client = redis_client
        self.threshold = 0.2
    # ham chuan hoa vector và kiêm tra kiểu dữ liệu, đảm bảo là numpy array có dtype float32
    def _prepare_vector(self, feature):
        if not isinstance(feature, np.ndarray):
            feature = np.array(feature, dtype=np.float32)
        return feature.astype(np.float32) if feature.dtype != np.float32 else feature
    # hàm lưu trữ feature vào redis 
    def store_re_id_feature(self, final_id, feature_vector, camera_id=None):
        try:
            feature_vector = self._prepare_vector(feature_vector)
            hash_name = f"re_id_feature:{camera_id}" if camera_id else "re_id_feature"
            
            self.redis_client.hset(
                name=hash_name,
                key=str(final_id),
                value=feature_vector.tobytes()
            )
            self.redis_client.expire(hash_name, 3600) 
        except Exception as e:
            raise Exception(f"Error storing feature: {str(e)}")
    #ham tao mapping giữa deepsort_id và final_id, 
    def check_mapping_re_id(self, current_feature, camera_id=None):
        try:
            current_feature = self._prepare_vector(current_feature)
            hash_name = f"re_id_feature:{camera_id}" if camera_id else "re_id_feature"
            
            all_features = self.redis_client.hgetall(hash_name)
            if not all_features:
                return False, None

            for tid_bytes, vec_bytes in all_features.items():
                store_vec = np.frombuffer(vec_bytes, dtype=np.float32)
                distance = cosine(current_feature, store_vec)
                
                if distance < self.threshold:
                    return True, tid_bytes.decode('utf-8')
            return False, None
        except Exception as e:
            raise Exception(f"Error checking re-ID: {str(e)}")
    # ham thêm mapping giữa deepsort_id và final_id vào redis, với key là "mapping:camera_id" và giá trị là một hash chứa deepsort_id và final_id, thời gian hết hạn là 10 phút
    def set_id_mapping(self, camera_id, deepsort_id, final_id):
        try:
            hash_name = f"mapping:{camera_id}"
            self.redis_client.hset(hash_name, str(deepsort_id), str(final_id))
            self.redis_client.expire(hash_name, 600) 
        except Exception as e:
            raise Exception(f"Error setting mapping: {str(e)}")
    # ham lấy final_id tù redis bằng deepsort_id và camera_id,
    def get_id_mapping(self, camera_id, deepsort_id):
        try:
            hash_name = f"mapping:{camera_id}"
            val = self.redis_client.hget(hash_name, str(deepsort_id))
            return val.decode('utf-8') if val else None
        except Exception as e:
            raise Exception(f"Error getting mapping: {str(e)}")
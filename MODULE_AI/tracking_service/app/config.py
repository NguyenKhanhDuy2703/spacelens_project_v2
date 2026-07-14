from pydantic_settings import BaseSettings, SettingsConfigDict
import yaml
from functools import lru_cache

class Settings(BaseSettings):
    MODULE_NAME: str = "Tracking Service" 
    VERSION: str = "1.1.2"
    APP: str = "gpu"
    
    YOLOV8_CONFIG_PATH: str = "app/configs/yolov8.config.yaml"
    BYTETRACK_CONFIG_PATH: str = "app/configs/bytetrack.config.yaml"
    
    AI_PORT: int = 8000
    RELOAD: bool = True

    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_EXPIRE_TIME: int = 3600  
    
    VIDEO_SOURCE: str = "storage/videos/video_1.mp4"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    @staticmethod
    @lru_cache(maxsize=10)
    def read_yaml_config(path: str):       
        with open(path, 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
        return config

settings = Settings()

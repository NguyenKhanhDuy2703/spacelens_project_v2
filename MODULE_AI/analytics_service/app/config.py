from pydantic_settings import BaseSettings, SettingsConfigDict
import yaml
from functools import lru_cache

class Settings(BaseSettings):
    MODULE_NAME: str = "Tracking Service" 
    VERSION: str = "1.1.2"
    APP: str = "gpu"
    
    YOLOV8_CONFIG_PATH: str = "app/configs/yolov8.config.yaml"
    BYTETRACK_CONFIG_PATH: str = "app/configs/bytetrack.config.yaml"
    
    # Port configuration from .env
    AI_PORT: int = 8000
    
    # Redis configuration from .env
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_EXPIRE_TIME: int = 3600  
    
    # Default video source (can be overridden by .env or API)
    VIDEO_SOURCE: str = "storage/videos/video_1.mp4"
    
    model_config = SettingsConfigDict(env_file="../../.env", env_file_encoding="utf-8", extra="ignore")

    @lru_cache(maxsize=10)
    def read_yaml_config(self, path: str):       
        with open(path, 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
        return config

settings = Settings()

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

    # Redis Stream consumed from tracking_service
    REDIS_INPUT_STREAM: str = "tracking_events"
    REDIS_INPUT_GROUP: str = "analytics_group"
    REDIS_INPUT_CONSUMER: str = "consumer-1"

    # Zone data source (MODULE_BE `zone` domain), fetched over HTTP + cached with TTL
    ZONE_API_URL: str = "http://localhost:3003"
    ZONE_API_TIMEOUT_SEC: float = 3.0
    ZONE_CACHE_TTL_SEC: float = 30.0

    # Redis Streams published to (consumed by MODULE_BE later)
    REDIS_ZONE_EVENT_STREAM: str = "zone_analysis_event_channel"
    REDIS_DWELL_EVENT_STREAM: str = "dwell_time_channel"
    REDIS_HEATMAP_STREAM: str = "heatmap_channel"
    REDIS_DWELL_PING_STREAM: str = "dwell_time_ping_channel" 
    HEATMAP_PUBLISH_INTERVAL_SEC: float = 5.0

    # Default frame size used until the first event reports the real resolution
    DEFAULT_FRAME_WIDTH: int = 1920
    DEFAULT_FRAME_HEIGHT: int = 1080

    # Dwell-time analyzer thresholds
    DWELL_IOU_THRESHOLD: float = 0.7
    DWELL_TIME_THRESHOLD_SEC: float = 2.0
    DWELL_PING_ALERT_THRESHOLD_SEC: float = 10.0 
    model_config = SettingsConfigDict(env_file="../../.env", env_file_encoding="utf-8", extra="ignore")

    @lru_cache(maxsize=10)
    def read_yaml_config(self, path: str):       
        with open(path, 'r', encoding='utf-8') as file:
            config = yaml.safe_load(file)
        return config

settings = Settings()

from pydantic_settings import BaseSettings
import yaml
class settings(BaseSettings):
    MODULE_NAME: str = "Module AI " 
    VERSION: str = "1.1.2"
    APP : str = "gpu"
    YOLOV8_CONFIG_PATH: str = "app/configs/yolov8.config.yaml"
    BYTETRACK_CONFIG_PATH: str = "app/configs/bytetrack.config.yaml"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_EXPIRE_TIME: int = 3600  
    def read_yaml_config (self , path):       
        with open (path, 'r' , encoding='utf-8') as file:
            config = yaml.safe_load(file)
        return config
class settings_dev(settings):
    MODULE_NAME: str = "Module AI Dev"
    VERSION: str = "1.1.2-dev"
    VIDEO_SOURCE: str = "storage/videos/video_1.mp4"
    


settings_dev = settings_dev()



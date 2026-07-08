import os
import logging
from app.config import settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

OSNET_MODEL_PATH = "weights/osnet_x1_0.onnx"


def _check_redis() -> tuple[bool, str]:
    try:
        redis_client.ping()
        return True, settings.REDIS_URL
    except Exception as e:
        return False, str(e)


def _check_yolo_model() -> tuple[bool, str]:
    try:
        yolo_cfg = settings.read_yaml_config(settings.YOLOV8_CONFIG_PATH)
        model_path = yolo_cfg["yolov8"]["model_path"]
    except Exception as e:
        return False, f"Cannot read {settings.YOLOV8_CONFIG_PATH}: {e}"
    if not os.path.exists(model_path):
        return False, f"Model path not found: {model_path}"
    return True, model_path


def _check_osnet_model() -> tuple[bool, str]:
    if not os.path.exists(OSNET_MODEL_PATH):
        return False, f"Model path not found: {OSNET_MODEL_PATH}"
    return True, OSNET_MODEL_PATH


def _print_banner(redis_ok, redis_detail, yolo_ok, yolo_detail, osnet_ok, osnet_detail) -> None:
    def line(label, ok, detail):
        status = detail if ok else f"FAIL: {detail}"
        return f" {label:<12} : {status}"

    banner = "\n".join([
        "=" * 60,
        f" Tracking Service v{settings.VERSION} starting up",
        line("Redis", redis_ok, redis_detail),
        line("YOLO model", yolo_ok, yolo_detail),
        line("OSNet model", osnet_ok, osnet_detail),
        f" Listening on : 0.0.0.0:{settings.AI_PORT}",
        "=" * 60,
    ])

    if redis_ok and yolo_ok and osnet_ok:
        logger.info("\n" + banner)
    else:
        logger.warning("\n" + banner)


def run_startup_checks() -> None:
    redis_ok, redis_detail = _check_redis()
    yolo_ok, yolo_detail = _check_yolo_model()
    osnet_ok, osnet_detail = _check_osnet_model()
    _print_banner(redis_ok, redis_detail, yolo_ok, yolo_detail, osnet_ok, osnet_detail)

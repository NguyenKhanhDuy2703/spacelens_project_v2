import logging
import time

from app.run import run_analytics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AnalyticsService")

if __name__ == "__main__":
    while True:
        try:
            run_analytics()
        except Exception as e:
            logger.error(f"Redis connection dropped, reconnecting in 5s... Error: {e}")
            time.sleep(5)

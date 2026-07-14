import uvicorn
import logging
from app.utils.logging import setup_logging
from app.config import settings

setup_logging()
logger = logging.getLogger(__name__)

def main():
    try:
        config = uvicorn.Config("app.main:app", host="0.0.0.0", port=settings.AI_PORT, reload=settings.RELOAD, log_config=None)
        server = uvicorn.Server(config)
        logger.info(f"Starting the Tracking Service server on port {settings.AI_PORT}...")
        server.run()
    except Exception as e:
        logger.error(f"Failed to start the server: {str(e)}")

if __name__ == "__main__":
    main()
import uvicorn
import logging
from app.utils.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)
def main():
    try:
        config = uvicorn.Config("app.main:app", host="0.0.0.0", port=8000, reload=True , log_config= None)
        server = uvicorn.Server(config)
        logger.info("Starting the server...")
        server.run()
    except Exception as e:
        logger.error(f"Failed to start the server: {str(e)}")
if __name__ == "__main__":
    main()
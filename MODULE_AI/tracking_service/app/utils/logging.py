import logging
import sys
from pathlib import Path

LOG_FORMAT = "%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"

def setup_logging(log_level=logging.INFO):
    Path("logs").mkdir(exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level) 

    formatter = logging.Formatter(LOG_FORMAT)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    file_handler = logging.FileHandler("logs/app.log", encoding='utf-8')
    file_handler.setFormatter(formatter)


    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        u_logger = logging.getLogger(logger_name)
        u_logger.handlers = [console_handler, file_handler]
        u_logger.propagate = False 

    logging.info("Logging system initialized successfully!")


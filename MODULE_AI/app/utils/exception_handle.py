from fastapi import status
from fastapi.responses import JSONResponse
import logging
from typing import Any, Optional
from fastapi import Request, HTTPException
class CustomException:
    def __init__(self, message: str, status_code: Any, details: Optional[Any] = None):
        self.status_code = status_code
        self.message = message
        self.details = details

    def to_dict(self) -> dict:
        return {
            "status_code": self.status_code,
            "message": self.message,
            "details": self.details
        }


async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=CustomException(
            message=str(exc.detail),
            status_code=exc.status_code,
            details=None
        ).to_dict(),
    )

async def global_exception_handler(request: Request, exc: Exception):
    logging.exception("Global Exception Caught")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=CustomException(
            message="Internal Server Error",
            status_code="INTERNAL_SERVER_ERROR",
            details=str(exc)
        ).to_dict(),
    )
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, status, HTTPException
from app.utils.exception_handle import global_exception_handler, http_exception_handler
from app.startup import run_startup_checks
from app.api.v1.tracking_router import router_tracking

@asynccontextmanager
async def lifespan(app: FastAPI):
    run_startup_checks()
    yield

app = FastAPI(
    title="AI Module API",
    description="API for AI Module",
    lifespan=lifespan,
)

app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.include_router(router_tracking)

router = APIRouter(prefix="/api/v1", tags=["health"])

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    try:
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "details": str(e)}

app.include_router(router)

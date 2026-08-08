import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db import close_db, ensure_indexes
from middleware.rate_limit import RateLimitMiddleware
from middleware.request_logging import RequestLoggingMiddleware
from routes.auth import router as auth_router
from routes.billing import admin_router, router as billing_router
from routes.interviews import router as interviews_router
from routes.reports import router as reports_router
from services.scheduler_service import start_background_scheduler
from utils.error_handlers import http_exception_handler, unhandled_exception_handler, validation_exception_handler
from fastapi import HTTPException


settings = get_settings()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    scheduler_task = asyncio.create_task(start_background_scheduler())
    yield
    scheduler_task.cancel()
    close_db()


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
allowed_origins = list(set(settings.cors_origins + [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]))

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if settings.environment == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)



@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": settings.app_name}



app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(billing_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.api_prefix)
app.include_router(interviews_router, prefix=settings.api_prefix)
app.include_router(reports_router, prefix=settings.api_prefix)


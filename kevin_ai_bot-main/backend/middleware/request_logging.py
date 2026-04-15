import logging
from time import perf_counter

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


logger = logging.getLogger("kevin_ai.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = perf_counter()
        response = await call_next(request)
        duration_ms = round((perf_counter() - start) * 1000, 2)
        client_ip = request.client.host if request.client else "unknown"
        logger.info(
            "%s %s -> %s in %sms [%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            client_ip,
        )
        response.headers["X-Response-Time-Ms"] = str(duration_ms)
        return response

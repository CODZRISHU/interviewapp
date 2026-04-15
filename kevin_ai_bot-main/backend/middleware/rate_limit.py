from collections import defaultdict, deque
from time import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config import get_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.settings = get_settings()
        self.buckets = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path.endswith("/health"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        bucket = self.buckets[client_ip]
        now = time()
        window = self.settings.rate_limit_window_seconds

        while bucket and bucket[0] <= now - window:
            bucket.popleft()

        if len(bucket) >= self.settings.rate_limit_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again shortly."},
            )

        bucket.append(now)
        return await call_next(request)

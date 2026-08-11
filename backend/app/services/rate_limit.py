"""A small in-memory rate limiter for the login endpoint.

State lives in this process, which is fine here: the whole site is one uvicorn
process on one instance. Run more than one worker and each gets its own
counters, which multiplies the effective limit by the worker count.

Restarting the container clears the counters. For a login form guarding a
personal gallery that is an acceptable trade against running Redis.
"""

import threading
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, bucket: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    def check(self, key: str) -> tuple[bool, int]:
        """Report whether `key` may try again, and how long until it can.

        Read-only: a request that is allowed through is not counted here.
        Only failures are recorded, via record_failure, so a legitimate login
        never uses up the budget.
        """
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            self._prune(bucket, now)
            if len(bucket) < self.max_attempts:
                return True, 0
            retry_after = int(self.window_seconds - (now - bucket[0])) + 1
            return False, retry_after

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            self._prune(bucket, now)
            bucket.append(now)

    def reset(self, key: str) -> None:
        """Clear a key's history after a successful login."""
        with self._lock:
            self._hits.pop(key, None)

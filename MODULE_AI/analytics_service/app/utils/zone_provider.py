import logging
import time
from typing import TypedDict

from app.api.zone_client import fetch_zones
from app.config import settings

logger = logging.getLogger(__name__)


class Zone(TypedDict):
    zone_id: str
    points: list[list[float]]


class CacheEntry(TypedDict):
    zones: list[Zone]
    fetched_at: float


class ZoneProvider:
    def __init__(self):
        self._cache: dict[str, CacheEntry] = {}

    def get_zones(self, camera_id: str) -> list[Zone]:
        entry = self._cache.get(camera_id)
        if entry is None or time.time() - entry["fetched_at"] > settings.ZONE_CACHE_TTL_SEC:
            self._refresh(camera_id, stale_entry=entry)
        return self._cache[camera_id]["zones"]

    def _refresh(self, camera_id: str, stale_entry: CacheEntry | None) -> None:
        try:
            zones = fetch_zones(camera_id)
            self._cache[camera_id] = {"zones": zones, "fetched_at": time.time()}
        except Exception as e:
            logger.error(f"Failed to refresh zones for {camera_id}: {e}")
            if stale_entry is not None:
                self._cache[camera_id] = {**stale_entry, "fetched_at": time.time()}
            else:
                self._cache[camera_id] = {"zones": [], "fetched_at": time.time()}

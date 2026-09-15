import httpx

from app.config import settings


def fetch_zones(camera_id: str) -> list[dict]:
    response = httpx.get(
        f"{settings.ZONE_API_URL}/zones",
        params={"camera_id": camera_id},
        timeout=settings.ZONE_API_TIMEOUT_SEC,
    )
    response.raise_for_status()
    return response.json()

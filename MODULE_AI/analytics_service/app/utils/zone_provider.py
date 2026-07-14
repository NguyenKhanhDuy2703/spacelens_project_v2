class ZoneProvider:
    """Nguồn zone tạm thời — hardcode.

    Interface get_zones(camera_id) giữ ổn định để sau này thay bằng HTTPZoneProvider
    gọi MODULE_BE (domain camera/zone) mà KHÔNG cần đổi code gọi ở AnalyzerRegistry.
    Xem .temps/zone_polygon_source_analysis.md và .temps/analytics_zone_fetch_design.md
    cho quyết định kiến trúc dài hạn (BE-owns-zone qua Database).
    """

    _HARDCODED_ZONES: dict[str, list[dict]] = {
        "cam_01": [
            {"zone_id": "entrance", "points": [[0.1, 0.1], [0.4, 0.1], [0.4, 0.5], [0.1, 0.5]]},
            {"zone_id": "counter", "points": [[0.5, 0.3], [0.9, 0.3], [0.9, 0.8], [0.5, 0.8]]},
        ],
    }

    def get_zones(self, camera_id: str) -> list[dict]:
        return self._HARDCODED_ZONES.get(camera_id, [])

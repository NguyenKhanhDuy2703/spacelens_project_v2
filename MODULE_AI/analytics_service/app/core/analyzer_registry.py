from app.core.zone_analysis import ZoneAnalysis
from app.core.dwelltime_analysis import DwellTimeAnalysis
from app.core.heatmap_analysis import HeatmapAnalysis
from app.utils.zone_provider import ZoneProvider


class CameraAnalyzerRegistry:
    def __init__(
        self,
        zone_provider: ZoneProvider,
        default_w: int,
        default_h: int,
        dwell_iou_threshold: float = 0.7,
        dwell_time_threshold_sec: float = 2.0,
    ):
        self._zone_provider = zone_provider
        self._default_w = default_w
        self._default_h = default_h
        self._dwell_iou_threshold = dwell_iou_threshold
        self._dwell_time_threshold_sec = dwell_time_threshold_sec
        self._cameras: dict[str, dict] = {}

    def get_or_create(self, camera_id: str, frame_w: int | None = None, frame_h: int | None = None) -> dict:
        if camera_id not in self._cameras:
            fw = frame_w or self._default_w
            fh = frame_h or self._default_h
            self._cameras[camera_id] = {
                "zone": ZoneAnalysis(),
                "dwell": DwellTimeAnalysis(
                    iou_threshold=self._dwell_iou_threshold,
                    time_threshold=self._dwell_time_threshold_sec,
                ),
                "heatmap": HeatmapAnalysis(fw, fh),
                "zones_cache": self._zone_provider.get_zones(camera_id),
                "frame_w": fw,
                "frame_h": fh,
            }
        return self._cameras[camera_id]

    def all_camera_ids(self) -> list[str]:
        return list(self._cameras.keys())

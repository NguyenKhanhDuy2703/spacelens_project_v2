from typing import Literal
from pydantic import BaseModel


class ZoneEventPayload(BaseModel):
    event_type: Literal["zone_entry", "zone_exit", "zone_transition"]
    camera_id: str
    timestamp: float
    track_id: str
    zone_id: str | None = None
    from_zone_id: str | None = None
    to_zone_id: str | None = None


class DwellEventPayload(BaseModel):
    event_type: Literal["dwell_stop", "dwell_ping"]
    camera_id: str
    timestamp: float
    track_id: str
    dwell_time: float
    zone_id: str | None = None
    pos_x: int | None = None
    pos_y: int | None = None


class HeatmapEventPayload(BaseModel):
    event_type: Literal["heatmap_snapshot"] = "heatmap_snapshot"
    camera_id: str
    timestamp: float
    frame_width: int
    frame_height: int
    grid_size: int
    grid_width: int
    grid_height: int
    heatmap_matrix: list[list[float]]

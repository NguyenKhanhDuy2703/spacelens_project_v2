from app.schemas.analytics_event import ZoneEventPayload, DwellEventPayload, HeatmapEventPayload

_ZONE_EVENT_TYPE_MAP = {
    "ENTRY": "zone_entry",
    "EXIT": "zone_exit",
    "TRANSITION": "zone_transition",
}


def bbox_center(bbox: list[float]) -> tuple[float, float]:
    left, top, right, bottom = bbox
    return (left + right) / 2, (top + bottom) / 2


def build_zone_events(camera_id: str, timestamp: float, raw_events: list[dict]) -> list[ZoneEventPayload]:
    out = []
    for e in raw_events:
        out.append(ZoneEventPayload(
            event_type=_ZONE_EVENT_TYPE_MAP[e["event"]],
            camera_id=camera_id,
            timestamp=timestamp,
            track_id=e["track_id"],
            zone_id=e.get("zone_id"),
            from_zone_id=e.get("from_zone_id"),
            to_zone_id=e.get("to_zone_id"),
        ))
    return out


def build_dwell_events(camera_id: str, raw_events: list[dict]) -> list[DwellEventPayload]:
    out = []
    for e in raw_events:
        out.append(DwellEventPayload(
            event_type=e["event_type"],
            camera_id=camera_id,
            timestamp=e["timestamp"],
            track_id=e["track_id"],
            dwell_time=e["dwell_time"],
            zone_id=e.get("zone_id"),
            pos_x=e.get("pos_x"),
            pos_y=e.get("pos_y"),
        ))
    return out


def build_heatmap_event(camera_id: str, timestamp: float, heatmap_payload: dict) -> HeatmapEventPayload:
    return HeatmapEventPayload(
        camera_id=camera_id,
        timestamp=timestamp,
        **heatmap_payload,
    )

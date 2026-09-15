from app.core.analyzer_registry import CameraAnalyzerRegistry
from app.communication.event_dispatcher import EventDispatcher
from app.schemas.tracking_event import TrackingEventSchema
from app.utils.event_builders import bbox_center, build_zone_events, build_dwell_events, build_heatmap_event


def process_event(event: TrackingEventSchema, registry: CameraAnalyzerRegistry, dispatcher: EventDispatcher):
    analyzers = registry.get_or_create(event.camera_id, frame_w=event.frame_width, frame_h=event.frame_height)
    zones = registry.get_zones(event.camera_id)

    out_events = []

    for track in event.tracks:
        center = bbox_center(track.bbox)

        _hit_zones, zone_events = analyzers["zone"].analyze(
            center, zones, track_id=track.id,
            frame_w=analyzers["frame_w"], frame_h=analyzers["frame_h"],
        )
        out_events += build_zone_events(event.camera_id, event.timestamp, zone_events)
        
        analyzers["dwell"].update_dwell_time(track.id, track.bbox)
        analyzers["heatmap"].update_grid_cell(center[0], center[1])

    out_events += build_dwell_events(event.camera_id, analyzers["dwell"].get_new_events())

    ping_events = []
    for track in event.tracks:
        ping = analyzers["dwell"].alert_stopped_objects(track.id)
        if ping:
            ping_events.append(ping)
    out_events += build_dwell_events(event.camera_id, ping_events)

    out_events.append(build_heatmap_event(
        event.camera_id, event.timestamp, analyzers["heatmap"].get_payload_heatmap(),
    ))

    analyzers["dwell"].cleanup_old_tracks(zone_analyzer=analyzers["zone"])

    for e in out_events:
        dispatcher.dispatch(e)

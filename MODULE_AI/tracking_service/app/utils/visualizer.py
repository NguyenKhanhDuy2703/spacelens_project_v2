import cv2

def draw_tracks(frame, tracks):
    for track in tracks:
        if not track.is_confirmed():
            continue
        track_id = getattr(track, 'final_track_id', None)
        if track_id is None:
            track_id = getattr(track, 'track_id', None)
        if track_id is None:
            continue
        
        ltrb = track.to_ltrb() 
        try:
            seed = int(str(track_id).split('-')[-1]) if '-' in str(track_id) else int(track_id)
        except (ValueError, TypeError):
            seed = 0
        color = (
            (seed * 123) % 256, 
            (seed * 456) % 256, 
            (seed * 789) % 256
        )
        x1, y1, x2, y2 = map(int, ltrb)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"ID: {track_id}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    return frame

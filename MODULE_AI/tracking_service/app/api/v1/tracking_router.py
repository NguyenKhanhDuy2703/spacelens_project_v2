from fastapi import APIRouter, status
from multiprocessing import Process, Event
import threading
import logging
from app.utils.exception_handle import CustomException
from app.processing.stream_processing import StreamProcessor
from typing import Optional , List
from pydantic import BaseModel
router_tracking = APIRouter(
    prefix="/api/v1/tracking",
    tags=["tracking"],
)
class ZoneItem(BaseModel):
    zone_id: str
    points: List[List[float]]  # accept both normalized float (0-1) and absolute int pixel coords

class TrackingRequest (BaseModel):
    list_zone: Optional[List[ZoneItem]] = []
    url_rtsp: str
    camera_id: Optional[str] = None
    location_id: Optional[str] = None

def run_stream_process(url_rtsp: str, list_zone, camera_id , location_id, stop_event: Event) -> None:
    processor = StreamProcessor()
    processor.process_stream(url_rtsp, list_zone , camera_id, location_id , stop_event)

active_processes: dict[str, Process] = {} #save url_rtsp and process
stop_signals: dict[str, Event] = {} # save url_rtsp and stop event
stream_lock = threading.Lock() 

@router_tracking.post("/process", status_code=status.HTTP_200_OK )
async def process_tracking(request: TrackingRequest):
    try:  
        print(request)
        clean_url = str(request.url_rtsp).strip().strip('"').strip("'")
        # Tự động map đường dẫn Windows bên ngoài vào đường dẫn container bên trong
        clean_url = clean_url.replace("\\", "/")
        if "MODULE_AI/storage" in clean_url:
            clean_url = "/app/storage/" + clean_url.split("MODULE_AI/storage/")[-1]
        list_zone = request.list_zone 
        camera_id = request.camera_id
        location_id = request.location_id
        with stream_lock:
            if clean_url in active_processes:
                if active_processes[clean_url].is_alive(): 
                    return {
                        "status_code": status.HTTP_200_OK,  
                        "message": f"Stream already being processed for {clean_url}",
                    }
                else:
                    del active_processes[clean_url] 
                    if clean_url in stop_signals:
                        del stop_signals[clean_url]
            
       
            stop_event = Event()
            
            process = Process(target=run_stream_process, args=(clean_url, list_zone, camera_id , location_id, stop_event))
            process.start()
            
            active_processes[clean_url] = process
            stop_signals[clean_url] = stop_event

        return {
            "status_code": status.HTTP_200_OK,  
            "message": f"AI Consumer triggered for {clean_url}",
            "active_streams": list(active_processes.keys())
        }
    except Exception as e:
        error_data = CustomException(
            message="Failed to start processing stream",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=str(e)
        ).to_dict()
        logging.exception(error_data)
        return error_data

@router_tracking.get("/status")
def get_stream_status(url_rtsp: Optional[str] = None):
    """Query status of active streams"""
    with stream_lock:
        if url_rtsp:
            clean_url = str(url_rtsp).strip().strip('"').strip("'")
            if clean_url in active_processes:
                p = active_processes[clean_url]
                return {
                    "url": clean_url,
                    "is_running": p.is_alive(),
                    "status": "running" if p.is_alive() else "stopped"
                }
            return {"url": clean_url, "is_running": False, "status": "not_started"}
        
        # Return all active streams
        return {
            "active_streams": len(active_processes),
            "streams": [
                {
                    "url": url,
                    "is_running": p.is_alive(),
                    "status": "running" if p.is_alive() else "stopped"
                }
                for url, p in active_processes.items()
            ]
        }

def _cleanup_process(p, event, clean_url: str) -> None:
    """Background thread: gracefully stop process sau khi endpoint đã trả về."""
    try:
        if event is not None:
            event.set()
        if p.is_alive():
            p.join(timeout=10)
        if p.is_alive():
            logging.warning(f"[stop_tracking] Terminating hung process: {clean_url}")
            p.terminate()
            p.join(timeout=3)
        if p.is_alive():
            logging.error(f"[stop_tracking] Force-killing process: {clean_url}")
            p.kill()
            p.join(timeout=2)
        logging.info(f"[stop_tracking] Process cleaned up: {clean_url}")
    except Exception as exc:
        logging.error(f"[stop_tracking] Cleanup error for {clean_url}: {exc}")


@router_tracking.get("/stopped")
def stop_tracking(url_rtsp: str):
    clean_url = str(url_rtsp).strip().strip('"').strip("'")

    # Lấy process + event, đồng thời xóa khỏi registry NGAY để chặn duplicate call
    with stream_lock:
        if clean_url not in active_processes:
            return {"status": "already_stopped", "url": clean_url}
        p = active_processes.pop(clean_url)
        event = stop_signals.pop(clean_url, None)
        remaining = list(active_processes.keys())

    # Signal ngay để vòng while trong process thoát sớm nhất có thể
    if event is not None:
        event.set()

    # Cleanup chạy background — endpoint không chờ, trả về ngay
    t = threading.Thread(target=_cleanup_process, args=(p, event, clean_url), daemon=True)
    t.start()

    return {
        "status_code": status.HTTP_200_OK,
        "message": f"Stop signal sent for {clean_url}",
        "active_streams": remaining,
    }
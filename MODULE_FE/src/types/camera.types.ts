export type StreamSourceType = 'RTSP' | 'VIDEO_FILE' | 'WEBCAM';
export type CameraCodec = 'H264' | 'H265' | 'MJPEG';
export type CameraOrientation = 'CEILING' | 'WALL' | 'ANGLED';
export type CameraStatus =
  | 'INACTIVE'
  | 'READY'
  | 'STARTING'
  | 'STREAMING'
  | 'RECONNECTING'
  | 'STOPPED'
  | 'ERROR'
  | 'ARCHIVED';

export interface Resolution {
  width: number;
  height: number;
}

export interface AiProcessInfo {
  process_id?: number;
  started_at?: string;
  stopped_at?: string;
}

export interface Camera {
  _id: string;
  camera_code: string;
  name: string;
  description?: string;
  location_id: string;
  floor_id?: string;
  stream_source_type: StreamSourceType;
  url_rtsp: string;
  url_rtsp_masked?: string;
  resolution: Resolution;
  fps: number;
  codec: CameraCodec;
  orientation: CameraOrientation;
  snapshot_url?: string;
  status: CameraStatus;
  last_error_message?: string;
  ai_process_info?: AiProcessInfo;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCameraPayload {
  camera_code: string;
  name: string;
  description?: string;
  location_id: string;
  floor_id?: string;
  stream_source_type: StreamSourceType;
  url_rtsp: string;
  resolution: Resolution;
  fps?: number;
  codec?: CameraCodec;
  orientation?: CameraOrientation;
  status?: 'INACTIVE' | 'READY';
}

export type UpdateCameraPayload = Partial<CreateCameraPayload>;

export interface CameraQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  location_id?: string;
}

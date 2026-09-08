import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CameraDocument = Camera & Document;

@Schema({ _id: false })
export class Resolution {
  @Prop({ required: true, type: Number })
  width: number;

  @Prop({ required: true, type: Number })
  height: number;
}

@Schema({ _id: false })
export class AiProcessInfo {
  @Prop({ type: Number })
  process_id?: number;

  @Prop({ type: Date })
  started_at?: Date;

  @Prop({ type: Date })
  stopped_at?: Date;
}

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'cameras',
})
export class Camera {
  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  camera_code: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 50 })
  name: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ required: true, trim: true, index: true })
  location_id: string;

  @Prop({ type: String, trim: true, maxlength: 30 })
  floor_id?: string;

  @Prop({
    required: true,
    enum: ['RTSP', 'VIDEO_FILE', 'WEBCAM'],
    default: 'RTSP',
  })
  stream_source_type: 'RTSP' | 'VIDEO_FILE' | 'WEBCAM';

  @Prop({ required: true, trim: true })
  url_rtsp: string;

  @Prop({ type: String, trim: true })
  url_rtsp_masked?: string;

  @Prop({ type: Resolution, required: true })
  resolution: Resolution;

  @Prop({ type: Number, default: 30, min: 1, max: 120 })
  fps: number;

  @Prop({
    type: String,
    enum: ['H264', 'H265', 'MJPEG'],
    default: 'H264',
  })
  codec: 'H264' | 'H265' | 'MJPEG';

  @Prop({
    type: String,
    enum: ['CEILING', 'WALL', 'ANGLED'],
    default: 'ANGLED',
  })
  orientation: 'CEILING' | 'WALL' | 'ANGLED';

  @Prop({ type: String })
  snapshot_url?: string;

  @Prop({
    type: String,
    enum: [
      'INACTIVE',
      'READY',
      'STARTING',
      'STREAMING',
      'RECONNECTING',
      'STOPPED',
      'ERROR',
      'ARCHIVED',
    ],
    default: 'READY',
  })
  status:
    | 'INACTIVE'
    | 'READY'
    | 'STARTING'
    | 'STREAMING'
    | 'RECONNECTING'
    | 'STOPPED'
    | 'ERROR'
    | 'ARCHIVED';

  @Prop({ type: String })
  last_error_message?: string;

  @Prop({ type: AiProcessInfo })
  ai_process_info?: AiProcessInfo;

  @Prop({ type: Boolean, default: true, index: true })
  is_active: boolean;
}

export const CameraSchema = SchemaFactory.createForClass(Camera);

import React from 'react';
import { Settings, Trash2, Radio, MapPin, Wifi, WifiOff } from 'lucide-react';
import { Camera, CameraStatus } from '@/types/camera.types';
import { Badge } from '@/components/ui/badge';

interface CameraCardProps {
  camera: Camera;
  onToggleAi: (id: string) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onTestConnection: (camera: Camera) => void;
}

function statusVariant(status: CameraStatus): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  if (status === 'STREAMING') return 'success';
  if (status === 'READY') return 'info';
  if (status === 'RECONNECTING' || status === 'STARTING') return 'warning';
  if (status === 'ERROR') return 'danger';
  return 'default';
}

export default function CameraCard({
  camera,
  onToggleAi,
  onEdit,
  onDelete,
  onTestConnection,
}: CameraCardProps): React.JSX.Element {
  const isOnline =
    camera.status === 'STREAMING' ||
    camera.status === 'READY';

  const isAiActive = Boolean(camera.ai_process_info?.process_id);

  const maskedRtsp =
    camera.url_rtsp_masked ||
    camera.url_rtsp?.replace(/:[^:@]*@/, ':***@') ||
    '';

  const resolutionDisplay = camera.resolution
    ? `${camera.resolution.width}×${camera.resolution.height}`
    : '—';

  const cameraId = camera._id;

  return (
    <div className="camera-card group">
      {/* 1. Video Preview Area — static placeholder replacing canvas animation */}
      <div className="camera-preview-box relative overflow-hidden bg-[#080A0D]">
        {/* Grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Status overlay center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {isOnline ? (
            isAiActive ? (
              <>
                <div className="w-10 h-10 rounded-full border border-cyan-500/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <span className="font-mono text-[10px] text-cyan-400/70 tracking-widest">AI TRACKING</span>
              </>
            ) : (
              <>
                <Wifi size={22} className="text-slate-600" />
                <span className="font-mono text-[10px] text-slate-600 tracking-widest">STREAM ACTIVE</span>
              </>
            )
          ) : (
            <>
              <WifiOff size={22} className="text-yellow-600/60" />
              <span className="font-mono text-[10px] text-yellow-600/60 tracking-widest uppercase">
                {camera.status}
              </span>
            </>
          )}
        </div>

        {/* Top: Status badges */}
        <div className="camera-preview-overlay">
          <Badge variant={statusVariant(camera.status)}>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                camera.status === 'STREAMING'
                  ? 'bg-emerald-400 animate-pulse'
                  : camera.status === 'READY'
                  ? 'bg-cyan-400'
                  : camera.status === 'RECONNECTING'
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            {camera.status}
          </Badge>

          <Badge variant={isAiActive ? 'info' : 'default'}>
            {isAiActive ? 'AI Active' : 'AI Off'}
          </Badge>
        </div>

        {/* Bottom: Telemetry */}
        <div className="camera-preview-bottom text-xs font-mono">
          <span>{resolutionDisplay}</span>
          <span>{camera.fps ? `${camera.fps} FPS` : '—'}</span>
          <span>{camera.codec || '—'}</span>
        </div>
      </div>

      {/* 2. Camera Info Body */}
      <div className="camera-card-body">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="camera-title font-semibold truncate">{camera.name}</div>
            <span className="font-mono text-[0.65rem] text-[var(--color-secondary)] bg-[var(--color-neutral)] px-2 py-0.5 rounded border border-[var(--color-border)] shrink-0">
              {camera.camera_code}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-secondary)] text-xs mt-1">
            <MapPin size={12} className="text-[var(--color-tertiary)] shrink-0" />
            <span className="truncate">{camera.location_id || '—'}</span>
          </div>
        </div>

        <div className="camera-rtsp text-xs font-mono truncate" title={camera.url_rtsp}>
          {maskedRtsp || <span className="text-slate-600 italic">No RTSP URL configured</span>}
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2.5 border-t border-[var(--color-border)] text-xs">
          {[
            { label: 'Codec', value: camera.codec || '—' },
            { label: 'Protocol', value: camera.stream_source_type || '—' },
            { label: 'Mount', value: camera.orientation || '—' },
            { label: 'Service', value: camera.is_active !== false ? 'Enabled' : 'Disabled', active: camera.is_active !== false },
          ].map(({ label, value, active }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[var(--color-secondary)]">{label}:</span>
              <span className={active !== undefined ? (active ? 'text-cyan-400 font-medium' : 'text-slate-500') : 'font-medium text-[var(--color-primary)]'}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Action Footer */}
      <div className="camera-card-footer">
        {/* AI Toggle */}
        <div
          className="switch-wrapper cursor-pointer"
          onClick={() => onToggleAi(cameraId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onToggleAi(cameraId)}
          aria-label={isAiActive ? 'Disable AI' : 'Enable AI'}
        >
          <div className={`switch-track ${isAiActive ? 'active' : ''}`}>
            <div className="switch-thumb" />
          </div>
          <span className={`text-xs font-medium ${isAiActive ? 'text-cyan-400' : 'text-[var(--color-secondary)]'}`}>
            {isAiActive ? 'AI Enabled' : 'AI Paused'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onTestConnection(camera)}
            title="Test RTSP connection"
          >
            <Radio size={13} />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onEdit(camera)}
            title="Edit camera"
          >
            <Settings size={13} />
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(camera)}
            title="Delete camera"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

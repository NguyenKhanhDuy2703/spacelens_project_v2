import React from 'react';
import { Video, Wifi, Cpu, AlertTriangle } from 'lucide-react';
import { Camera } from '@/types/camera.types';

interface CameraStatsBarProps {
  cameras?: Camera[];
}

export default function CameraStatsBar({ cameras = [] }: CameraStatsBarProps): React.JSX.Element {
  const total = cameras.length;
  const connected = cameras.filter(
    (c) => c.status === 'STREAMING' || c.status === 'READY' || (c as any).status === 'CONNECTED'
  ).length;
  const aiActive = cameras.filter(
    (c) => Boolean(c.ai_process_info?.process_id) || (c as any).aiWorkerState === 'ACTIVE' || c.status === 'STREAMING'
  ).length;
  const reconnecting = cameras.filter(
    (c) => c.status === 'RECONNECTING' || c.status === 'ERROR'
  ).length;

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div>
          <div className="kpi-label">TOTAL CAMERAS</div>
          <div className="kpi-value">{String(total).padStart(2, '0')}</div>
          <div className="kpi-sub">Registered endpoints</div>
        </div>
        <div className="p-2.5 bg-[var(--color-neutral)] border border-[var(--color-border)] rounded-[var(--radius-sm)]">
          <Video size={18} color="var(--color-primary)" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">STREAMS ONLINE</div>
          <div className="kpi-value text-[var(--color-tertiary)]">
            {String(connected).padStart(2, '0')}
          </div>
          <div className="kpi-sub">{Math.round((connected / (total || 1)) * 100)}% uptime health</div>
        </div>
        <div className="p-2.5 bg-[rgba(180,255,57,0.08)] border border-[rgba(180,255,57,0.25)] rounded-[var(--radius-sm)]">
          <Wifi size={18} color="var(--color-tertiary)" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">AI ANALYTICS ACTIVE</div>
          <div className="kpi-value text-[var(--color-primary)]">
            {String(aiActive).padStart(2, '0')}
          </div>
          <div className="kpi-sub">Inference pipelines running</div>
        </div>
        <div className="p-2.5 bg-[var(--color-neutral)] border border-[var(--color-border)] rounded-[var(--radius-sm)]">
          <Cpu size={18} color="var(--color-tertiary)" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">ATTENTION REQUIRED</div>
          <div className={`kpi-value ${reconnecting > 0 ? 'text-[var(--color-status-warning)]' : 'text-[var(--color-secondary)]'}`}>
            {String(reconnecting).padStart(2, '0')}
          </div>
          <div className="kpi-sub">Offline or retry streams</div>
        </div>
        <div className={`p-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] ${reconnecting > 0 ? 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.3)]' : 'bg-[var(--color-neutral)]'}`}>
          <AlertTriangle size={18} color={reconnecting > 0 ? 'var(--color-status-warning)' : 'var(--color-secondary)'} />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Video, Wifi, Cpu, AlertTriangle } from 'lucide-react';

export default function CameraStatsBar({ cameras = [] }) {
  const total = cameras.length;
  const connected = cameras.filter((c) => c.status === 'CONNECTED').length;
  const aiActive = cameras.filter((c) => c.aiWorkerState === 'ACTIVE').length;
  const reconnecting = cameras.filter((c) => c.status === 'RECONNECTING').length;

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div>
          <div className="kpi-label">TOTAL REGISTERED</div>
          <div className="kpi-value">{String(total).padStart(2, '0')}</div>
          <div className="kpi-sub">Camera endpoints</div>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: 'var(--color-neutral)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
          <Video size={18} color="var(--color-primary)" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">STREAM ONLINE</div>
          <div className="kpi-value" style={{ color: 'var(--color-tertiary)' }}>
            {String(connected).padStart(2, '0')}
          </div>
          <div className="kpi-sub">{Math.round((connected / (total || 1)) * 100)}% connection health</div>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: 'rgba(0, 163, 108, 0.08)', border: '1px solid rgba(0, 163, 108, 0.25)', borderRadius: 'var(--radius-sm)' }}>
          <Wifi size={18} color="var(--color-tertiary)" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">AI WORKERS RUNNING</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>
            {String(aiActive).padStart(2, '0')}
          </div>
          <div className="kpi-sub">Inference active</div>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: 'var(--color-neutral)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
          <Cpu size={18} color="var(--color-tertiary)" />
        </div>
      </div>

      <div className="kpi-card">
        <div>
          <div className="kpi-label">RECONNECTING / ERR</div>
          <div className="kpi-value" style={{ color: reconnecting > 0 ? 'var(--color-status-warning)' : 'var(--color-secondary)' }}>
            {String(reconnecting).padStart(2, '0')}
          </div>
          <div className="kpi-sub">Stream retry alerts</div>
        </div>
        <div style={{ padding: '0.65rem', backgroundColor: reconnecting > 0 ? 'rgba(230, 138, 0, 0.08)' : 'var(--color-neutral)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
          <AlertTriangle size={18} color={reconnecting > 0 ? 'var(--color-status-warning)' : 'var(--color-secondary)'} />
        </div>
      </div>
    </div>
  );
}

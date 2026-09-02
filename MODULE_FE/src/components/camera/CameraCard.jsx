import React, { useEffect, useRef } from 'react';
import { Settings, Trash2, Radio, MapPin } from 'lucide-react';

export default function CameraCard({
  camera,
  onToggleAi,
  onEdit,
  onDelete,
  onTestConnection,
}) {
  const canvasRef = useRef(null);

  // Live Canvas Simulation for Video / AI bounding boxes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let offset = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Deep graphite black background
      ctx.fillStyle = '#090A0C';
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle coordinate grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (camera.status === 'CONNECTED') {
        // Crosshair / Center focal
        ctx.strokeStyle = 'rgba(180, 255, 57, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 22, 0, Math.PI * 2);
        ctx.stroke();

        if (camera.aiWorkerState === 'ACTIVE') {
          offset += 0.035;
          // Animated Bounding Box 1 (Electric Lime)
          const b1X = (width * 0.3) + Math.sin(offset) * 20;
          const b1Y = (height * 0.25) + Math.cos(offset) * 10;
          
          ctx.strokeStyle = '#B4FF39';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(b1X, b1Y, 48, 80);

          ctx.fillStyle = '#B4FF39';
          ctx.fillRect(b1X, b1Y - 14, 62, 14);
          ctx.fillStyle = '#0E1013';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText('ID#102 96%', b1X + 3, b1Y - 3);

          // Animated Bounding Box 2 (Cyan Secondary)
          const b2X = (width * 0.6) - Math.cos(offset * 0.8) * 25;
          const b2Y = (height * 0.35) + Math.sin(offset * 0.8) * 8;
          
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(b2X, b2Y, 44, 75);

          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(b2X, b2Y - 14, 60, 14);
          ctx.fillStyle = '#0E1013';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText('ID#108 91%', b2X + 3, b2Y - 3);
        } else {
          // Standby text
          ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('[ RTSP STREAM READY  |  AI STANDBY ]', width / 2, height / 2 + 4);

        }
      } else {
        // Reconnecting / Offline test bars
        ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[ STREAM RECONNECTING... ]', width / 2, height / 2 + 4);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [camera.status, camera.aiWorkerState]);

  const isAiActive = camera.aiWorkerState === 'ACTIVE';

  return (
    <div className="camera-card">
      {/* 1. Live Preview Screen */}
      <div className="camera-preview-box">
        <canvas
          ref={canvasRef}
          width={320}
          height={180}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Top Overlay Badges */}
        <div className="camera-preview-overlay">
          <div className={`status-pill ${camera.status.toLowerCase()}`}>
            <span className={`status-dot ${camera.status === 'CONNECTED' ? 'online' : 'warning'}`}></span>
            <span>{camera.status}</span>
          </div>

          <div
            style={{
              padding: '0.15rem 0.45rem',
              backgroundColor: isAiActive ? 'rgba(180, 255, 57, 0.95)' : 'rgba(23, 25, 28, 0.85)',
              color: isAiActive ? '#0E1013' : '#9CA3AF',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 700,
              border: '1px solid var(--color-border)',
            }}
          >
            {isAiActive ? 'AI ACTIVE' : 'AI STANDBY'}
          </div>
        </div>

        {/* Bottom Overlay Telemetry */}
        <div className="camera-preview-bottom">
          <span>{camera.resolution}</span>
          <span>{camera.fpsActual > 0 ? `${camera.fpsActual} FPS` : '0.0 FPS'}</span>
          <span>{camera.latencyMs > 0 ? `${camera.latencyMs} ms` : '-- ms'}</span>
        </div>
      </div>

      {/* 2. Camera Card Body */}
      <div className="camera-card-body">
        <div>
          <div className="camera-title">{camera.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-secondary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
            <MapPin size={12} color="var(--color-tertiary)" />
            <span>{camera.location}</span>
          </div>
        </div>

        <div className="camera-rtsp" title={camera.rtspUrl}>
          {camera.rtspUrl.replace(/:[^:@]*@/, ':***@')}
        </div>

        {/* Technical Specs Summary */}
        <div className="camera-meta-grid">
          <div>
            <span style={{ color: 'var(--color-secondary)' }}>MODEL:</span>{' '}
            <strong style={{ color: 'var(--color-primary)' }}>{camera.model}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-secondary)' }}>DEVICE:</span>{' '}
            <strong style={{ color: 'var(--color-primary)' }}>{camera.device}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-secondary)' }}>ZONES:</span>{' '}
            <strong style={{ color: 'var(--color-primary)' }}>{camera.zoneCount} Polygons</strong>
          </div>
          <div>
            <span style={{ color: 'var(--color-secondary)' }}>CONF:</span>{' '}
            <strong style={{ color: 'var(--color-primary)' }}>{Math.round(camera.confidenceThreshold * 100)}%</strong>
          </div>
        </div>
      </div>

      {/* 3. Action Footer */}
      <div className="camera-card-footer">
        {/* Toggle AI Worker Switch */}
        <div className="switch-wrapper" onClick={() => onToggleAi(camera.id)}>
          <div className={`switch-track ${isAiActive ? 'active' : ''}`}>
            <div className="switch-thumb"></div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: isAiActive ? 'var(--color-tertiary)' : 'var(--color-secondary)', fontWeight: 600 }}>
            {isAiActive ? 'AI ON' : 'AI OFF'}
          </span>
        </div>

        {/* Buttons: Test, Edit, Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onTestConnection(camera)}
            title="Test Stream Handshake"
          >
            <Radio size={12} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onEdit(camera)}
            title="Configure Camera"
          >
            <Settings size={12} />
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDelete(camera)}
            title="Remove Camera"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

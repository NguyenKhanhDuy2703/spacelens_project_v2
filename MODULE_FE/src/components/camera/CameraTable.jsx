import React, { useState } from 'react';
import { Settings, Trash2, Radio, Play, Square, MapPin } from 'lucide-react';

export default function CameraTable({
  cameras = [],
  onToggleAi,
  onEdit,
  onDelete,
  onTestConnection,
  onBulkToggleAi,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(cameras.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const isAllSelected = cameras.length > 0 && selectedIds.length === cameras.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Bulk Action Bar when items are selected */}
      {selectedIds.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}
        >
          <div>
            <span>SELECTED: <strong>{selectedIds.length}</strong> / {cameras.length} CAMERAS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-sm"
              style={{ backgroundColor: 'var(--color-tertiary)', color: 'white' }}
              onClick={() => onBulkToggleAi(selectedIds, true)}
            >
              <Play size={12} />
              <span>Start AI Selected</span>
            </button>
            <button
              className="btn btn-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
              onClick={() => onBulkToggleAi(selectedIds, false)}
            >
              <Square size={12} />
              <span>Standby Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Status</th>
              <th>Camera Endpoint</th>
              <th>Location</th>
              <th>AI Model & HW</th>
              <th>Stream FPS</th>
              <th>AI Worker</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((cam) => {
              const isSelected = selectedIds.includes(cam.id);
              const isAiActive = cam.aiWorkerState === 'ACTIVE';

              return (
                <tr key={cam.id} style={{ backgroundColor: isSelected ? 'rgba(0, 163, 108, 0.03)' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(cam.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div className={`status-pill ${cam.status.toLowerCase()}`}>
                      <span className={`status-dot ${cam.status === 'CONNECTED' ? 'online' : 'warning'}`}></span>
                      <span>{cam.status}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{cam.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-secondary)' }}>
                      {cam.rtspUrl.replace(/:[^:@]*@/, ':***@')}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-secondary)', fontSize: '0.75rem' }}>
                      <MapPin size={12} />
                      <span>{cam.location}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                      <strong>{cam.model}</strong>
                      <span style={{ color: 'var(--color-secondary)' }}> ({cam.device})</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      <span style={{ color: cam.fpsActual > 0 ? 'var(--color-primary)' : 'var(--color-secondary)', fontWeight: 600 }}>
                        {cam.fpsActual > 0 ? `${cam.fpsActual} FPS` : '0.0 FPS'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="switch-wrapper" onClick={() => onToggleAi(cam.id)}>
                      <div className={`switch-track ${isAiActive ? 'active' : ''}`}>
                        <div className="switch-thumb"></div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: isAiActive ? 'var(--color-tertiary)' : 'var(--color-secondary)', fontWeight: 600 }}>
                        {isAiActive ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onTestConnection(cam)}
                        title="Test Stream Handshake"
                      >
                        <Radio size={12} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onEdit(cam)}
                        title="Configure"
                      >
                        <Settings size={12} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(cam)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

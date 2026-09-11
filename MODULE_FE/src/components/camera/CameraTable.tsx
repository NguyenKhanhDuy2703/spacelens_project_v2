import React, { useState } from 'react';
import { Settings, Trash2, Radio, Play, Square, MapPin } from 'lucide-react';
import { Camera } from '@/types/camera.types';

interface CameraTableProps {
  cameras?: Camera[];
  onToggleAi: (id: string) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  onTestConnection: (camera: Camera) => void;
  onBulkToggleAi?: (ids: string[], enable: boolean) => void;
}

export default function CameraTable({
  cameras = [],
  onToggleAi,
  onEdit,
  onDelete,
  onTestConnection,
  onBulkToggleAi = () => {},
}: CameraTableProps): React.JSX.Element {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(cameras.map((c) => c._id || (c as any).id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const isAllSelected = cameras.length > 0 && selectedIds.length === cameras.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk Action Bar when items are selected */}
      {selectedIds.length > 0 && (
        <div className="bg-[var(--color-neutral)] border border-[var(--color-border)] text-[var(--color-primary)] px-4 py-2.5 rounded-[var(--radius-sm)] flex items-center justify-between font-mono text-xs">
          <div>
            <span>
              SELECTED: <strong>{selectedIds.length}</strong> / {cameras.length} CAMERAS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => onBulkToggleAi(selectedIds, true)}
            >
              <Play size={12} />
              <span>Start AI Selected</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
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
              <th className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th>Status</th>
              <th>Camera Endpoint</th>
              <th>Location</th>
              <th>Codec & Stream</th>
              <th>Stream FPS</th>
              <th>AI Worker</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((cam) => {
              const camId = cam._id || (cam as any).id;
              const isSelected = selectedIds.includes(camId);
              const isAiActive =
                Boolean(cam.ai_process_info?.process_id) ||
                (cam as any).aiWorkerState === 'ACTIVE' ||
                cam.status === 'STREAMING';
              const isOnline =
                cam.status === 'STREAMING' ||
                cam.status === 'READY' ||
                (cam as any).status === 'CONNECTED';
              const rtspDisplay = cam.url_rtsp || (cam as any).rtspUrl || '';
              const maskedRtsp = cam.url_rtsp_masked || rtspDisplay.replace(/:[^:@]*@/, ':***@');

              return (
                <tr
                  key={camId}
                  className={isSelected ? 'bg-[rgba(180,255,57,0.05)]' : undefined}
                >
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(camId)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td>
                    <div className={`status-pill ${isOnline ? 'connected' : 'warning'}`}>
                      <span className={`status-dot ${isOnline ? 'online' : 'warning'}`} />
                      <span>{cam.status}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[var(--color-primary)]">{cam.name}</span>
                      <span className="font-mono text-[0.65rem] text-[var(--color-secondary)]">
                        ({cam.camera_code || (cam as any).id})
                      </span>
                    </div>
                    <div
                      className="font-mono text-[0.7rem] text-[var(--color-secondary)]"
                      title={rtspDisplay}
                    >
                      {maskedRtsp}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-[var(--color-secondary)] text-xs">
                      <MapPin size={12} color="var(--color-tertiary)" />
                      <span>{cam.location_id || (cam as any).location || 'Default'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="font-mono text-[0.72rem]">
                      <strong>{cam.codec || 'H264'}</strong>
                      <span className="text-[var(--color-secondary)]"> ({cam.stream_source_type || 'RTSP'})</span>
                    </div>
                  </td>
                  <td>
                    <div className="font-mono text-xs">
                      <span className="text-[var(--color-primary)] font-semibold">
                        {cam.fps || (cam as any).fpsActual || 30} FPS
                      </span>
                    </div>
                  </td>
                  <td>
                    <div
                      className="switch-wrapper cursor-pointer"
                      onClick={() => onToggleAi(camId)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={`switch-track ${isAiActive ? 'active' : ''}`}>
                        <div className="switch-thumb" />
                      </div>
                      <span
                        className={`font-mono text-[0.7rem] font-semibold ${
                          isAiActive ? 'text-[var(--color-tertiary)]' : 'text-[var(--color-secondary)]'
                        }`}
                      >
                        {isAiActive ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onTestConnection(cam)}
                        title="Test Stream Handshake"
                      >
                        <Radio size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onEdit(cam)}
                        title="Configure"
                      >
                        <Settings size={12} />
                      </button>
                      <button
                        type="button"
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

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  camera,
  onConfirm,
}) {
  if (!isOpen || !camera) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--color-status-error)" />
            <h3 className="section-title" style={{ fontSize: '1rem', color: 'var(--color-status-error)' }}>
              DELETE CAMERA ENDPOINT
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ fontSize: '0.85rem' }}>
          <p>
            Are you sure you want to remove <strong>"{camera.name}"</strong> (<code>{camera.id}</code>)?
          </p>
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(217, 56, 58, 0.06)',
              border: '1px solid rgba(217, 56, 58, 0.2)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--color-status-error)',
            }}
          >
            ⚠️ WARNING: This will terminate any active background AI inference worker process and decouple all assigned zone polygons.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              onConfirm(camera.id);
              onClose();
            }}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

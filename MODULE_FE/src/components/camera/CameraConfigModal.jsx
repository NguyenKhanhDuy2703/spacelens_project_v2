import React, { useState, useEffect } from 'react';
import { X, Radio, CheckCircle2, AlertCircle, Loader2, Video } from 'lucide-react';
import { cameraService } from '../../services/cameraService';

export default function CameraConfigModal({
  isOpen,
  onClose,
  cameraToEdit,
  onSave,
}) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    rtspUrl: 'rtsp://admin:pass123@192.168.1.100:554/live/ch0',
    streamType: 'RTSP_IP',
    model: 'yolov8s',
    device: 'CUDA:0',
    confidenceThreshold: 0.55,
  });

  const [testState, setTestState] = useState({
    testing: false,
    tested: false,
    success: false,
    message: '',
    latencyMs: 0,
  });

  useEffect(() => {
    if (cameraToEdit) {
      setFormData({
        name: cameraToEdit.name || '',
        location: cameraToEdit.location || '',
        rtspUrl: cameraToEdit.rtspUrl || '',
        streamType: cameraToEdit.streamType || 'RTSP_IP',
        model: cameraToEdit.model || 'yolov8s',
        device: cameraToEdit.device || 'CUDA:0',
        confidenceThreshold: cameraToEdit.confidenceThreshold || 0.55,
      });
    } else {
      setFormData({
        name: '',
        location: '',
        rtspUrl: 'rtsp://admin:pass123@192.168.1.100:554/live/ch0',
        streamType: 'RTSP_IP',
        model: 'yolov8s',
        device: 'CUDA:0',
        confidenceThreshold: 0.55,
      });
    }
    setTestState({ testing: false, tested: false, success: false, message: '', latencyMs: 0 });
  }, [cameraToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestState({ testing: false, tested: false, success: false, message: '', latencyMs: 0 });
  };

  const handleTestConnection = async () => {
    setTestState({ testing: true, tested: false, success: false, message: 'Initiating RTSP handshake...', latencyMs: 0 });
    const result = await cameraService.testRtspConnection(formData.rtspUrl);
    setTestState({
      testing: false,
      tested: true,
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 className="section-title">
              {cameraToEdit ? 'CONFIGURE CAMERA ENDPOINT' : 'REGISTER NEW CAMERA ENDPOINT'}
            </h2>
            <p className="section-desc">
              Specify RTSP credentials, location metadata, and assign AI inference hyperparameters.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              
              {/* Left Column: Device Connection Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-secondary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                  // 1. CONNECTION PARAMETERS
                </div>

                <div className="form-group">
                  <label className="form-label">Camera Endpoint Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Main Entrance Gate #1"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Physical Location / Floor Tag</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Building A - Floor 1"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stream Source Type</label>
                  <select
                    className="form-select"
                    value={formData.streamType}
                    onChange={(e) => handleChange('streamType', e.target.value)}
                  >
                    <option value="RTSP_IP">RTSP IP Camera Stream</option>
                    <option value="VIDEO_FILE">Local Video File (Mock / Storage)</option>
                    <option value="HLS_WEBCAM">HLS / WebRTC Endpoint</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">RTSP Stream URI *</label>
                  <input
                    type="text"
                    required
                    className="form-input mono"
                    placeholder="rtsp://user:pass@192.168.1.100:554/live"
                    value={formData.rtspUrl}
                    onChange={(e) => handleChange('rtspUrl', e.target.value)}
                  />
                  <span className="form-helper">Format: rtsp://[username]:[password]@[ip]:[port]/[path]</span>
                </div>
              </div>

              {/* Right Column: AI Inference & Hardware Config */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-secondary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.35rem' }}>
                  // 2. AI PIPELINE ALLOCATION
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Detection Model</label>
                  <select
                    className="form-select"
                    value={formData.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                  >
                    <option value="yolov8n">YOLOv8 Nano (Ultra-fast / Low Resource)</option>
                    <option value="yolov8s">YOLOv8 Small (Balanced Accuracy & Speed)</option>
                    <option value="yolov8m">YOLOv8 Medium (High Precision / GPU)</option>
                    <option value="yolov8x">YOLOv8 Extra-Large (Maximum Precision)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Compute Target Device</label>
                  <select
                    className="form-select"
                    value={formData.device}
                    onChange={(e) => handleChange('device', e.target.value)}
                  >
                    <option value="CUDA:0">CUDA:0 (NVIDIA Primary GPU)</option>
                    <option value="CUDA:1">CUDA:1 (NVIDIA Secondary GPU)</option>
                    <option value="CPU">CPU Multi-threading (Fallback)</option>
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Confidence Threshold</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600 }}>
                      {Math.round(formData.confidenceThreshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.95"
                    step="0.05"
                    value={formData.confidenceThreshold}
                    onChange={(e) => handleChange('confidenceThreshold', parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-tertiary)', cursor: 'pointer' }}
                  />
                  <span className="form-helper">Recommended: 50% - 60% for person detection</span>
                </div>

                {/* Connection Test Diagnostics Box */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', backgroundColor: 'var(--color-neutral)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-secondary)' }}>
                      STREAM HANDSHAKE TEST
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleTestConnection}
                      disabled={testState.testing}
                    >
                      {testState.testing ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
                      <span>{testState.testing ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>

                  {testState.tested && (
                    <div
                      style={{
                        padding: '0.5rem',
                        backgroundColor: testState.success ? 'rgba(0, 163, 108, 0.08)' : 'rgba(217, 56, 58, 0.08)',
                        border: `1px solid ${testState.success ? 'rgba(0, 163, 108, 0.3)' : 'rgba(217, 56, 58, 0.3)'}`,
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.4rem',
                      }}
                    >
                      {testState.success ? (
                        <CheckCircle2 size={14} color="var(--color-tertiary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      ) : (
                        <AlertCircle size={14} color="var(--color-status-error)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      )}
                      <div>
                        <div style={{ color: testState.success ? 'var(--color-tertiary)' : 'var(--color-status-error)', fontWeight: 600 }}>
                          {testState.success ? `SUCCESS (Ping: ${testState.latencyMs}ms)` : 'CONNECTION FAILED'}
                        </div>
                        <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}>
                          {testState.message}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {cameraToEdit ? 'Save Changes' : 'Register & Connect Camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

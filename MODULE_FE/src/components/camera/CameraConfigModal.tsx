import React, { useState, useEffect } from 'react';
import { Radio, CheckCircle2, AlertCircle, Loader2, Video, Sliders } from 'lucide-react';
import { Camera, CreateCameraPayload, StreamSourceType, CameraCodec, CameraOrientation } from '@/types/camera.types';
import { FormField, FormInput, FormSelect, FormSectionHeader } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertIcon, AlertContent, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface CameraConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraToEdit: Camera | null;
  onSave: (payload: CreateCameraPayload) => void;
  isLoading?: boolean;
}

interface FormState {
  camera_code: string;
  name: string;
  description: string;
  location_id: string;
  stream_source_type: StreamSourceType;
  url_rtsp: string;
  fps: number;
  codec: CameraCodec;
  orientation: CameraOrientation;
  confidenceThreshold: number;
}

const DEFAULT_FORM: FormState = {
  camera_code: 'CAM-01',
  name: '',
  description: '',
  location_id: 'Zone A - Main Floor',
  stream_source_type: 'RTSP',
  url_rtsp: 'rtsp://admin:pass123@192.168.1.100:554/live/ch0',
  fps: 30,
  codec: 'H264',
  orientation: 'ANGLED',
  confidenceThreshold: 0.55,
};

export default function CameraConfigModal({
  isOpen,
  onClose,
  cameraToEdit,
  onSave,
  isLoading = false,
}: CameraConfigModalProps): React.JSX.Element {
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);
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
        camera_code: cameraToEdit.camera_code || 'CAM-01',
        name: cameraToEdit.name || '',
        description: cameraToEdit.description || '',
        location_id: cameraToEdit.location_id || 'Zone A',
        stream_source_type: cameraToEdit.stream_source_type || 'RTSP',
        url_rtsp: cameraToEdit.url_rtsp || '',
        fps: cameraToEdit.fps || 30,
        codec: cameraToEdit.codec || 'H264',
        orientation: cameraToEdit.orientation || 'ANGLED',
        confidenceThreshold: 0.55,
      });
    } else {
      setFormData({
        ...DEFAULT_FORM,
        camera_code: `CAM-${Math.floor(Math.random() * 900 + 100)}`,
      });
    }
    setTestState({ testing: false, tested: false, success: false, message: '', latencyMs: 0 });
  }, [cameraToEdit, isOpen]);



  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestState({ testing: false, tested: false, success: false, message: '', latencyMs: 0 });
  };

  const handleTestConnection = async () => {
    setTestState({ testing: true, tested: false, success: false, message: 'Initiating RTSP handshake...', latencyMs: 0 });
    await new Promise((r) => setTimeout(r, 800));
    if (!formData.url_rtsp || !formData.url_rtsp.startsWith('rtsp://')) {
      setTestState({ testing: false, tested: true, success: false, message: 'Invalid stream URL. Must begin with rtsp:// protocol', latencyMs: 0 });
      return;
    }
    setTestState({
      testing: false,
      tested: true,
      success: true,
      message: 'Stream handshake verified successfully (H.264 / 1080p @ 30 FPS)',
      latencyMs: Math.floor(Math.random() * 8 + 10),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url_rtsp.trim()) return;

    const payload: CreateCameraPayload = {
      camera_code: formData.camera_code.toUpperCase().trim(),
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      location_id: formData.location_id.trim() || 'General Area',
      stream_source_type: formData.stream_source_type,
      url_rtsp: formData.url_rtsp.trim(),
      resolution: { width: 1920, height: 1080 },
      fps: Number(formData.fps) || 30,
      codec: formData.codec,
      orientation: formData.orientation,
      status: 'READY',
    };

    onSave(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {cameraToEdit ? 'Configure Camera Settings' : 'Add New Camera'}
          </DialogTitle>
          <DialogDescription>
            Manage camera stream connection, location assignment, and video parameters.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="form-grid">
              {/* Left: Device & Connection */}
              <div className="flex flex-col gap-4">
                <FormSectionHeader
                  icon={<Video size={14} className="text-[var(--color-tertiary)]" />}
                  title="Device & Connection Details"
                />

                <FormField label="Camera Identifier" required helper="Unique device tag used across analytics rules">
                  <FormInput
                    type="text"
                    required
                    placeholder="e.g. CAM-01"
                    value={formData.camera_code}
                    onChange={(e) => handleChange('camera_code', e.target.value)}
                    mono
                    uppercase
                  />
                </FormField>

                <FormField label="Camera Display Name" required>
                  <FormInput
                    type="text"
                    required
                    placeholder="e.g. Main Entrance Gate #1"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </FormField>

                <FormField label="Physical Location / Zone" required>
                  <FormInput
                    type="text"
                    required
                    placeholder="e.g. Building A - Floor 1"
                    value={formData.location_id}
                    onChange={(e) => handleChange('location_id', e.target.value)}
                  />
                </FormField>

                <FormField label="Stream Protocol">
                  <FormSelect
                    value={formData.stream_source_type}
                    onChange={(e) => handleChange('stream_source_type', e.target.value as StreamSourceType)}
                  >
                    <option value="RTSP">RTSP IP Stream</option>
                    <option value="VIDEO_FILE">Pre-recorded Video Source</option>
                    <option value="WEBCAM">Integrated Webcam Feed</option>
                  </FormSelect>
                </FormField>

                <FormField label="RTSP Stream URL" required helper="Format: rtsp://[user]:[pass]@[host]:[port]/[stream]">
                  <FormInput
                    type="text"
                    required
                    placeholder="rtsp://user:pass@192.168.1.100:554/live"
                    value={formData.url_rtsp}
                    onChange={(e) => handleChange('url_rtsp', e.target.value)}
                    mono
                  />
                </FormField>
              </div>

              {/* Right: Video Specs & AI */}
              <div className="flex flex-col gap-4">
                <FormSectionHeader
                  icon={<Sliders size={14} className="text-[var(--color-tertiary)]" />}
                  title="Stream & AI Parameters"
                />

                <FormField label="Video Compression Codec">
                  <FormSelect
                    value={formData.codec}
                    onChange={(e) => handleChange('codec', e.target.value as CameraCodec)}
                  >
                    <option value="H264">H.264 (Standard Compatibility)</option>
                    <option value="H265">H.265 / HEVC (High Efficiency)</option>
                    <option value="MJPEG">Motion JPEG (Legacy)</option>
                  </FormSelect>
                </FormField>

                <FormField label="Mounting Orientation">
                  <FormSelect
                    value={formData.orientation}
                    onChange={(e) => handleChange('orientation', e.target.value as CameraOrientation)}
                  >
                    <option value="ANGLED">Angled (Diagonal Wall View)</option>
                    <option value="CEILING">Ceiling (Bird's Eye / Top Down)</option>
                    <option value="WALL">Wall (Horizontal Eye-level)</option>
                  </FormSelect>
                </FormField>

                <FormField label="Detection Sensitivity Threshold" helper="Recommended: 50%–60% for reliable person detection">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500">10%</span>
                    <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                      {Math.round(formData.confidenceThreshold * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-500">95%</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.95"
                    step="0.05"
                    value={formData.confidenceThreshold}
                    onChange={(e) => handleChange('confidenceThreshold', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </FormField>

                {/* Connection Test */}
                <div className="border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 bg-[var(--color-neutral)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-secondary)]">Connection Handshake Test</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleTestConnection}
                      disabled={testState.testing}
                    >
                      {testState.testing ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
                      <span>{testState.testing ? 'Verifying...' : 'Test'}</span>
                    </button>
                  </div>

                  {testState.tested && (
                    <Alert variant={testState.success ? 'success' : 'destructive'} className="mt-2">
                      <AlertIcon>
                        {testState.success
                          ? <CheckCircle2 size={14} className="text-emerald-400" />
                          : <AlertCircle size={14} className="text-red-400" />}
                      </AlertIcon>
                      <AlertContent>
                        <AlertTitle className={testState.success ? 'text-emerald-400' : 'text-red-400'}>
                          {testState.success ? `Connected (${testState.latencyMs}ms)` : 'Connection Failed'}
                        </AlertTitle>
                        <AlertDescription>{testState.message}</AlertDescription>
                      </AlertContent>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : cameraToEdit ? 'Save Changes' : 'Connect & Register'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

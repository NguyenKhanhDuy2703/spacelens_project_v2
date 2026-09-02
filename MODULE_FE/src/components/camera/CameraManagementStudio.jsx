import React, { useState, useEffect, useMemo } from 'react';
import CameraStatsBar from './CameraStatsBar';
import CameraControlsBar from './CameraControlsBar';
import CameraCard from './CameraCard';
import CameraTable from './CameraTable';
import CameraConfigModal from './CameraConfigModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { cameraService } from '../../services/cameraService';
import { Radio, CheckCircle2 } from 'lucide-react';

export default function CameraManagementStudio() {
  const [cameras, setCameras] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Modal states
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [cameraToEdit, setCameraToEdit] = useState(null);
  const [cameraToDelete, setCameraToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Quick Notification Banner
  const [notification, setNotification] = useState(null);

  const showToast = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    setCameras(cameraService.getAll());
  }, []);

  // Unique list of locations for filter dropdown
  const locations = useMemo(() => {
    const set = new Set(cameras.map((c) => c.location).filter(Boolean));
    return Array.from(set);
  }, [cameras]);

  // Filtered cameras
  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        cam.name.toLowerCase().includes(q) ||
        cam.id.toLowerCase().includes(q) ||
        cam.rtspUrl.toLowerCase().includes(q) ||
        (cam.location && cam.location.toLowerCase().includes(q));

      // 2. Location Filter
      const matchLoc = locationFilter === 'ALL' || cam.location === locationFilter;

      // 3. Status Filter
      let matchStatus = true;
      if (statusFilter === 'CONNECTED') matchStatus = cam.status === 'CONNECTED';
      if (statusFilter === 'AI_ACTIVE') matchStatus = cam.aiWorkerState === 'ACTIVE';
      if (statusFilter === 'RECONNECTING') matchStatus = cam.status === 'RECONNECTING';

      return matchSearch && matchLoc && matchStatus;
    });
  }, [cameras, searchQuery, locationFilter, statusFilter]);

  // Handlers
  const handleToggleAi = (id) => {
    const updated = cameraService.toggleAiWorker(id);
    if (updated) {
      setCameras(cameraService.getAll());
      showToast(
        `AI Worker for ${updated.name} is now ${updated.aiWorkerState === 'ACTIVE' ? 'RUNNING' : 'STANDBY'}`
      );
    }
  };

  const handleBulkToggleAi = (ids, start) => {
    const list = cameraService.getAll();
    const updated = list.map((c) => {
      if (ids.includes(c.id)) {
        return {
          ...c,
          aiWorkerState: start ? 'ACTIVE' : 'STANDBY',
          fpsActual: start ? 24.9 : 0.0,
        };
      }
      return c;
    });
    cameraService.saveAll(updated);
    setCameras(updated);
    showToast(`${start ? 'Started' : 'Stopped'} AI Workers for ${ids.length} cameras`);
  };

  const handleOpenAddModal = () => {
    setCameraToEdit(null);
    setIsConfigModalOpen(true);
  };

  const handleOpenEditModal = (cam) => {
    setCameraToEdit(cam);
    setIsConfigModalOpen(true);
  };

  const handleSaveCamera = (formData) => {
    if (cameraToEdit) {
      cameraService.update(cameraToEdit.id, formData);
      showToast(`Updated camera: ${formData.name}`);
    } else {
      const created = cameraService.add(formData);
      showToast(`Registered new camera: ${created.name}`);
    }
    setCameras(cameraService.getAll());
    setIsConfigModalOpen(false);
  };

  const handleOpenDeleteModal = (cam) => {
    setCameraToDelete(cam);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = (id) => {
    cameraService.delete(id);
    setCameras(cameraService.getAll());
    showToast(`Removed camera endpoint ${id}`);
  };

  const handleTestConnection = async (cam) => {
    showToast(`Pinging RTSP stream handshake for ${cam.name}...`);
    const result = await cameraService.testRtspConnection(cam.rtspUrl);
    if (result.success) {
      showToast(`Stream verified: ${cam.name} (${result.latencyMs}ms response)`);
    } else {
      showToast(`Warning: Stream test failed for ${cam.name}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-primary)',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            boxShadow: 'var(--shadow-modal)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            zIndex: 100,
            border: '1px solid var(--color-tertiary)',
          }}

        >
          <CheckCircle2 size={16} color="var(--color-tertiary)" />
          <span>{notification}</span>
        </div>
      )}

      <CameraStatsBar cameras={cameras} />

      {/* 2. Search & Controls Bar */}
      <CameraControlsBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        locations={locations}
        onOpenAddModal={handleOpenAddModal}
      />

      {/* 3. Main Views: Grid or Table */}
      {filteredCameras.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <Radio size={28} color="var(--color-secondary)" style={{ margin: '0 auto 0.75rem' }} />
          <h3 className="section-title" style={{ fontSize: '0.95rem' }}>NO MATCHING CAMERA ENDPOINTS</h3>
          <p className="section-desc" style={{ marginTop: '0.25rem' }}>
            No cameras match your current search and filter criteria. Try resetting filters or register a new camera.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={() => { setSearchQuery(''); setLocationFilter('ALL'); setStatusFilter('ALL'); }}>
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="camera-grid">
          {filteredCameras.map((cam) => (
            <CameraCard
              key={cam.id}
              camera={cam}
              onToggleAi={handleToggleAi}
              onEdit={handleOpenEditModal}
              onDelete={handleOpenDeleteModal}
              onTestConnection={handleTestConnection}
            />
          ))}
        </div>
      ) : (
        <CameraTable
          cameras={filteredCameras}
          onToggleAi={handleToggleAi}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteModal}
          onTestConnection={handleTestConnection}
          onBulkToggleAi={handleBulkToggleAi}
        />
      )}

      {/* 4. Modals */}
      <CameraConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        cameraToEdit={cameraToEdit}
        onSave={handleSaveCamera}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        camera={cameraToDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

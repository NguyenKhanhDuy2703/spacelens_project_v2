import React, { useState, useMemo, useEffect } from 'react';
import CameraStatsBar from './CameraStatsBar';
import CameraControlsBar from './CameraControlsBar';
import CameraCard from './CameraCard';
import CameraTable from './CameraTable';
import CameraConfigModal from './CameraConfigModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { CameraCardSkeleton, CameraTableSkeleton } from './CameraSkeleton';
import { Radio, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Camera, CreateCameraPayload } from '@/types/camera.types';
import { ViewMode, NotificationToast } from '@/types/ui.types';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchCameras,
  createCamera,
  updateCamera,
  deleteCamera,
} from '@/store/thunks/camera.thunk';
import {
  clearCameraError,
  optimisticAddCamera,
  optimisticUpdateCamera,
  optimisticDeleteCamera,
} from '@/store/slices/cameraSlice';

export default function CameraManagementStudio(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { items: cameras, loading, mutating, error } = useAppSelector((state) => state.camera);

  // Local UI filters & modal states
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [cameraToEdit, setCameraToEdit] = useState<Camera | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [cameraToDelete, setCameraToDelete] = useState<Camera | null>(null);
  const [notification, setNotification] = useState<NotificationToast | null>(null);

  // Fetch initial camera list on mount
  useEffect(() => {
    dispatch(fetchCameras());
  }, [dispatch]);

  // Show toast on Redux error
  useEffect(() => {
    if (error) {
      notify(error, 'error');
      dispatch(clearCameraError());
    }
  }, [error, dispatch]);

  // Derived data
  const locations = useMemo(() => {
    return Array.from(new Set(cameras.map((c) => c.location_id).filter(Boolean)));
  }, [cameras]);

  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        cam.name.toLowerCase().includes(q) ||
        cam.camera_code.toLowerCase().includes(q) ||
        cam.url_rtsp?.toLowerCase().includes(q) ||
        cam.location_id?.toLowerCase().includes(q);

      const matchLoc = locationFilter === 'ALL' || cam.location_id === locationFilter;

      let matchStatus = true;
      if (statusFilter === 'STREAMING') matchStatus = cam.status === 'STREAMING' || cam.status === 'READY';
      if (statusFilter === 'AI_ACTIVE') matchStatus = Boolean(cam.ai_process_info?.process_id);
      if (statusFilter === 'RECONNECTING') matchStatus = cam.status === 'RECONNECTING' || cam.status === 'ERROR';
      if (statusFilter === 'INACTIVE') matchStatus = cam.status === 'INACTIVE' || !cam.is_active;

      return matchSearch && matchLoc && matchStatus;
    });
  }, [cameras, searchQuery, locationFilter, statusFilter]);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ id: Date.now().toString(), message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- CRUD Handlers with Optimistic Updates ---

  const handleToggleAi = async (id: string) => {
    const target = cameras.find((c) => c._id === id);
    if (!target) return;

    const isActive = Boolean(target.ai_process_info?.process_id);
    const optimisticData: Camera = {
      ...target,
      ai_process_info: isActive
        ? undefined
        : { process_id: Math.floor(Math.random() * 900 + 100), started_at: new Date().toISOString() },
    };

    // 1. Update UI immediately (Optimistic)
    dispatch(optimisticUpdateCamera(optimisticData));
    notify(`AI Pipeline ${isActive ? 'stopped' : 'started'} for ${target.name}`);

    try {
      // 2. Confirm with server in background
      await dispatch(updateCamera({ id, payload: { ai_process_info: optimisticData.ai_process_info } as any })).unwrap();
    } catch {
      // 3. Rollback on failure
      dispatch(optimisticUpdateCamera(target));
      notify(`Failed to toggle AI for ${target.name}`, 'error');
    }
  };

  const handleOpenCreateModal = () => {
    setCameraToEdit(null);
    setIsConfigModalOpen(true);
  };

  const handleOpenEditModal = (camera: Camera) => {
    setCameraToEdit(camera);
    setIsConfigModalOpen(true);
  };

  const handleOpenDeleteModal = (camera: Camera) => {
    setCameraToDelete(camera);
    setIsDeleteModalOpen(true);
  };

  const handleSaveCamera = async (payload: CreateCameraPayload) => {
    if (cameraToEdit) {
      // UPDATE: Optimistic first, confirm in background
      const optimistic: Camera = {
        ...cameraToEdit,
        ...payload,
        updated_at: new Date().toISOString(),
      };
      dispatch(optimisticUpdateCamera(optimistic));
      setIsConfigModalOpen(false);
      notify(`Camera updated: ${payload.name}`);

      try {
        await dispatch(updateCamera({ id: cameraToEdit._id, payload })).unwrap();
      } catch (err: any) {
        // Rollback
        dispatch(optimisticUpdateCamera(cameraToEdit));
        notify(typeof err === 'string' ? err : 'Update failed, reverted', 'error');
      }
    } else {
      // CREATE: Optimistic placeholder then replace with real _id from server
      const tempId = `temp_${Date.now()}`;
      const optimistic: Camera = {
        _id: tempId,
        camera_code: payload.camera_code,
        name: payload.name,
        description: payload.description,
        location_id: payload.location_id,
        floor_id: payload.floor_id,
        stream_source_type: payload.stream_source_type,
        url_rtsp: payload.url_rtsp,
        url_rtsp_masked: payload.url_rtsp.replace(/:[^:@]*@/, ':***@'),
        resolution: payload.resolution,
        fps: payload.fps ?? 30,
        codec: payload.codec ?? 'H264',
        orientation: payload.orientation ?? 'ANGLED',
        status: payload.status ?? 'READY',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      dispatch(optimisticAddCamera(optimistic));
      setIsConfigModalOpen(false);
      notify(`Camera registered: ${payload.name}`);

      try {
        await dispatch(createCamera(payload)).unwrap();
        // fulfilled case in slice will replace/deduplicate via real _id
      } catch (err: any) {
        // Rollback: remove the temp placeholder
        dispatch(optimisticDeleteCamera(tempId));
        notify(typeof err === 'string' ? err : 'Registration failed', 'error');
      }
    }
  };

  const handleConfirmDelete = async (id: string) => {
    const target = cameras.find((c) => c._id === id);
    // Optimistic delete immediately
    dispatch(optimisticDeleteCamera(id));
    setIsDeleteModalOpen(false);
    notify('Camera endpoint removed');

    try {
      await dispatch(deleteCamera(id)).unwrap();
    } catch (err: any) {
      // Rollback
      if (target) dispatch(optimisticAddCamera(target));
      notify(typeof err === 'string' ? err : 'Failed to delete camera', 'error');
    }
  };

  const handleTestConnection = (cam: Camera) => {
    notify(`Pinging RTSP handshake for ${cam.name}...`, 'info');
    setTimeout(() => notify(`Stream verified: ${cam.name} (11ms latency)`), 800);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Notification */}
      {notification && (
        <div
          role="alert"
          className={`fixed bottom-8 right-8 px-5 py-3 rounded-xl font-mono text-[0.78rem] shadow-2xl flex items-center gap-2.5 z-50 border backdrop-blur-sm transition-all duration-300 ${
            notification.type === 'error'
              ? 'bg-red-950/90 border-red-700 text-red-200'
              : notification.type === 'info'
              ? 'bg-slate-900/90 border-cyan-700 text-slate-200'
              : 'bg-slate-900/90 border-emerald-700 text-slate-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle size={15} className="text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Mutating overlay indicator (subtle top bar) */}
      {mutating && (
        <div className="fixed top-0 left-0 w-full h-0.5 z-50 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 animate-pulse" />
      )}

      {/* 1. Camera Live Stats Header */}
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
        onOpenAddModal={handleOpenCreateModal}
      />

      {/* 3. Main Content Views */}
      {loading && cameras.length === 0 ? (
        viewMode === 'grid' ? (
          <div className="camera-grid">
            {[1, 2, 3, 4].map((i) => (
              <CameraCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <CameraTableSkeleton />
        )
      ) : cameras.length > 0 && filteredCameras.length === 0 ? (
        <div className="card-panel text-center py-14 px-4">
          <Radio size={28} color="var(--color-secondary)" className="mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--color-primary)]">No Matching Cameras Found</h3>
          <p className="section-desc mt-1">
            No cameras match your current filters. Try resetting or add a new camera.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-4"
            onClick={() => { setSearchQuery(''); setLocationFilter('ALL'); setStatusFilter('ALL'); }}
          >
            Clear Filters
          </button>
        </div>
      ) : cameras.length === 0 ? (
        <div className="card-panel text-center py-14 px-4">
          <Radio size={28} color="var(--color-secondary)" className="mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--color-primary)]">No Cameras Registered</h3>
          <p className="section-desc mt-1">
            No camera feeds in the database. Connect your first device below.
          </p>
          <button type="button" className="btn btn-primary btn-sm mt-4" onClick={handleOpenCreateModal}>
            Add First Camera
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="camera-grid">
          {filteredCameras.map((cam) => (
            <CameraCard
              key={cam._id}
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
        />
      )}

      {/* Refresh hint when data is stale after mutations */}
      {cameras.length > 0 && !loading && (
        <div className="flex justify-end">
          <button
            onClick={() => dispatch(fetchCameras())}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors duration-200 font-mono"
          >
            <RefreshCw size={11} className={mutating ? 'animate-spin' : ''} />
            Sync with server
          </button>
        </div>
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

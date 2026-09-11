import { describe, it, expect } from 'vitest';
import {
  cameraSlice,
  optimisticAddCamera,
  optimisticUpdateCamera,
  optimisticDeleteCamera,
  setSelectedCamera,
  clearCameraError,
  CameraState,
} from '../../store/slices/cameraSlice';
import { Camera } from '../../types/camera.types';

describe('Frontend Redux: cameraSlice Business Logic Tests', () => {
  const mockCamera1: Camera = {
    _id: 'cam-1',
    name: 'Gate Entrance 1',
    camera_code: 'CAM_GATE_01',
    rtsp_url: 'rtsp://192.168.1.10:554/live',
    status: 'STREAMING',
    is_active: true,
    location_id: 'Zone A',
    resolution: '1080p',
    fps: 30,
    created_at: '2026-09-11T00:00:00.000Z',
    updated_at: '2026-09-11T00:00:00.000Z',
  };

  const mockCamera2: Camera = {
    _id: 'cam-2',
    name: 'Parking Lot B',
    camera_code: 'CAM_PARK_02',
    rtsp_url: 'rtsp://192.168.1.11:554/live',
    status: 'INACTIVE',
    is_active: false,
    location_id: 'Zone B',
    resolution: '4K',
    fps: 60,
    created_at: '2026-09-11T00:00:00.000Z',
    updated_at: '2026-09-11T00:00:00.000Z',
  };

  it('Rule 1: Should return correct initial state', () => {
    const state = cameraSlice.reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({
      items: [],
      selectedCamera: null,
      loading: false,
      mutating: false,
      error: null,
      meta: null,
    });
  });

  it('Rule 2 (Optimistic Add): Should insert new camera at the beginning of the list', () => {
    const prevState: CameraState = {
      items: [mockCamera2],
      selectedCamera: null,
      loading: false,
      mutating: false,
      error: null,
      meta: null,
    };

    const nextState = cameraSlice.reducer(prevState, optimisticAddCamera(mockCamera1));
    expect(nextState.items.length).toBe(2);
    expect(nextState.items[0]).toEqual(mockCamera1); // Đảm bảo đưa lên đầu (unshift)
  });

  it('Rule 3 (Optimistic Update): Should update existing camera matching _id', () => {
    const prevState: CameraState = {
      items: [mockCamera1, mockCamera2],
      selectedCamera: mockCamera1,
      loading: false,
      mutating: false,
      error: null,
      meta: null,
    };

    const updatedCamera1: Camera = {
      ...mockCamera1,
      name: 'Gate Entrance 1 - Renovated',
      status: 'AI_ACTIVE',
    };

    const nextState = cameraSlice.reducer(prevState, optimisticUpdateCamera(updatedCamera1));
    expect(nextState.items[0].name).toBe('Gate Entrance 1 - Renovated');
    expect(nextState.items[0].status).toBe('AI_ACTIVE');
    expect(nextState.selectedCamera?.name).toBe('Gate Entrance 1 - Renovated');
  });

  it('Rule 4 (Optimistic Delete): Should remove camera from items and clear selectedCamera if matching', () => {
    const prevState: CameraState = {
      items: [mockCamera1, mockCamera2],
      selectedCamera: mockCamera1,
      loading: false,
      mutating: false,
      error: null,
      meta: null,
    };

    const nextState = cameraSlice.reducer(prevState, optimisticDeleteCamera('cam-1'));
    expect(nextState.items.length).toBe(1);
    expect(nextState.items.find((c) => c._id === 'cam-1')).toBeUndefined();
    expect(nextState.selectedCamera).toBeNull();
  });

  it('Rule 5 (Error State): Should clear error message when clearCameraError dispatched', () => {
    const prevState: CameraState = {
      items: [],
      selectedCamera: null,
      loading: false,
      mutating: false,
      error: 'Network request failed',
      meta: null,
    };

    const nextState = cameraSlice.reducer(prevState, clearCameraError());
    expect(nextState.error).toBeNull();
  });

  it('Rule 6 (Selection): Should set selected camera correctly', () => {
    const prevState: CameraState = {
      items: [mockCamera1],
      selectedCamera: null,
      loading: false,
      mutating: false,
      error: null,
      meta: null,
    };

    const nextState = cameraSlice.reducer(prevState, setSelectedCamera(mockCamera1));
    expect(nextState.selectedCamera).toEqual(mockCamera1);
  });
});

import { createAsyncThunk } from '@reduxjs/toolkit';
import { CameraQueryParams, CreateCameraPayload, UpdateCameraPayload } from '@/types/camera.types';
import * as cameraService from '@/services/cameraService';

// 1. Fetch cameras thunk
export const fetchCameras = createAsyncThunk(
  'cameras/fetchCameras',
  async (params: CameraQueryParams | undefined, { rejectWithValue }) => {
    try {
      const response = await cameraService.fetchCameras(params);
      return response;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch camera list';
      return rejectWithValue(message);
    }
  }
);

// 2. Fetch camera by ID thunk
export const fetchCameraById = createAsyncThunk(
  'cameras/fetchCameraById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await cameraService.fetchCameraById(id);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch camera details';
      return rejectWithValue(message);
    }
  }
);

// 3. Create camera thunk
export const createCamera = createAsyncThunk(
  'cameras/createCamera',
  async (payload: CreateCameraPayload, { rejectWithValue }) => {
    try {
      const response = await cameraService.createCamera(payload);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to register new camera';
      return rejectWithValue(message);
    }
  }
);

// 4. Update camera thunk
export const updateCamera = createAsyncThunk(
  'cameras/updateCamera',
  async ({ id, payload }: { id: string; payload: UpdateCameraPayload }, { rejectWithValue }) => {
    try {
      const response = await cameraService.updateCamera(id, payload);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to update camera';
      return rejectWithValue(message);
    }
  }
);

// 5. Delete camera thunk
export const deleteCamera = createAsyncThunk(
  'cameras/deleteCamera',
  async (id: string, { rejectWithValue }) => {
    try {
      await cameraService.deleteCamera(id);
      return id;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to delete camera';
      return rejectWithValue(message);
    }
  }
);
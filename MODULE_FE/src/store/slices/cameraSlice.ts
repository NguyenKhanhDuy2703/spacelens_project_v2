import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Camera } from '@/types/camera.types';
import { PaginationMeta } from '@/types/api.types';
import {
  fetchCameras,
  fetchCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
} from '../thunks/camera.thunk';

export interface CameraState {
  items: Camera[];
  selectedCamera: Camera | null;
  loading: boolean;
  mutating: boolean; 
  error: string | null;
  meta: PaginationMeta | null;
}

const initialState: CameraState = {
  items: [],
  selectedCamera: null,
  loading: false,
  mutating: false,
  error: null,
  meta: null,
};

export const cameraSlice = createSlice({
  name: 'camera',
  initialState,
  reducers: {
    // Sync actions for optimistic updates
    optimisticAddCamera: (state, action: PayloadAction<Camera>) => {
      state.items.unshift(action.payload);
    },
    optimisticUpdateCamera: (state, action: PayloadAction<Camera>) => {
      const index = state.items.findIndex((c) => c._id === action.payload._id);
      if (index !== -1) state.items[index] = action.payload;
      if (state.selectedCamera?._id === action.payload._id) {
        state.selectedCamera = action.payload;
      }
    },
    optimisticDeleteCamera: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((c) => c._id !== action.payload);
      if (state.selectedCamera?._id === action.payload) {
        state.selectedCamera = null;
      }
    },
    setSelectedCamera: (state, action: PayloadAction<Camera | null>) => {
      state.selectedCamera = action.payload;
    },
    clearCameraError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 1. Fetch Cameras (full list reload)
      .addCase(fetchCameras.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCameras.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data ?? [];
        // meta may be {} (empty object) when no pagination — normalize to null
        const meta = action.payload.meta;
        state.meta = meta && 'totalItems' in meta ? (meta as PaginationMeta) : null;
      })
      .addCase(fetchCameras.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to fetch camera list';
      })

      // 2. Fetch Camera By ID
      .addCase(fetchCameraById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCameraById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCamera = action.payload;
      })
      .addCase(fetchCameraById.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to fetch camera details';
      })

      // 3. Create Camera (sync update already done via optimisticAddCamera)
      .addCase(createCamera.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createCamera.fulfilled, (state, action) => {
        state.mutating = false;
        // Replace the optimistic placeholder with the real server response
        const idx = state.items.findIndex((c) => c._id === action.payload._id);
        if (idx === -1) {
          state.items.unshift(action.payload);
        } else {
          state.items[idx] = action.payload;
        }
      })
      .addCase(createCamera.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to register camera';
      })

      // 4. Update Camera
      .addCase(updateCamera.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateCamera.fulfilled, (state, action) => {
        state.mutating = false;
        const index = state.items.findIndex((c) => c._id === action.payload._id);
        if (index !== -1) state.items[index] = action.payload;
        if (state.selectedCamera?._id === action.payload._id) {
          state.selectedCamera = action.payload;
        }
      })
      .addCase(updateCamera.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to update camera';
      })

      // 5. Delete Camera
      .addCase(deleteCamera.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteCamera.fulfilled, (state, action) => {
        state.mutating = false;
        state.items = state.items.filter((c) => c._id !== action.payload);
        if (state.selectedCamera?._id === action.payload) {
          state.selectedCamera = null;
        }
      })
      .addCase(deleteCamera.rejected, (state, action) => {
        state.mutating = false;
        state.error = (action.payload as string) || action.error.message || 'Failed to delete camera';
      });
  },
});

export const {
  optimisticAddCamera,
  optimisticUpdateCamera,
  optimisticDeleteCamera,
  setSelectedCamera,
  clearCameraError,
} = cameraSlice.actions;

export default cameraSlice.reducer;

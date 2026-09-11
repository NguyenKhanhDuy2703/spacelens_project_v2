# Plan: Frontend TypeScript Migration & Redux Toolkit Architecture

**Project:** SpaceLens  
**Module:** `MODULE_FE`  
**Target:** Migrate from JavaScript to TypeScript & Introduce Redux Toolkit (RTK + RTK Query) for Global State Management  

---

## 1. Executive Summary & Goals

* **Goal 1 (Type Safety & BE Alignment):** Convert the React SPA from JavaScript to TypeScript (`.ts`/`.tsx`), defining strict interfaces mirroring the NestJS Backend (`MODULE_BE`) schemas, DTOs, and standard response envelopes (`TransformInterceptor`).
* **Goal 2 (State Architecture):** Decouple state management into a clear 3-tier model (Server State, Global UI State, Local Ephemeral State) using Redux Toolkit (`@reduxjs/toolkit` and `react-redux`).
* **Goal 3 (Real API Integration):** Replace offline `localStorage` mock data in `cameraService.js` with live RTK Query endpoints connecting to `http://localhost:3000/api/v1/cameras`.

---

## 2. State Categorization Strategy

| State Category | Tool / Handler | Scope / Responsibilities |
| :--- | :--- | :--- |
| **Global Server State** | **RTK Query** (`cameraApi`) | - Fetching & caching camera list (`GET /api/v1/cameras/all`)<br>- Fetching single camera details (`GET /api/v1/cameras/:id`)<br>- Mutations: `createCamera`, `updateCamera`, `deleteCamera`<br>- Auto cache-tag invalidation (`tagTypes: ['Camera']`)<br>- Periodic polling for health/status updates |
| **Global Client / UI State** | **Redux Slice** (`uiSlice`) | - Active navigation tab (`'devices' \| 'zones' \| 'users' \| 'audits' \| 'settings'`)<br>- Display mode (`'grid' \| 'list'`)<br>- Global filter bar (`searchQuery`, `locationFilter`, `statusFilter`)<br>- Modal visibility & active targets (`isConfigModalOpen`, `cameraToEdit`, `isDeleteModalOpen`, `cameraToDelete`)<br>- Global toast notifications |
| **Local Component State** | **React `useState`** | - Ephemeral form inputs before clicking Save<br>- Local validation errors and button loading spinners<br>- Dropdown toggles and hover tooltips |

---

## 3. Schema & DTO Alignment (Frontend <-> Backend)

The NestJS backend (`MODULE_BE/src/modules/camera/`) defines the following contract:

```typescript
// Base Response Envelope (from NestJS TransformInterceptor)
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Camera Entity
export type StreamSourceType = 'RTSP' | 'VIDEO_FILE' | 'WEBCAM';
export type CameraCodec = 'H264' | 'H265' | 'MJPEG';
export type CameraOrientation = 'CEILING' | 'WALL' | 'ANGLED';
export type CameraStatus =
  | 'INACTIVE'
  | 'READY'
  | 'STARTING'
  | 'STREAMING'
  | 'RECONNECTING'
  | 'STOPPED'
  | 'ERROR'
  | 'ARCHIVED';

export interface Resolution {
  width: number;
  height: number;
}

export interface Camera {
  _id: string;
  camera_code: string;
  name: string;
  description?: string;
  location_id: string;
  floor_id?: string;
  stream_source_type: StreamSourceType;
  url_rtsp: string;
  url_rtsp_masked?: string;
  resolution: Resolution;
  fps: number;
  codec: CameraCodec;
  orientation: CameraOrientation;
  snapshot_url?: string;
  status: CameraStatus;
  last_error_message?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// DTOs for Mutations
export interface CreateCameraPayload {
  camera_code: string;
  name: string;
  description?: string;
  location_id: string;
  floor_id?: string;
  stream_source_type: StreamSourceType;
  url_rtsp: string;
  resolution: Resolution;
  fps?: number;
  codec?: CameraCodec;
  orientation?: CameraOrientation;
  status?: 'INACTIVE' | 'READY';
}

export type UpdateCameraPayload = Partial<CreateCameraPayload>;

export interface CameraQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  location_id?: string;
}
```

---

## 4. Detailed Task Breakdown

### Phase 1: Tooling, Dependencies & TypeScript Setup
- [ ] **Task 1.1:** Install required packages in `MODULE_FE/`:
  - Dependencies: `@reduxjs/toolkit`, `react-redux`
  - DevDependencies: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`
- [ ] **Task 1.2:** Create [`tsconfig.json`](file:///d:/Project_NCKH/spacelensproject/MODULE_FE/tsconfig.json) and [`tsconfig.node.json`](file:///d:/Project_NCKH/spacelensproject/MODULE_FE/tsconfig.node.json) configured for React 18 and Vite.
- [ ] **Task 1.3:** Rename [`vite.config.js`](file:///d:/Project_NCKH/spacelensproject/MODULE_FE/vite.config.js) to `vite.config.ts` and set up path alias `@/` -> `./src/`.

### Phase 2: Type Definitions
- [ ] **Task 2.1:** Create `src/types/api.types.ts` for standard HTTP envelopes & pagination.
- [ ] **Task 2.2:** Create `src/types/camera.types.ts` for camera models, status enums, and mutation DTOs.
- [ ] **Task 2.3:** Create `src/types/ui.types.ts` for UI state types (tabs, view modes, notifications).

### Phase 3: Redux Store & RTK Query Implementation
- [ ] **Task 3.1:** Create `src/store/services/cameraApi.ts`:
  - Base URL configured from `import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'`
  - Endpoints:
    - `getCameras`: `query: (params) => ({ url: '/cameras/all', params })`
    - `getCameraById`: `query: (id) => `/cameras/${id}``
    - `createCamera`: `mutation: (body) => ({ url: '/cameras', method: 'POST', body })`
    - `updateCamera`: `mutation: ({ id, data }) => ({ url: `/cameras/${id}`, method: 'PATCH', body: data })`
    - `deleteCamera`: `mutation: (id) => ({ url: `/cameras/${id}`, method: 'DELETE' })`
  - Tags management: `providesTags: ['Camera']` and `invalidatesTags: ['Camera']`.
- [ ] **Task 3.2:** Create `src/store/slices/uiSlice.ts` for:
  - `activeTab`, `viewMode`, `searchQuery`, `locationFilter`, `statusFilter`
  - Modal control actions: `openConfigModal`, `closeConfigModal`, `openDeleteModal`, `closeDeleteModal`
  - Toast notifications: `setNotification`, `clearNotification`
- [ ] **Task 3.3:** Create `src/store/index.ts`:
  - Combine reducers, configure RTK middleware for caching.
  - Export typed hooks: `useAppDispatch` and `useAppSelector`.

### Phase 4: Component Migration & Redux Integration
- [ ] **Task 4.1:** Update `src/main.tsx` to wrap `<App />` inside `<Provider store={store}>`.
- [ ] **Task 4.2:** Migrate layout components:
  - `src/components/layout/AppLayout.tsx`
  - `src/components/layout/Header.tsx`
  - `src/components/layout/Navigation.tsx`
- [ ] **Task 4.3:** Migrate camera studio components:
  - `src/components/camera/CameraManagementStudio.tsx`: Use `useGetCamerasQuery`, dispatch to `uiSlice`.
  - `src/components/camera/CameraStatsBar.tsx`: Compute totals from real live camera data.
  - `src/components/camera/CameraControlsBar.tsx`: Connect search/filter controls to Redux.
  - `src/components/camera/CameraCard.tsx` & `CameraTable.tsx`: Render real backend camera properties.
  - `src/components/camera/CameraConfigModal.tsx`: Call `createCamera` / `updateCamera` mutations.
  - `src/components/camera/DeleteConfirmModal.tsx`: Call `deleteCamera` mutation.
- [ ] **Task 4.4:** Migrate `src/App.tsx` to `.tsx`.

### Phase 5: Verification & Quality Assurance
- [ ] **Task 5.1:** Run TypeScript compilation check (`npm run build` in `MODULE_FE`) to ensure 0 type errors.
- [ ] **Task 5.2:** Test CRUD flows against live NestJS Backend.
- [ ] **Task 5.3:** Verify cache invalidation (adding/editing/deleting cameras automatically re-syncs the table and stats bar).

---

## 5. Next Steps
Once ready to execute, implementation will proceed sequentially from **Phase 1** to **Phase 5**.

const STORAGE_KEY = 'spacelens_camera_registry_v1';

const INITIAL_CAMERAS = [
  {
    id: 'CAM-001',
    name: 'Main Entrance & Turnstile Gate',
    location: 'Building A - Floor 1',
    rtspUrl: 'rtsp://admin:pass123@192.168.1.101:554/live/ch0',
    streamType: 'RTSP_IP',
    model: 'yolov8s',
    device: 'CUDA:0',
    confidenceThreshold: 0.55,
    status: 'CONNECTED',       // CONNECTED | RECONNECTING | DISCONNECTED
    aiWorkerState: 'ACTIVE',   // ACTIVE | STANDBY | OFF
    resolution: '1920x1080',
    fpsActual: 25.0,
    latencyMs: 11.4,
    zoneCount: 3,
    lastSeen: 'Just now',
  },
  {
    id: 'CAM-002',
    name: 'Checkout Cashier & POS Terminal',
    location: 'Building A - Retail Floor',
    rtspUrl: 'rtsp://admin:pass123@192.168.1.102:554/live/ch0',
    streamType: 'RTSP_IP',
    model: 'yolov8s',
    device: 'CUDA:0',
    confidenceThreshold: 0.50,
    status: 'CONNECTED',
    aiWorkerState: 'STANDBY',
    resolution: '1920x1080',
    fpsActual: 0.0,
    latencyMs: 8.9,
    zoneCount: 4,
    lastSeen: 'Just now',
  },
  {
    id: 'CAM-003',
    name: 'Back Storage & Loading Dock',
    location: 'Warehouse - Area C',
    rtspUrl: 'rtsp://admin:pass123@192.168.1.105:554/live/ch0',
    streamType: 'RTSP_IP',
    model: 'yolov8n',
    device: 'CPU',
    confidenceThreshold: 0.45,
    status: 'RECONNECTING',
    aiWorkerState: 'OFF',
    resolution: '1280x720',
    fpsActual: 0.0,
    latencyMs: 0.0,
    zoneCount: 1,
    lastSeen: '2 mins ago',
  },
  {
    id: 'CAM-004',
    name: 'Product Display & Promotional Aisle',
    location: 'Building A - Retail Floor',
    rtspUrl: 'rtsp://admin:pass123@192.168.1.108:554/live/ch0',
    streamType: 'RTSP_IP',
    model: 'yolov8m',
    device: 'CUDA:0',
    confidenceThreshold: 0.60,
    status: 'CONNECTED',
    aiWorkerState: 'ACTIVE',
    resolution: '1920x1080',
    fpsActual: 24.8,
    latencyMs: 14.2,
    zoneCount: 2,
    lastSeen: 'Just now',
  }
];

export const cameraService = {
  getAll: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to read from localStorage, using initial mock data.', e);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CAMERAS));
    return INITIAL_CAMERAS;
  },

  saveAll: (cameras) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  },

  add: (newCam) => {
    const list = cameraService.getAll();
    const id = `CAM-${String(list.length + 1).padStart(3, '0')}`;
    const camera = {
      id,
      status: 'CONNECTED',
      aiWorkerState: 'STANDBY',
      fpsActual: 0.0,
      latencyMs: 12.0,
      zoneCount: 0,
      lastSeen: 'Just now',
      resolution: '1920x1080',
      ...newCam,
    };
    const updated = [camera, ...list];
    cameraService.saveAll(updated);
    return camera;
  },

  update: (id, data) => {
    const list = cameraService.getAll();
    const updated = list.map((c) => (c.id === id ? { ...c, ...data } : c));
    cameraService.saveAll(updated);
    return updated.find((c) => c.id === id);
  },

  delete: (id) => {
    const list = cameraService.getAll();
    const updated = list.filter((c) => c.id !== id);
    cameraService.saveAll(updated);
    return true;
  },

  toggleAiWorker: (id) => {
    const list = cameraService.getAll();
    const target = list.find((c) => c.id === id);
    if (!target) return null;

    const nextState = target.aiWorkerState === 'ACTIVE' ? 'STANDBY' : 'ACTIVE';
    const nextFps = nextState === 'ACTIVE' ? 24.9 : 0.0;
    
    return cameraService.update(id, {
      aiWorkerState: nextState,
      fpsActual: nextFps,
    });
  },

  testRtspConnection: async (rtspUrl) => {
    // Simulate realistic connection handshake delay (1.2s)
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (!rtspUrl || !rtspUrl.startsWith('rtsp://')) {
      return {
        success: false,
        message: 'Invalid RTSP format. Protocol must start with rtsp://',
        latencyMs: 0,
      };
    }
    return {
      success: true,
      message: 'RTSP stream handshake verified successfully (H.264 / 1080p @ 25fps)',
      latencyMs: Math.floor(Math.random() * 8 + 8),
      resolution: '1920x1080',
    };
  }
};

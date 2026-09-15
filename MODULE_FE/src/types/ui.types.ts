export type TabType = 'devices' | 'zones' | 'users' | 'audits' | 'settings';

export type ViewMode = 'grid' | 'list';

export interface NotificationToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UiState {
  activeTab: TabType;
  viewMode: ViewMode;
  searchQuery: string;
  locationFilter: string;
  statusFilter: string;
  isConfigModalOpen: boolean;
  cameraToEdit: any | null;
  isDeleteModalOpen: boolean;
  cameraToDelete: any | null;
  notification: NotificationToast | null;
}

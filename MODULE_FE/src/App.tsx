import React, { useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import CameraManagementStudio from './components/camera/CameraManagementStudio';
import { Sliders, Users, FileText, Settings } from 'lucide-react';
import { TabType } from './types/ui.types';

export default function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('devices');

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* 1. Camera Devices Management Tab */}
      {activeTab === 'devices' && <CameraManagementStudio />}

      {/* 2. Zone & AI Rule Calibration Studio Tab */}
      {activeTab === 'zones' && (
        <div className="card-panel text-center py-16 px-6">
          <Sliders size={32} color="var(--color-tertiary)" className="mx-auto mb-4" />
          <h2 className="section-title">ZONE & AI RULE CONFIGURATION</h2>
          <p className="section-desc">
            Interactive polygon boundary definition, dwell time thresholding, and tripwire rules per camera.
          </p>
        </div>
      )}

      {/* 3. Users & Permissions Tab */}
      {activeTab === 'users' && (
        <div className="card-panel text-center py-16 px-6">
          <Users size={32} color="var(--color-tertiary)" className="mx-auto mb-4" />
          <h2 className="section-title">USERS & ACCESS PERMISSIONS</h2>
          <p className="section-desc">
            Manage system operator accounts, assign camera viewing permissions, and define role-based access control.
          </p>
        </div>
      )}

      {/* 4. Connection & Audit Logs Tab */}
      {activeTab === 'audits' && (
        <div className="card-panel text-center py-16 px-6">
          <FileText size={32} color="var(--color-tertiary)" className="mx-auto mb-4" />
          <h2 className="section-title">CONNECTION & AUDIT LOGS</h2>
          <p className="section-desc">
            Inspect camera connection logs, reconnection attempts, network stream drops, and user activity history.
          </p>
        </div>
      )}

      {/* 5. System Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card-panel text-center py-16 px-6">
          <Settings size={32} color="var(--color-tertiary)" className="mx-auto mb-4" />
          <h2 className="section-title">SYSTEM SETTINGS</h2>
          <p className="section-desc">
            Configure global application parameters, database persistence retention, and alert notification channels.
          </p>
        </div>
      )}
    </AppLayout>
  );
}

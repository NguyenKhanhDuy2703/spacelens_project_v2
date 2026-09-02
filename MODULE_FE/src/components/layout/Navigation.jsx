import React from 'react';
import { Video, Sliders, Users, FileText, Settings } from 'lucide-react';

export const NAVIGATION_TABS = [
  {
    id: 'devices',
    label: 'Camera Devices',
    icon: Video,
    tag: '8 CONNECTED',
    description: 'Manage camera device registry, IP/RTSP connections & status'
  },
  {
    id: 'zones',
    label: 'Zone Configuration',
    icon: Sliders,
    tag: '14 ZONES',
    description: 'Configure observation polygons, tripwires & behavior rules'
  },
  {
    id: 'users',
    label: 'Users & Permissions',
    icon: Users,
    tag: '5 USERS',
    description: 'Manage user accounts, roles & camera access permissions'
  },
  {
    id: 'audits',
    label: 'Connection Logs',
    icon: FileText,
    tag: 'AUDIT',
    description: 'Review device connection history, errors & user audit logs'
  },
  {
    id: 'settings',
    label: 'System Settings',
    icon: Settings,
    tag: 'CONFIG',
    description: 'Global system configuration, backup & notification parameters'
  }
];

export default function Navigation({ activeTab = 'devices', onTabChange = () => {} }) {
  return (
    <nav className="nav-root">
      <div className="layout-wrapper">
        <div className="nav-tabs-wrapper">
          {NAVIGATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`nav-tab ${isActive ? 'active' : ''}`}
              >
                <Icon size={14} color={isActive ? 'var(--color-tertiary)' : 'var(--color-secondary)'} />
                <span>{tab.label}</span>
                <span className="tab-badge">{tab.tag}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

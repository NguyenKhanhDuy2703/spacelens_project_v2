import React from 'react';
import { Video, Sliders, Users, FileText, Settings, LucideIcon } from 'lucide-react';
import { TabType } from '@/types/ui.types';

export interface NavigationTabItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  tag: string;
  description: string;
}

export const NAVIGATION_TABS: NavigationTabItem[] = [
  {
    id: 'devices',
    label: 'Camera Devices',
    icon: Video,
    tag: 'LIVE FEED',
    description: 'Manage camera device registry, IP/RTSP connections & status',
  },
  {
    id: 'zones',
    label: 'Zone Configuration',
    icon: Sliders,
    tag: 'AI ZONES',
    description: 'Configure observation polygons, tripwires & behavior rules',
  },
  {
    id: 'users',
    label: 'Users & Permissions',
    icon: Users,
    tag: 'ACCESS',
    description: 'Manage user accounts, roles & camera access permissions',
  },
  {
    id: 'audits',
    label: 'Connection Logs',
    icon: FileText,
    tag: 'AUDIT',
    description: 'Review device connection history, errors & user audit logs',
  },
  {
    id: 'settings',
    label: 'System Settings',
    icon: Settings,
    tag: 'CONFIG',
    description: 'Global system configuration, backup & notification parameters',
  },
];

interface NavigationProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export default function Navigation({
  activeTab = 'devices',
  onTabChange = () => {},
}: NavigationProps): React.JSX.Element {
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
                type="button"
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

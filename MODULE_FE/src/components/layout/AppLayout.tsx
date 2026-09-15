import React from 'react';
import Header from './Header';
import Navigation from './Navigation';
import { TabType } from '@/types/ui.types';

interface AppLayoutProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

export default function AppLayout({
  activeTab,
  onTabChange,
  children,
}: AppLayoutProps): React.JSX.Element {
  return (
    <div className="app-container">
      {/* 1. Global Product Header */}
      <Header />

      {/* 2. Navigation Tab Bar */}
      <Navigation activeTab={activeTab} onTabChange={onTabChange} />

      {/* 3. Main Content Studio Area */}
      <main className="main-content">
        <div className="layout-wrapper">{children}</div>
      </main>

      {/* 4. Product Footer */}
      <footer className="footer-root">
        <div className="layout-wrapper">
          <div className="footer-inner">
            <div className="text-xs text-[var(--color-secondary)]">
              © {new Date().getFullYear()} SpaceLens Vision Platform. Spatial Analytics & Monitoring System.
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--color-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--color-tertiary)] inline-block animate-pulse" />
                <span>Services Operational</span>
              </span>
              <span className="text-[var(--color-border)]">•</span>
              <span>Release v2.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

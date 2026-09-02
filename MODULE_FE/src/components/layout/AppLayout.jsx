import React from 'react';
import Header from './Header';
import Navigation from './Navigation';

export default function AppLayout({
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="app-container">
      {/* 1. Global Admin Header */}
      <Header />

      {/* 2. Primary Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={onTabChange} />

      {/* 3. Main Content Area */}
      <main className="main-content">
        <div className="layout-wrapper">
          {children}
        </div>
      </main>

      {/* 4. Global Administrative Footer */}
      <footer className="footer-root">
        <div className="layout-wrapper">
          <div className="footer-inner">
            <div>
              SPACELENS — CAMERA & USER ACCESS ADMINISTRATION PORTAL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.7rem' }}>
              <span>ACTIVE USER: <strong style={{ color: 'var(--color-primary)' }}>KhanhDuy (Super Admin)</strong></span>
              <span>AUTHENTICATION: <strong style={{ color: 'var(--color-tertiary)' }}>JWT SECURE</strong></span>
              <span>DATABASE: <strong style={{ color: 'var(--color-primary)' }}>SQLITE / POSTGRES</strong></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

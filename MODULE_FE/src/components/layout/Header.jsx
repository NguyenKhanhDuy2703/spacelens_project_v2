import React, { useState, useEffect } from 'react';
import { Shield, User, Github } from 'lucide-react';

export default function Header() {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header-root">
      <div className="layout-wrapper">
        <div className="header-inner">
          
          {/* Left: Brand Identity (Graphite System) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div className="brand-badge">SL</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="brand-title">SPACELENS</span>
                  <span style={{ width: '1px', height: '1rem', backgroundColor: 'var(--color-border)', display: 'inline-block' }}></span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-secondary)' }}>ADMIN PORTAL</span>
                </div>
                <div className="brand-sub">
                  DEVICE & USER ACCESS REGISTRY
                </div>
              </div>
            </div>

            <div className="node-chip">
              <Shield size={12} color="var(--color-tertiary)" />
              <span>ROLE: <strong style={{ color: 'var(--color-primary)' }}>SUPER_ADMIN</strong></span>
            </div>
          </div>

          {/* Right: User Profile, Time & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-secondary)', backgroundColor: 'var(--color-neutral)', padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
              {timeStr || '00:00:00 UTC'}
            </div>

            {/* Current Admin User Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', backgroundColor: 'var(--color-neutral)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
              <User size={13} color="var(--color-tertiary)" />
              <span style={{ fontWeight: 500 }}>KhanhDuy (Admin)</span>
            </div>

            <div className="status-pill healthy">
              <span className="status-dot online"></span>
              <span>ONLINE</span>
            </div>

            <a
              href="https://github.com/NguyenKhanhDuy2703/my-skills-agents"
              target="_blank"
              rel="noreferrer"
              style={{ padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-neutral)' }}
              title="Agent Skills Repository"
            >
              <Github size={14} />
            </a>
          </div>

        </div>
      </div>
    </header>
  );
}

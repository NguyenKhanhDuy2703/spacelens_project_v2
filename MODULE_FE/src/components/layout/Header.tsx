import React, { useState, useEffect } from 'react';
import { Shield, User, Github, Clock, Layers } from 'lucide-react';

export default function Header(): React.JSX.Element {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header-root">
      <div className="layout-wrapper">
        <div className="header-inner">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-tertiary)] flex items-center justify-center text-[#0E1013] font-bold shadow-md shadow-[rgba(180,255,57,0.2)]">
                <Layers size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="brand-title tracking-tight font-bold text-base text-[var(--color-primary)]">
                    SpaceLens
                  </span>
                  <span className="w-[1px] h-3.5 bg-[var(--color-border)] inline-block" />
                  <span className="text-xs font-medium text-[var(--color-secondary)]">
                    Vision Studio
                  </span>
                </div>
                <div className="text-[0.7rem] text-[var(--color-secondary)] font-normal tracking-normal">
                  Spatial Intelligence & Camera Management
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[rgba(180,255,57,0.08)] border border-[rgba(180,255,57,0.25)] text-xs text-[var(--color-tertiary)] font-medium">
              <Shield size={11} />
              <span>Super Admin</span>
            </div>
          </div>

          {/* Right: User Profile, Time & Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-secondary)] px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-neutral)] border border-[var(--color-border)]">
              <Clock size={12} className="text-[var(--color-tertiary)]" />
              <span className="font-mono">{timeStr || '--:--:--'}</span>
            </div>

            {/* Current Admin User Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--color-neutral)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-xs text-[var(--color-primary)] font-medium">
              <div className="w-4 h-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                <User size={10} className="text-[var(--color-tertiary)]" />
              </div>
              <span>Khanh Duy</span>
            </div>

            <div className="status-pill healthy">
              <span className="status-dot online" />
              <span>System Live</span>
            </div>

            <a
              href="https://github.com/NguyenKhanhDuy2703/spacelens_project_v2"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-tertiary)] flex items-center justify-center bg-[var(--color-neutral)] transition-colors"
              title="SpaceLens Repository"
            >
              <Github size={14} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

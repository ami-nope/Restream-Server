// ============================================
// Sidebar Component — Navigation
// ============================================

import React from 'react';

export type Page = 'dashboard' | 'destinations' | 'logs' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  streamStatus: 'live' | 'offline';
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'destinations', label: 'Destinations', icon: '🌐' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, streamStatus }) => {
  return (
    <aside className="w-64 border-r border-white/[0.06] bg-surface-950/50 backdrop-blur-xl flex flex-col min-h-0">
      {/* Stream status hero */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="glass-card p-4 text-center">
          {streamStatus === 'live' ? (
            <div className="live-badge mx-auto">
              <span className="status-dot-live" />
              LIVE
            </div>
          ) : (
            <div className="offline-badge mx-auto">
              <span className="status-dot-idle" />
              OFFLINE
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentPage === item.id
                ? 'bg-accent/10 text-accent-light border border-accent/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <p className="text-[10px] text-gray-600 text-center">
          Restream Server v1.0.1
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;

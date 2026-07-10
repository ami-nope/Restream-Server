// ============================================
// Header Component
// ============================================

import React from 'react';

interface HeaderProps {
  wsConnected: boolean;
  streamStatus: 'live' | 'offline';
  onOpenSettings: () => void;
  onOpenAssets: () => void;
}

const Header: React.FC<HeaderProps> = ({ wsConnected, streamStatus, onOpenSettings, onOpenAssets }) => {
  const isLive = streamStatus === 'live';

  return (
    <header className="h-16 border-b border-white/[0.06] bg-surface-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="text-2xl">📡</div>
        <div>
          <h1 className="text-lg font-bold text-gradient">Restream Server</h1>
          <span className="text-[10px] text-gray-500 tracking-widest uppercase">by ami</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* OBS Stream status */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              isLive ? 'bg-live animate-pulse-live' : 'bg-gray-600'
            }`}
          />
          <span className={isLive ? 'text-live font-semibold' : 'text-gray-500'}>
            {isLive ? 'OBS LIVE' : 'OBS Offline'}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10" />

        {/* WebSocket connection indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              wsConnected ? 'bg-accent-light' : 'bg-danger animate-pulse'
            }`}
          />
          <span className={wsConnected ? 'text-gray-500' : 'text-danger'}>
            {wsConnected ? 'WS' : 'WS Lost'}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10" />

        {/* Assets icon */}
        <button
          onClick={onOpenAssets}
          className="text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] p-1.5 rounded-xl transition-all duration-200 text-sm select-none"
          title="Open Assets Manager"
        >
          📁 Assets
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10" />

        {/* Settings gear icon */}
        <button
          onClick={onOpenSettings}
          className="text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] p-1.5 rounded-xl transition-all duration-200 text-sm select-none"
          title="Open Settings"
        >
          ⚙️ Settings
        </button>
      </div>
    </header>
  );
};

export default Header;

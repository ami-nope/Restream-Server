// ============================================
// Header Component
// ============================================

import React from 'react';

interface HeaderProps {
  wsConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ wsConnected }) => {
  return (
    <header className="h-16 border-b border-white/[0.06] bg-surface-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="text-2xl">📡</div>
        <div>
          <h1 className="text-lg font-bold text-gradient">Restream Server</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* WebSocket connection indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              wsConnected ? 'bg-live' : 'bg-danger animate-pulse'
            }`}
          />
          <span className={wsConnected ? 'text-gray-400' : 'text-danger'}>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;

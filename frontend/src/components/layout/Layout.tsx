// ============================================
// Layout Component — App shell
// ============================================

import React from 'react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  streamStatus: 'live' | 'offline';
  wsConnected: boolean;
  onOpenSettings: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  streamStatus,
  wsConnected,
  onOpenSettings,
}) => {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0B0D11]">
      <Header wsConnected={wsConnected} streamStatus={streamStatus} onOpenSettings={onOpenSettings} />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-h-0 flex flex-col p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

// ============================================
// Layout Component — App shell
// ============================================

import React from 'react';
import Header from './Header';
import Sidebar, { Page } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  streamStatus: 'live' | 'offline';
  wsConnected: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  currentPage,
  onNavigate,
  streamStatus,
  wsConnected,
}) => {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header wsConnected={wsConnected} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          currentPage={currentPage}
          onNavigate={onNavigate}
          streamStatus={streamStatus}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

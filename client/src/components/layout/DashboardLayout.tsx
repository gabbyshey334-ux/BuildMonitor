import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import Header from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-jenga-bg">
      <Sidebar open={open} onToggle={() => setOpen((v) => !v)} />
      <div className={open ? 'md:pl-sidebar-open' : 'md:pl-sidebar-closed'}>
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}


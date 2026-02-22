import { Outlet } from 'react-router';
import { useEffect, useState } from 'react';
import AdminNav from './AdminNav';

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sdc:admin_sidebar_collapsed');
    if (stored === '1') setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sdc:admin_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[1700px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="flex h-[calc(100vh-1.5rem)] gap-3 overflow-hidden lg:gap-4">
            <AdminNav collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
            <main className="admin-main-surface min-w-0 flex-1 overflow-y-auto rounded-[8px]">
              <Outlet />
            </main>
        </div>
      </div>
    </div>
  );
}

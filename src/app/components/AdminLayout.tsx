import { Outlet } from 'react-router';
import { useEffect, useState } from 'react';
import AdminNav from './AdminNav';

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sdc:admin_sidebar_collapsed');
    if (stored === '1') setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sdc:admin_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="page-shell h-screen overflow-hidden">
      <div className="mx-auto h-full max-w-[1700px] p-3 lg:p-4">
        <div className="flex h-full gap-2 overflow-hidden lg:gap-2.5">
            <AdminNav collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
            <main className="admin-main-surface min-w-0 flex-1 overflow-y-auto rounded-[8px]">
              <Outlet />
            </main>
        </div>
      </div>
    </div>
  );
}

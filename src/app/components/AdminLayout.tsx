import { Outlet } from 'react-router';
import AdminNav from './AdminNav';

export default function AdminLayout() {
  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[1700px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="admin-shell overflow-hidden rounded-[34px]">
          <div className="grid min-h-[calc(100vh-2.25rem)] grid-cols-1 lg:grid-cols-[280px_1fr]">
            <AdminNav />
            <main className="admin-main-surface min-w-0 rounded-none lg:rounded-l-[28px]">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

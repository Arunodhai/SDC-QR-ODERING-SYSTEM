import { Outlet } from 'react-router';
import AdminNav from './AdminNav';

export default function AdminLayout() {
  return (
    <div className="page-shell bg-[linear-gradient(180deg,#f7f8fa,#f4f6f8)]">
      <div className="mx-auto flex max-w-[1600px] gap-4 px-3 py-3 lg:px-4 lg:py-4">
        <AdminNav />
        <main className="min-w-0 flex-1 rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

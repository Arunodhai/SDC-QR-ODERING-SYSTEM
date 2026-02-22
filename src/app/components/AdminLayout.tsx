import { Outlet } from 'react-router';
import AdminNav from './AdminNav';

export default function AdminLayout() {
  return (
    <div className="page-shell bg-[radial-gradient(1200px_500px_at_-10%_-10%,rgba(16,185,129,0.08),transparent),radial-gradient(900px_420px_at_110%_-5%,rgba(56,189,248,0.08),transparent),linear-gradient(180deg,#f4f7fa,#eff3f7)]">
      <div className="mx-auto flex max-w-[1600px] gap-4 px-3 py-3 lg:px-4 lg:py-4">
        <AdminNav />
        <main className="glass-surface min-w-0 flex-1 rounded-[26px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

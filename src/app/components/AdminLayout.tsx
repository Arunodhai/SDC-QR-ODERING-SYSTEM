import { Outlet } from 'react-router';
import AdminNav from './AdminNav';

export default function AdminLayout() {
  return (
    <div className="page-shell">
      <AdminNav />
      <Outlet />
    </div>
  );
}

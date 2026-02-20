import { Coffee } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell flex items-center justify-center p-4">
      <div className="rounded-2xl border bg-card px-8 py-10 text-center shadow-lg">
        <Coffee className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="brand-display text-5xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-6">Page not found</p>
        <Button onClick={() => navigate('/admin/login')}>
          Go to Admin
        </Button>
      </div>
    </div>
  );
}

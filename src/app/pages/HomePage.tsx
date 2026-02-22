import { ChefHat, QrCode, LayoutGrid, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useNavigate } from 'react-router';
import logo12 from '../../assets/logo12.png';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell bg-[linear-gradient(180deg,#f7f9fb,#f2f5f7)]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        {/* Header */}
        <div className="mb-8 rounded-[26px] border border-slate-200 bg-white px-6 py-8 text-center shadow-[0_14px_36px_rgba(15,23,42,0.07)] md:mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={logo12} alt="Stories de Café" className="h-16 w-16 object-contain" />
            <h1 className="brand-display text-4xl font-bold md:text-5xl">Stories de Café</h1>
          </div>
          <p className="text-base text-slate-500 md:text-lg">Restaurant Ordering System</p>
        </div>

        {/* Quick Access Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="glass-grid-card cursor-pointer rounded-[24px] border-slate-200 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" onClick={() => navigate('/admin/login')}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <LayoutGrid className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Admin Portal</h2>
                <p className="text-muted-foreground mb-4">Manage menu, tables, and orders</p>
                <Button>
                  Access Admin
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="glass-grid-card cursor-pointer rounded-[24px] border-slate-200 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" onClick={() => navigate('/kitchen/login')}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-amber-100/80 p-3">
                <ChefHat className="w-8 h-8 text-amber-700" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Kitchen View</h2>
                <p className="text-muted-foreground mb-4">View and manage incoming orders</p>
                <Button variant="outline">
                  Open Kitchen View
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* How it Works */}
        <Card className="glass-grid-card mb-8 rounded-[24px] border-slate-200 p-8 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-bold mb-6">How it Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-semibold">Setup</h3>
              </div>
              <p className="text-muted-foreground">
                Login to admin portal, create menu categories, add items, and set up tables with QR codes
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-semibold">Customers Order</h3>
              </div>
              <p className="text-muted-foreground">
                Customers scan QR codes at tables, browse menu, add items to cart, and place orders
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="font-semibold">Kitchen & Payment</h3>
              </div>
              <p className="text-muted-foreground">
                Kitchen updates order status, admin tracks orders and marks them as paid at counter
              </p>
            </div>
          </div>
        </Card>

        {/* Features */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Default admin password: <code className="rounded bg-gray-100 px-2 py-1">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}

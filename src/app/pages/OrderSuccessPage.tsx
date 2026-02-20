import { CheckCircle, Coffee } from 'lucide-react';

export default function OrderSuccessPage() {
  return (
    <div className="page-shell flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center rounded-2xl border bg-card p-8 shadow-lg">
        <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
        <h1 className="brand-display text-4xl font-bold mb-4">Order Placed!</h1>
        <p className="text-muted-foreground mb-2">
          Your order has been sent to the kitchen.
        </p>
        <p className="text-muted-foreground mb-8">
          We'll bring it to your table soon.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Coffee className="w-4 h-4" />
          <span>Stories de Café</span>
        </div>
      </div>
    </div>
  );
}

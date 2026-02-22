import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import * as api from '../lib/api';
import restaurantLogo from '../../assets/logo12.png';

export default function AdminTablesPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [tableNumber, setTableNumber] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await api.getAdminSession();
        if (!session) {
          navigate('/admin/login');
          return;
        }
        if (mounted) await loadTables();
      } catch (error) {
        console.error('Session check failed:', error);
        navigate('/admin/login');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const loadTables = async () => {
    try {
      const res = await api.getTables();
      let nextTables = res.tables || [];

      if (nextTables.length < 12) {
        const existing = new Set(nextTables.map((t: any) => Number(t.tableNumber)));
        const missing = Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => !existing.has(n));
        if (missing.length) {
          await Promise.all(
            missing.map((num) =>
              api.createTable(num).catch(() => null),
            ),
          );
          const refreshed = await api.getTables();
          nextTables = refreshed.tables || [];
        }
      }

      setTables(nextTables);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load tables');
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTable(parseInt(tableNumber));
      toast.success('Table created');
      setShowDialog(false);
      setTableNumber('');
      loadTables();
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create table');
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Delete this table?')) return;
    try {
      await api.deleteTable(id);
      toast.success('Table deleted');
      loadTables();
    } catch (error) {
      console.error('Error deleting table:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete table');
    }
  };

  const showQR = (table: any) => {
    setSelectedTable(table);
    setShowQRDialog(true);
  };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `table-${selectedTable.tableNumber}-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const getTableURL = (tableNumber: number) => {
    return `${window.location.origin}/table/${tableNumber}`;
  };

  const getQrImageSettings = (size: number) => {
    const logoSize = Math.round(size * 0.28);
    return {
      src: restaurantLogo,
      height: logoSize,
      width: logoSize,
      excavate: true,
    };
  };

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="glass-grid-card mb-6 rounded-2xl border-slate-200/80 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">QR Management</p>
            <h2 className="brand-display text-3xl font-bold">Tables</h2>
          </div>
          <Button onClick={() => setShowDialog(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
        </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {tables.map(table => (
            <Card key={table.id} className="glass-grid-card p-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="shrink-0 rounded-lg border bg-white p-2 transition hover:shadow cursor-zoom-in"
                  onClick={() => showQR(table)}
                  title="Click to view QR"
                >
                  <QRCodeSVG
                    value={getTableURL(table.tableNumber)}
                    size={80}
                    level="H"
                    imageSettings={getQrImageSettings(80)}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold leading-tight">Table {table.tableNumber}</h3>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => handleDeleteTable(table.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No tables yet. Add your first table to get started.</p>
          </div>
        )}
      </div>

      {/* Add Table Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Table</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTable} className="space-y-4">
            <div>
              <Label>Table Number</Label>
              <Input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 1"
                required
              />
            </div>
            <Button type="submit" className="w-full">Create Table</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Table {selectedTable?.tableNumber} QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl border p-8 bg-white">
              <QRCodeSVG
                id="qr-code"
                value={selectedTable ? getTableURL(selectedTable.tableNumber) : ''}
                size={256}
                level="H"
                imageSettings={getQrImageSettings(256)}
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {selectedTable && getTableURL(selectedTable.tableNumber)}
              </p>
              <Button onClick={downloadQR} className="w-full">
                Download QR Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

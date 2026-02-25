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
import { getActiveWorkspaceId, getCurrentWorkspaceProfile } from '../lib/workspaceAuth';
import defaultRestaurantLogo from '../../assets/logo12.png';

export default function AdminTablesPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [qrLogoSrc, setQrLogoSrc] = useState<string>(() => {
    const workspaceLogo = String(getCurrentWorkspaceProfile()?.logoUrl || '').trim();
    return workspaceLogo || defaultRestaurantLogo;
  });

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
      const [tableRes, workspaceRes] = await Promise.all([
        api.getTables(),
        api.getWorkspaceSettings().catch(() => null),
      ]);

      setTables(tableRes.tables || []);
      const latestWorkspaceLogo = String(workspaceRes?.workspace?.logoUrl || getCurrentWorkspaceProfile()?.logoUrl || '').trim();
      setQrLogoSrc(latestWorkspaceLogo || defaultRestaurantLogo);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load tables');
    }
  };

  useEffect(() => {
    const src = String(qrLogoSrc || '').trim();
    if (!src || src.startsWith('data:')) return;

    let active = true;
    const normalizeToDataUrl = async () => {
      try {
        const response = await fetch(src, { mode: 'cors' });
        if (!response.ok) throw new Error('Failed to fetch logo');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!active) return;
          if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
            setQrLogoSrc(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (active) setQrLogoSrc(defaultRestaurantLogo);
      }
    };
    normalizeToDataUrl();
    return () => {
      active = false;
    };
  }, [qrLogoSrc]);

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
    const workspaceId = getActiveWorkspaceId();
    const search = workspaceId ? `?ws=${encodeURIComponent(workspaceId)}` : '';
    return `${window.location.origin}/table/${tableNumber}${search}`;
  };

  const getQrImageSettings = (size: number) => {
    const logoSize = Math.round(size * 0.28);
    return {
      src: qrLogoSrc || defaultRestaurantLogo,
      height: logoSize,
      width: logoSize,
      excavate: true,
    };
  };

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="sdc-header-card mb-5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">QR Management</p>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Tables</h2>
          </div>
          <Button onClick={() => setShowDialog(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
        </div>
        </Card>

        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(145px,1fr))] gap-2.5">
          {tables.map(table => (
            <Card key={table.id} className="sdc-panel-card aspect-square p-2">
              <div className="flex h-full flex-col items-center justify-between">
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-white/85 bg-white/90 p-1 transition hover:shadow cursor-zoom-in"
                  onClick={() => showQR(table)}
                  title="Click to view QR"
                >
                  <QRCodeSVG
                    value={getTableURL(table.tableNumber)}
                    size={84}
                    level="H"
                    imageSettings={getQrImageSettings(84)}
                  />
                </button>
                <div className="flex items-center justify-center gap-2.5">
                  <h3 className="text-[20px] font-semibold tracking-tight text-slate-900">Table {table.tableNumber}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 rounded-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
                    onClick={() => handleDeleteTable(table.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
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
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Table Number</Label>
              <Input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 1"
                min={1}
                className="h-11"
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

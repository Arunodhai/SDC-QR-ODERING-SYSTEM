import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Edit, Trash2, Coffee } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import * as api from '../lib/api';
import SeedDataButton from '../components/SeedDataButton';
import { getMenuItemImage } from '../lib/menuImageFallback';

export default function AdminMenuPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('items');
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [categoryName, setCategoryName] = useState('');
  const [itemForm, setItemForm] = useState({
    categoryId: '',
    name: '',
    price: '',
    description: '',
    image: '',
    available: true,
    dietaryType: 'NON_VEG',
  });
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const [togglingItemIds, setTogglingItemIds] = useState<Record<string, boolean>>({});
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await api.getAdminSession();
        if (!session) {
          navigate('/admin/login');
          return;
        }
        if (mounted) await loadData();
      } catch (error) {
        console.error('Session check failed:', error);
        navigate('/admin/login');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      await api.healthCheck();
      const [categoriesRes, itemsRes] = await Promise.all([
        api.getCategories(),
        api.getMenuItems(),
      ]);
      setCategories(categoriesRes.categories);
      setMenuItems(itemsRes.items);
      setApiConnected(true);
    } catch (error) {
      console.error('Error loading data:', error);
      setApiConnected(false);
      toast.error(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name: categoryName });
        toast.success('Category updated');
      } else {
        await api.createCategory(categoryName, categories.length);
        toast.success('Category created');
      }
      setShowCategoryDialog(false);
      setCategoryName('');
      setEditingCategory(null);
      loadData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.deleteCategory(id);
      toast.success('Category deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete category');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setItemForm(prev => ({ ...prev, image: res.url }));
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryId = String(itemForm.categoryId || '').trim();
      const name = itemForm.name.trim();
      const price = parseFloat(itemForm.price);

      if (!categoryId) {
        toast.error('Please select a category');
        return;
      }

      if (!name) {
        toast.error('Please enter item name');
        return;
      }

      if (!Number.isFinite(price) || price < 0) {
        toast.error('Please enter a valid price');
        return;
      }

      const itemData = {
        ...itemForm,
        categoryId,
        name,
        price,
      };

      if (editingItem) {
        await api.updateMenuItem(editingItem.id, itemData);
        toast.success('Item updated');
      } else {
        await api.createMenuItem(itemData);
        toast.success('Item created');
      }
      setShowItemDialog(false);
      setItemForm({ categoryId: '', name: '', price: '', description: '', image: '', available: true, dietaryType: 'NON_VEG' });
      setEditingItem(null);
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.deleteMenuItem(id);
      toast.success('Item deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete item');
    }
  };

  const openEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setShowCategoryDialog(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      categoryId: String(item.categoryId ?? ''),
      name: item.name,
      price: item.price.toString(),
      description: item.description,
      image: item.image,
      available: item.available,
      dietaryType: item.dietaryType || 'NON_VEG',
    });
    setShowItemDialog(true);
  };

  const openCreateItemForCategory = (categoryId?: string | number) => {
    if (categories.length === 0) {
      toast.error('Create at least one category first');
      return;
    }
    setEditingItem(null);
    setItemForm({
      categoryId: categoryId ? String(categoryId) : '',
      name: '',
      price: '',
      description: '',
      image: '',
      available: true,
      dietaryType: 'NON_VEG',
    });
    setActiveTab('items');
    setShowItemDialog(true);
  };

  const toggleItemAvailability = async (item: any) => {
    const nextAvailable = !item.available;
    setMenuItems((prev) =>
      prev.map((mi) => (mi.id === item.id ? { ...mi, available: nextAvailable } : mi)),
    );
    setTogglingItemIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      await api.updateMenuItem(item.id, { available: nextAvailable });
      toast.success(item.available ? 'Item disabled' : 'Item enabled');
    } catch (error) {
      // rollback local optimistic update
      setMenuItems((prev) =>
        prev.map((mi) => (mi.id === item.id ? { ...mi, available: item.available } : mi)),
      );
      console.error('Error toggling availability:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update item');
    } finally {
      setTogglingItemIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-5">
        <Card className="sdc-header-card mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Menu Console</p>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Menu Management</h2>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span className="font-semibold">Backend:</span>
              {apiConnected === null && <span className="text-muted-foreground">Checking...</span>}
              {apiConnected === true && <span className="text-green-700">Connected</span>}
              {apiConnected === false && <span className="text-red-700">Not connected</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm lg:justify-end">
            <span className="font-medium text-slate-900">Categories: {categories.length}</span>
            <span className="font-medium text-slate-900">Items: {menuItems.length}</span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-md border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              onClick={loadData}
            >
              Refresh
            </Button>
          </div>
        </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="items">Menu Items</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Categories</h2>
              <Button onClick={() => setShowCategoryDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {categories.map(category => (
                <Card key={category.id} className="sdc-panel-card p-3">
                  <div className="mb-3">
                    <h3 className="text-base font-semibold leading-tight">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {menuItems.filter(i => String(i.categoryId) === String(category.id)).length} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => openCreateItemForCategory(category.id)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add item
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditCategory(category)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="items">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900">Menu Items</h2>
              <Button
                onClick={() => {
                  if (categories.length === 0) {
                    toast.error('Create at least one category first');
                    setActiveTab('categories');
                    return;
                  }
                  openCreateItemForCategory();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Label className="text-sm text-slate-700">Category filter</Label>
              <Select value={itemCategoryFilter} onValueChange={setItemCategoryFilter}>
                <SelectTrigger className="w-[260px] rounded-md border-slate-300 bg-white">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingData && (
              <Card className="sdc-panel-card p-8 text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Loading menu data...</h3>
                <p className="text-muted-foreground">Please wait.</p>
              </Card>
            )}

            {!loadingData && categories.length === 0 && menuItems.length === 0 && (
              <Card className="sdc-panel-card p-8 text-center mb-6">
                <Coffee className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Get Started</h3>
                <p className="text-muted-foreground mb-4">
                  Create sample menu data to quickly test the system
                </p>
                <div className="max-w-xs mx-auto">
                  <SeedDataButton />
                </div>
              </Card>
            )}

            {!loadingData && categories.length > 0 && menuItems.length === 0 && (
              <Card className="sdc-panel-card p-8 text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">No menu items found</h3>
                <p className="text-muted-foreground mb-4">
                  Categories are ready. Add your first menu item to start taking orders.
                </p>
                <div className="mx-auto max-w-xs">
                  <Button onClick={() => openCreateItemForCategory()} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Item
                  </Button>
                </div>
              </Card>
            )}

            {!loadingData && categories
              .filter((category) => itemCategoryFilter === 'all' || String(category.id) === String(itemCategoryFilter))
              .map(category => {
              const categoryItems = menuItems.filter(item => String(item.categoryId) === String(category.id));
              if (categoryItems.length === 0) return null;

              return (
                <Card key={category.id} className="sdc-panel-card mb-6 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/60 px-4 py-3">
                    <h3 className="text-base font-semibold">{category.name}</h3>
                    <span className="sdc-pill border-teal-200 text-teal-700">
                      {categoryItems.length} item{categoryItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
                    {categoryItems.map(item => (
                      <Card key={item.id} className="sdc-panel-card overflow-hidden p-0">
                        <div className="flex flex-col">
                          {getMenuItemImage(item.name, item.image) && (
                            <button
                              type="button"
                              className="h-44 w-full shrink-0 overflow-hidden rounded-none border-b bg-white transition hover:opacity-95 cursor-zoom-in"
                              onClick={() =>
                                setPreviewImage({
                                  src: getMenuItemImage(item.name, item.image),
                                  name: item.name,
                                })
                              }
                            >
                              <img src={getMenuItemImage(item.name, item.image)} alt={item.name} className="h-full w-full object-cover" />
                            </button>
                          )}
                          {!getMenuItemImage(item.name, item.image) && (
                            <div className="h-44 w-full shrink-0 border-b bg-white/60" />
                          )}

                          <div className="flex-1 min-w-0 p-3">
                            <h4 className="font-semibold text-base leading-tight truncate">{item.name}</h4>
                            <div className="mt-1">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  item.dietaryType === 'VEG'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {item.dietaryType === 'VEG' ? 'VEG' : 'NON VEG'}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                            )}
                            <p className="text-base font-bold mt-1">${item.price.toFixed(2)}</p>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Label className="text-sm">Available</Label>
                                <Switch
                                  checked={item.available}
                                  onCheckedChange={() => toggleItemAvailability(item)}
                                  disabled={Boolean(togglingItemIds[item.id])}
                                />
                              </div>

                              <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditItem(item)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDeleteItem(item.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Category Name</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Starters"
                className="h-11"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'New Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateItem} className="space-y-4">
            {categories.length === 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No categories found. Create a category first from the Categories tab.
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Category</Label>
              <Select
                value={itemForm.categoryId}
                onValueChange={(val) => setItemForm(prev => ({ ...prev, categoryId: val }))}
                disabled={categories.length === 0}
                required
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Name</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Cappuccino"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Price</Label>
              <Input
                type="number"
                step="0.01"
                value={itemForm.price}
                onChange={(e) => setItemForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Item description"
                className="min-h-[84px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Food Type</Label>
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                  <input
                    type="radio"
                    name="dietaryType"
                    value="VEG"
                    checked={itemForm.dietaryType === 'VEG'}
                    onChange={(e) => setItemForm(prev => ({ ...prev, dietaryType: e.target.value }))}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    </span>
                    Veg
                  </span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                  <input
                    type="radio"
                    name="dietaryType"
                    value="NON_VEG"
                    checked={itemForm.dietaryType === 'NON_VEG'}
                    onChange={(e) => setItemForm(prev => ({ ...prev, dietaryType: e.target.value }))}
                    className="h-4 w-4 accent-rose-600"
                  />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-rose-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                    </span>
                    Non Veg
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Image</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="h-11"
                />
              </div>
              {itemForm.image && (
                <img src={itemForm.image} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={itemForm.available}
                onCheckedChange={(val) => setItemForm(prev => ({ ...prev, available: val }))}
              />
              <Label>Available</Label>
            </div>

            <Button type="submit" className="w-full" disabled={uploading}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.name || 'Item image'}</DialogTitle>
          </DialogHeader>
          {previewImage?.src && (
            <div className="rounded-lg border bg-white p-3 flex items-center justify-center">
              <img src={previewImage.src} alt={previewImage.name} className="max-h-[65vh] w-auto object-contain rounded" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

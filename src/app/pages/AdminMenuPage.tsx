import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Edit, Trash2, Upload, Coffee } from 'lucide-react';
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
import AdminNav from '../components/AdminNav';
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
  });
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

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
      setItemForm({ categoryId: '', name: '', price: '', description: '', image: '', available: true });
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
    });
    setShowItemDialog(true);
  };

  const toggleItemAvailability = async (item: any) => {
    try {
      await api.updateMenuItem(item.id, { available: !item.available });
      toast.success(item.available ? 'Item disabled' : 'Item enabled');
      loadData();
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update item');
    }
  };

  return (
    <div className="page-shell">
      <AdminNav sticky={false} />

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="brand-display text-3xl font-bold">Menu Management</h2>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span className="font-semibold">Backend:</span>
              {apiConnected === null && <span className="text-muted-foreground">Checking...</span>}
              {apiConnected === true && <span className="text-green-700">Connected</span>}
              {apiConnected === false && <span className="text-red-700">Not connected</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm lg:justify-end">
            <span className="rounded-md bg-gray-100 px-2 py-1">Categories: {categories.length}</span>
            <span className="rounded-md bg-gray-100 px-2 py-1">Items: {menuItems.length}</span>
            <Button variant="outline" size="sm" onClick={loadData}>Refresh</Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="items">Menu Items</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <div className="flex items-center justify-between mb-6">
              <h2 className="brand-display text-3xl font-bold">Categories</h2>
              <Button onClick={() => setShowCategoryDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>

            <div className="grid gap-4">
              {categories.map(category => (
                <Card key={category.id} className="glass-grid-card p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {menuItems.filter(i => String(i.categoryId) === String(category.id)).length} items
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditCategory(category)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDeleteCategory(category.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="items">
            <div className="flex items-center justify-between mb-6">
              <h2 className="brand-display text-3xl font-bold">Menu Items</h2>
              <Button
                onClick={() => {
                  if (categories.length === 0) {
                    toast.error('Create at least one category first');
                    setActiveTab('categories');
                    return;
                  }
                  setShowItemDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            {loadingData && (
              <Card className="glass-grid-card p-8 text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Loading menu data...</h3>
                <p className="text-muted-foreground">Please wait.</p>
              </Card>
            )}

            {!loadingData && categories.length === 0 && menuItems.length === 0 && (
              <Card className="glass-grid-card p-8 text-center mb-6">
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
              <Card className="glass-grid-card p-8 text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">No menu items found</h3>
                <p className="text-muted-foreground mb-4">
                  Categories exist, but there are no rows in <code>menu_items</code>.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Run <code>/Users/arunodhaiv/Desktop/SDC/sql/import_stories_menu.sql</code> in Supabase SQL editor, then click Refresh.
                </p>
                <div className="mx-auto max-w-xs">
                  <Button onClick={loadData} className="w-full">Refresh Data</Button>
                </div>
              </Card>
            )}

            {!loadingData && categories.map(category => {
              const categoryItems = menuItems.filter(item => String(item.categoryId) === String(category.id));
              if (categoryItems.length === 0) return null;

              return (
                <Card key={category.id} className="glass-grid-card mb-6 overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3">
                    <h3 className="text-base font-semibold">{category.name}</h3>
                    <span className="rounded-md border border-teal-200 bg-white px-2 py-0.5 text-xs text-teal-800">
                      {categoryItems.length} item{categoryItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
                    {categoryItems.map(item => (
                      <Card key={item.id} className="glass-grid-card p-3">
                        <div className="flex gap-3 items-start">
                          {getMenuItemImage(item.name, item.image) && (
                            <button
                              type="button"
                              className="h-24 w-24 shrink-0 rounded-lg border bg-white p-1 transition hover:shadow cursor-zoom-in"
                              onClick={() =>
                                setPreviewImage({
                                  src: getMenuItemImage(item.name, item.image),
                                  name: item.name,
                                })
                              }
                            >
                              <img src={getMenuItemImage(item.name, item.image)} alt={item.name} className="h-full w-full rounded object-contain" />
                            </button>
                          )}
                          {!getMenuItemImage(item.name, item.image) && (
                            <div className="h-24 w-24 shrink-0 rounded-lg border bg-white/60" />
                          )}

                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-base leading-tight truncate">{item.name}</h4>
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
            <div>
              <Label>Category Name</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Starters"
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
            <div>
              <Label>Category</Label>
              <Select
                value={itemForm.categoryId}
                onValueChange={(val) => setItemForm(prev => ({ ...prev, categoryId: val }))}
                disabled={categories.length === 0}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Name</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Cappuccino"
                required
              />
            </div>

            <div>
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                value={itemForm.price}
                onChange={(e) => setItemForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Item description"
              />
            </div>

            <div>
              <Label>Image</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
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

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import * as api from '../lib/api';

export default function SeedDataButton() {
  const [seeding, setSeeding] = useState(false);

  const seedData = async () => {
    setSeeding(true);
    try {
      // Create categories
      const startersRes = await api.createCategory('Starters', 0);
      const mainsRes = await api.createCategory('Main Courses', 1);
      const drinksRes = await api.createCategory('Drinks', 2);
      const dessertsRes = await api.createCategory('Desserts', 3);

      const starters = startersRes.category;
      const mains = mainsRes.category;
      const drinks = drinksRes.category;
      const desserts = dessertsRes.category;

      // Create menu items
      const items = [
        // Starters
        { categoryId: starters.id, name: 'Bruschetta', price: 8.99, description: 'Toasted bread with tomatoes, garlic, and basil', available: true },
        { categoryId: starters.id, name: 'Caesar Salad', price: 10.99, description: 'Romaine lettuce, croutons, parmesan', available: true },
        { categoryId: starters.id, name: 'Soup of the Day', price: 6.99, description: 'Ask your server for today\'s selection', available: true },
        
        // Mains
        { categoryId: mains.id, name: 'Margherita Pizza', price: 14.99, description: 'Fresh mozzarella, tomato sauce, basil', available: true },
        { categoryId: mains.id, name: 'Grilled Salmon', price: 22.99, description: 'With roasted vegetables and lemon butter', available: true },
        { categoryId: mains.id, name: 'Pasta Carbonara', price: 16.99, description: 'Creamy sauce with pancetta and parmesan', available: true },
        { categoryId: mains.id, name: 'Beef Burger', price: 15.99, description: 'Angus beef, lettuce, tomato, cheese, fries', available: true },
        
        // Drinks
        { categoryId: drinks.id, name: 'Cappuccino', price: 4.50, description: 'Espresso with steamed milk and foam', available: true },
        { categoryId: drinks.id, name: 'Latte', price: 4.50, description: 'Espresso with steamed milk', available: true },
        { categoryId: drinks.id, name: 'Fresh Orange Juice', price: 5.99, description: 'Freshly squeezed', available: true },
        { categoryId: drinks.id, name: 'Iced Tea', price: 3.50, description: 'Refreshing lemon iced tea', available: true },
        
        // Desserts
        { categoryId: desserts.id, name: 'Tiramisu', price: 7.99, description: 'Classic Italian dessert with coffee and mascarpone', available: true },
        { categoryId: desserts.id, name: 'Chocolate Cake', price: 6.99, description: 'Rich chocolate cake with vanilla ice cream', available: true },
        { categoryId: desserts.id, name: 'Panna Cotta', price: 6.50, description: 'Italian cream dessert with berry sauce', available: true },
      ];

      for (const item of items) {
        await api.createMenuItem(item);
      }

      // Create tables
      for (let i = 1; i <= 10; i++) {
        await api.createTable(i);
      }

      toast.success('Sample data created successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Failed to create sample data');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={seedData}
      disabled={seeding}
      className="w-full"
    >
      <Sparkles className="w-4 h-4 mr-2" />
      {seeding ? 'Creating...' : 'Create Sample Data'}
    </Button>
  );
}
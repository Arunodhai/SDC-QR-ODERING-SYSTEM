import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Initialize Supabase client for storage
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Create storage bucket on startup
const bucketName = 'make-880825c9-menu-images';
const { data: buckets } = await supabase.storage.listBuckets();
const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
if (!bucketExists) {
  await supabase.storage.createBucket(bucketName, { public: false });
  console.log(`Created bucket: ${bucketName}`);
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-880825c9/health", (c) => {
  return c.json({ status: "ok" });
});

// ============== CATEGORIES ==============
// Get all categories
app.get("/make-server-880825c9/categories", async (c) => {
  try {
    const categories = await kv.getByPrefix("category:");
    const sorted = categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    return c.json({ categories: sorted });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return c.json({ error: "Failed to fetch categories" }, 500);
  }
});

// Create category
app.post("/make-server-880825c9/categories", async (c) => {
  try {
    const { name, order } = await c.req.json();
    const id = crypto.randomUUID();
    const category = { id, name, order: order || 0 };
    await kv.set(`category:${id}`, category);
    return c.json({ category });
  } catch (error) {
    console.error("Error creating category:", error);
    return c.json({ error: "Failed to create category" }, 500);
  }
});

// Update category
app.put("/make-server-880825c9/categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`category:${id}`);
    if (!existing) {
      return c.json({ error: "Category not found" }, 404);
    }
    const category = { ...existing, ...updates };
    await kv.set(`category:${id}`, category);
    return c.json({ category });
  } catch (error) {
    console.error("Error updating category:", error);
    return c.json({ error: "Failed to update category" }, 500);
  }
});

// Delete category
app.delete("/make-server-880825c9/categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`category:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return c.json({ error: "Failed to delete category" }, 500);
  }
});

// ============== MENU ITEMS ==============
// Get all menu items
app.get("/make-server-880825c9/menu-items", async (c) => {
  try {
    const items = await kv.getByPrefix("menu-item:");
    return c.json({ items });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return c.json({ error: "Failed to fetch menu items" }, 500);
  }
});

// Create menu item
app.post("/make-server-880825c9/menu-items", async (c) => {
  try {
    const { categoryId, name, price, description, image, available } = await c.req.json();
    const id = crypto.randomUUID();
    const item = {
      id,
      categoryId,
      name,
      price,
      description: description || "",
      image: image || "",
      available: available !== false,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`menu-item:${id}`, item);
    return c.json({ item });
  } catch (error) {
    console.error("Error creating menu item:", error);
    return c.json({ error: "Failed to create menu item" }, 500);
  }
});

// Update menu item
app.put("/make-server-880825c9/menu-items/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`menu-item:${id}`);
    if (!existing) {
      return c.json({ error: "Menu item not found" }, 404);
    }
    const item = { ...existing, ...updates };
    await kv.set(`menu-item:${id}`, item);
    return c.json({ item });
  } catch (error) {
    console.error("Error updating menu item:", error);
    return c.json({ error: "Failed to update menu item" }, 500);
  }
});

// Delete menu item
app.delete("/make-server-880825c9/menu-items/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`menu-item:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    return c.json({ error: "Failed to delete menu item" }, 500);
  }
});

// Upload image
app.post("/make-server-880825c9/upload-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return c.json({ error: "Failed to upload image" }, 500);
    }

    // Get signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 60 * 60 * 24 * 365);

    return c.json({ url: urlData?.signedUrl, path: fileName });
  } catch (error) {
    console.error("Error uploading image:", error);
    return c.json({ error: "Failed to upload image" }, 500);
  }
});

// ============== TABLES ==============
// Get all tables
app.get("/make-server-880825c9/tables", async (c) => {
  try {
    const tables = await kv.getByPrefix("table:");
    const sorted = tables.sort((a, b) => a.tableNumber - b.tableNumber);
    return c.json({ tables: sorted });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return c.json({ error: "Failed to fetch tables" }, 500);
  }
});

// Create table
app.post("/make-server-880825c9/tables", async (c) => {
  try {
    const { tableNumber } = await c.req.json();
    const id = crypto.randomUUID();
    const table = { id, tableNumber };
    await kv.set(`table:${id}`, table);
    return c.json({ table });
  } catch (error) {
    console.error("Error creating table:", error);
    return c.json({ error: "Failed to create table" }, 500);
  }
});

// Delete table
app.delete("/make-server-880825c9/tables/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`table:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting table:", error);
    return c.json({ error: "Failed to delete table" }, 500);
  }
});

// ============== ORDERS ==============
// Get all orders
app.get("/make-server-880825c9/orders", async (c) => {
  try {
    const orders = await kv.getByPrefix("order:");
    const sorted = orders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ orders: sorted });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return c.json({ error: "Failed to fetch orders" }, 500);
  }
});

// Create order
app.post("/make-server-880825c9/orders", async (c) => {
  try {
    const { tableId, tableNumber, customerName, items, total } = await c.req.json();
    const id = crypto.randomUUID();
    const order = {
      id,
      tableId,
      tableNumber,
      customerName: customerName || "Guest",
      items,
      total,
      status: "PENDING",
      paymentStatus: "UNPAID",
      paymentMethod: "COUNTER",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`order:${id}`, order);
    return c.json({ order });
  } catch (error) {
    console.error("Error creating order:", error);
    return c.json({ error: "Failed to create order" }, 500);
  }
});

// Update order status
app.put("/make-server-880825c9/orders/:id/status", async (c) => {
  try {
    const id = c.req.param("id");
    const { status } = await c.req.json();
    const existing = await kv.get(`order:${id}`);
    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }
    const order = { ...existing, status };
    await kv.set(`order:${id}`, order);
    return c.json({ order });
  } catch (error) {
    console.error("Error updating order status:", error);
    return c.json({ error: "Failed to update order status" }, 500);
  }
});

// Update order payment status
app.put("/make-server-880825c9/orders/:id/payment", async (c) => {
  try {
    const id = c.req.param("id");
    const { paymentStatus } = await c.req.json();
    const existing = await kv.get(`order:${id}`);
    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }
    const order = { ...existing, paymentStatus };
    await kv.set(`order:${id}`, order);
    return c.json({ order });
  } catch (error) {
    console.error("Error updating order payment status:", error);
    return c.json({ error: "Failed to update order payment status" }, 500);
  }
});

Deno.serve(app.fetch);
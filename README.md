# Stories de Café - Restaurant Ordering System

A complete web-based restaurant ordering system with QR code table ordering, kitchen management, and admin controls.

## Features

### Customer Ordering
- Scan QR code at table to access menu
- Browse menu by categories
- Add items to cart with quantity controls
- Optional customer name input
- Simple order placement

### Kitchen View
- Real-time order display
- Order status management (PENDING → PREPARING → READY → COMPLETED)
- Auto-refresh every 5 seconds
- Shows table number, customer name, items, and time

### Admin Portal
- **Menu Management**: Create categories and menu items with images
- **Table Management**: Create tables and generate QR codes
- **Order Tracking**: View order history, filter by payment status
- **Payment Processing**: Mark orders as paid
- **Revenue Tracking**: Calculate revenue from paid orders

## Quick Start

1. Visit the home page and click "Admin Portal"
2. Login with password: `admin123`
3. Go to Menu tab and click "Create Sample Data" to populate test menu
4. Navigate to Tables to create tables and generate QR codes
5. Scan QR codes or visit `/table/1` to test customer ordering
6. Check Kitchen view to see incoming orders
7. Use Admin Orders to track payments and revenue

## Routes

- `/` - Home page with quick links
- `/table/:tableNumber` - Customer ordering page
- `/order/success` - Order confirmation
- `/kitchen` - Kitchen order management
- `/admin/login` - Admin login
- `/admin/menu` - Menu and category management
- `/admin/tables` - Table management with QR codes
- `/admin/orders` - Order history and payments

## Tech Stack

- **Frontend**: React, React Router, Tailwind CSS
- **Backend**: Supabase Edge Functions (Hono server)
- **Database**: Supabase KV Store
- **Storage**: Supabase Storage (for menu images)
- **QR Codes**: qrcode.react
- **UI**: shadcn/ui components

## Data Structure

### Categories
- id, name, order

### Menu Items
- id, categoryId, name, price, description, image, available

### Tables
- id, tableNumber

### Orders
- id, tableId, tableNumber, customerName, items[], total
- status: PENDING | PREPARING | READY | COMPLETED
- paymentStatus: PAID | UNPAID
- paymentMethod: COUNTER
- createdAt

## Notes

- This is a prototype system for demonstration purposes
- Not designed for collecting PII or securing sensitive payment data
- Simple password-based admin auth (use proper auth in production)
- Images stored in Supabase Storage with signed URLs
- Auto-polling for real-time updates (kitchen and admin views)

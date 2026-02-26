# Stories de Cafe - QR Ordering System

Multi-tenant restaurant ordering web app with:
- Customer QR menu + cart + live order tracking
- Kitchen live workflow
- Admin dashboard/menu/tables/orders/settings
- Workspace-based branding (name/logo/currency)

## Tech Stack
- React + Vite + React Router
- Supabase (Postgres, Auth, Storage, Realtime)
- Tailwind + Radix UI components
- Recharts for dashboard visualization

## Current Routes
- `/` - Welcome
- `/setup` - Workspace register/sign-in
- `/access` - Workspace portal chooser
- `/admin/login`
- `/admin/dashboard`
- `/admin/menu`
- `/admin/tables`
- `/admin/orders`
- `/admin/kitchen`
- `/admin/settings`
- `/kitchen/login`
- `/kitchen`
- `/table/:tableNumber` - Customer menu
- `/order/success` - Order status page

## Local Run
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
```

## Supabase Configuration
This project currently reads Supabase public config from:
- `/Users/arunodhaiv/Desktop/SDC/utils/supabase/info.tsx`

Set your values there:
- `projectId`
- `publicAnonKey`

## Database Setup (Required)
Run these SQL files in Supabase SQL Editor (in order):

1. `/Users/arunodhaiv/Desktop/SDC/sql/create_multi_tenant_schema_and_rls.sql`
2. `/Users/arunodhaiv/Desktop/SDC/sql/create_kitchen_auth.sql`
3. `/Users/arunodhaiv/Desktop/SDC/sql/create_final_bills.sql`
4. `/Users/arunodhaiv/Desktop/SDC/sql/add_workspace_logo_storage.sql`
5. `/Users/arunodhaiv/Desktop/SDC/sql/create_admin_profiles_and_avatars.sql`
6. `/Users/arunodhaiv/Desktop/SDC/sql/add_order_item_cancellation.sql`
7. `/Users/arunodhaiv/Desktop/SDC/sql/add_order_status_reason.sql`
8. `/Users/arunodhaiv/Desktop/SDC/sql/add_menu_item_dietary_type.sql`
9. `/Users/arunodhaiv/Desktop/SDC/sql/fix_restaurant_tables_workspace_unique.sql`

Optional seed menu:
- `/Users/arunodhaiv/Desktop/SDC/sql/import_stories_menu.sql`

## Storage Buckets Used
- `menu-images`
- `workspace-logos`
- `admin-avatars`

## Core Features Implemented
- Workspace onboarding with owner/admin/kitchen credentials
- Admin settings for branding, currency, timezone
- QR generation per table with workspace context in link
- Customer cart/order flow with notes
- Live status progression (Pending -> Preparing -> Ready -> Served)
- Cancel handling and unavailable-item handling
- Consolidated billing + paid history
- Kitchen and admin order management
- Dashboard metrics and charts


## Project Structure (High Level)
- `/Users/arunodhaiv/Desktop/SDC/src/app/pages` - all screens
- `/Users/arunodhaiv/Desktop/SDC/src/app/components` - shared UI/layout
- `/Users/arunodhaiv/Desktop/SDC/src/app/lib/api.ts` - data access layer
- `/Users/arunodhaiv/Desktop/SDC/src/app/lib/workspaceAuth.ts` - workspace auth/session logic
- `/Users/arunodhaiv/Desktop/SDC/sql` - schema/migration scripts

## Deployment
Vercel config exists at:
- `/Users/arunodhaiv/Desktop/SDC/vercel.json`

Standard deploy:
```bash
vercel
```

## Notes
- This app is designed for restaurant operations and not for processing online card payments directly.
- Payment settlement is handled as in-house flow (counter/card/cash/UPI logging).

# Multi-Tenant Migration Plan (Supabase + RLS)

## Goal
Move from single-restaurant data model to production-ready multi-tenancy with strict tenant isolation.

## Migration Script
Run:

- [`sql/create_multi_tenant_schema_and_rls.sql`](/Users/arunodhaiv/Desktop/SDC/sql/create_multi_tenant_schema_and_rls.sql)

This script:

1. Creates core tenant tables: `workspaces`, `workspace_memberships`, `workspace_kitchen_auth`
2. Creates helper functions: `current_workspace_id()`, `is_workspace_member(...)`
3. Creates a `legacy-default` workspace and backfills existing rows
4. Adds `workspace_id` to all tenant-owned tables
5. Enforces workspace foreign keys, indexes, and data consistency triggers
6. Replaces kitchen-auth RPCs with workspace-aware versions
7. Enables tenant RLS policies
8. Adds storage policies expecting object keys prefixed with `workspace_id`

## Rollout Order
1. Backup production database.
2. Run `sql/create_multi_tenant_schema_and_rls.sql` in Supabase SQL editor.
3. Verify backfill:
   - `select count(*) from public.workspaces;`
   - `select workspace_id, count(*) from public.orders group by workspace_id;`
   - `select workspace_id, count(*) from public.menu_items group by workspace_id;`
4. Verify RLS access with two test users in different workspaces.
5. Deploy app changes that send/resolve `workspace_id` in all queries.

## Required App Changes After Migration
1. Add `workspace_id` in inserts for:
   - `categories`, `menu_items`, `restaurant_tables`, `orders`, `final_bills`, `service_requests`
2. Add `eq('workspace_id', activeWorkspaceId)` filters in all selects/updates/deletes.
3. Update kitchen RPC calls:
   - `verify_kitchen_credentials(activeWorkspaceId, username, password)`
   - `change_kitchen_password(activeWorkspaceId, ...)`
   - `change_kitchen_username(activeWorkspaceId, ...)`
4. Use storage object keys with workspace prefix:
   - `<workspace_id>/menu/<filename>`
5. Set JWT app metadata claim `workspace_id` (or always scope queries by explicit `workspace_id`).
6. Ensure customer links carry workspace context (example: `/table/12?ws=<workspace_id>`) and persist that `ws` value before menu/order queries.

## Notes
- Existing data is preserved and assigned to `legacy-default`.
- RLS policies now block cross-tenant access by default.
- For customer-facing anonymous flows, prefer an Edge Function that resolves workspace context and writes through service role with validation.

-- Production multi-tenant schema + RLS migration for Supabase
-- Safe to run multiple times.
-- Run in Supabase SQL editor as a privileged role.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Core tenant model
-- ------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  restaurant_name text not null,
  outlet_name text,
  owner_email text,
  currency_code text not null default 'USD',
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_memberships_user
  on public.workspace_memberships(user_id);

create index if not exists idx_workspace_memberships_workspace_role
  on public.workspace_memberships(workspace_id, role);

create table if not exists public.workspace_kitchen_auth (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  username text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_workspace_kitchen_username
  on public.workspace_kitchen_auth(workspace_id, lower(username));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

drop trigger if exists trg_workspace_kitchen_auth_updated_at on public.workspace_kitchen_auth;
create trigger trg_workspace_kitchen_auth_updated_at
before update on public.workspace_kitchen_auth
for each row
execute function public.set_updated_at();

create or replace function public.current_workspace_id()
returns uuid
language plpgsql
stable
as $$
declare
  claims_raw text;
  claims jsonb;
  ws text;
begin
  claims_raw := nullif(current_setting('request.jwt.claims', true), '');
  if claims_raw is null then
    return null;
  end if;

  claims := claims_raw::jsonb;
  ws := coalesce(claims ->> 'workspace_id', claims -> 'app_metadata' ->> 'workspace_id');
  if ws is null or btrim(ws) = '' then
    return null;
  end if;
  return ws::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.is_workspace_member(_workspace_id uuid, _roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = _workspace_id
      and wm.user_id = auth.uid()
      and (_roles is null or wm.role = any(_roles))
  );
$$;

grant execute on function public.current_workspace_id() to anon, authenticated;
grant execute on function public.is_workspace_member(uuid, text[]) to anon, authenticated;

-- ------------------------------------------------------------
-- 2) Bootstrap legacy workspace + data migration anchor
-- ------------------------------------------------------------

insert into public.workspaces (slug, restaurant_name, outlet_name, owner_email)
values ('legacy-default', 'Legacy Workspace', 'Main Outlet', null)
on conflict (slug) do nothing;

insert into public.workspace_memberships (workspace_id, user_id, role)
select w.id, u.id, 'OWNER'
from public.workspaces w
join auth.users u on true
where w.slug = 'legacy-default'
on conflict (workspace_id, user_id) do nothing;

do $$
begin
  if to_regclass('public.kitchen_auth') is not null then
    insert into public.workspace_kitchen_auth (workspace_id, username, password_hash, updated_at)
    select
      w.id,
      k.username,
      k.password_hash,
      coalesce(k.updated_at, now())
    from public.workspaces w
    join public.kitchen_auth k on k.id = 1
    where w.slug = 'legacy-default'
    on conflict (workspace_id) do nothing;
  end if;
end $$;

create table if not exists public.final_bills (
  id bigint generated always as identity primary key,
  table_number integer not null,
  customer_phone text not null,
  order_ids integer[] not null default '{}',
  line_items jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz null
);

create table if not exists public.service_requests (
  id bigserial primary key,
  table_number integer not null,
  customer_name text,
  customer_phone text,
  request_type text not null default 'ASSISTANCE',
  message text not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) Add workspace_id to tenant-owned tables + backfill
-- ------------------------------------------------------------

alter table if exists public.categories
  add column if not exists workspace_id uuid;
alter table if exists public.menu_items
  add column if not exists workspace_id uuid;
alter table if exists public.restaurant_tables
  add column if not exists workspace_id uuid;
alter table if exists public.orders
  add column if not exists workspace_id uuid;
alter table if exists public.order_items
  add column if not exists workspace_id uuid;
alter table if exists public.final_bills
  add column if not exists workspace_id uuid;
alter table if exists public.service_requests
  add column if not exists workspace_id uuid;
alter table if exists public.admin_profiles
  add column if not exists workspace_id uuid;

update public.categories
set workspace_id = (select id from public.workspaces where slug = 'legacy-default' limit 1)
where workspace_id is null;

update public.menu_items
set workspace_id = coalesce(
  workspace_id,
  (select c.workspace_id from public.categories c where c.id = public.menu_items.category_id),
  (select id from public.workspaces where slug = 'legacy-default' limit 1)
)
where workspace_id is null;

update public.restaurant_tables
set workspace_id = (select id from public.workspaces where slug = 'legacy-default' limit 1)
where workspace_id is null;

update public.orders
set workspace_id = coalesce(
  workspace_id,
  (select rt.workspace_id from public.restaurant_tables rt where rt.table_number = public.orders.table_number limit 1),
  (select id from public.workspaces where slug = 'legacy-default' limit 1)
)
where workspace_id is null;

update public.order_items
set workspace_id = coalesce(
  workspace_id,
  (select o.workspace_id from public.orders o where o.id = public.order_items.order_id),
  (select id from public.workspaces where slug = 'legacy-default' limit 1)
)
where workspace_id is null;

update public.final_bills
set workspace_id = coalesce(
  workspace_id,
  (select o.workspace_id from public.orders o where o.table_number = public.final_bills.table_number and o.customer_phone = public.final_bills.customer_phone order by o.created_at desc limit 1),
  (select id from public.workspaces where slug = 'legacy-default' limit 1)
)
where workspace_id is null;

update public.service_requests
set workspace_id = coalesce(
  workspace_id,
  (select rt.workspace_id from public.restaurant_tables rt where rt.table_number = public.service_requests.table_number limit 1),
  (select id from public.workspaces where slug = 'legacy-default' limit 1)
)
where workspace_id is null;

update public.admin_profiles
set workspace_id = (select id from public.workspaces where slug = 'legacy-default' limit 1)
where workspace_id is null;

alter table if exists public.categories alter column workspace_id set not null;
alter table if exists public.menu_items alter column workspace_id set not null;
alter table if exists public.restaurant_tables alter column workspace_id set not null;
alter table if exists public.orders alter column workspace_id set not null;
alter table if exists public.order_items alter column workspace_id set not null;
alter table if exists public.final_bills alter column workspace_id set not null;
alter table if exists public.service_requests alter column workspace_id set not null;
alter table if exists public.admin_profiles alter column workspace_id set not null;

do $$
begin
  alter table public.categories
    add constraint fk_categories_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.menu_items
    add constraint fk_menu_items_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.restaurant_tables
    add constraint fk_restaurant_tables_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.orders
    add constraint fk_orders_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.order_items
    add constraint fk_order_items_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.final_bills
    add constraint fk_final_bills_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.service_requests
    add constraint fk_service_requests_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.admin_profiles
    add constraint fk_admin_profiles_workspace
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_categories_workspace on public.categories(workspace_id);
create index if not exists idx_menu_items_workspace on public.menu_items(workspace_id);
create index if not exists idx_restaurant_tables_workspace on public.restaurant_tables(workspace_id);
create index if not exists idx_orders_workspace on public.orders(workspace_id);
create index if not exists idx_order_items_workspace on public.order_items(workspace_id);
create index if not exists idx_final_bills_workspace on public.final_bills(workspace_id);
create index if not exists idx_service_requests_workspace on public.service_requests(workspace_id);
create index if not exists idx_admin_profiles_workspace on public.admin_profiles(workspace_id);

create unique index if not exists uq_categories_workspace_name
  on public.categories(workspace_id, lower(name));
create unique index if not exists uq_restaurant_tables_workspace_table_number
  on public.restaurant_tables(workspace_id, table_number);

-- Keep cross-table workspace integrity stable on write
create or replace function public.sync_workspace_from_parent()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'order_items' then
    select o.workspace_id into new.workspace_id
    from public.orders o
    where o.id = new.order_id;
  elsif tg_table_name = 'menu_items' then
    if new.category_id is not null then
      select c.workspace_id into new.workspace_id
      from public.categories c
      where c.id = new.category_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_items_workspace_sync on public.order_items;
create trigger trg_order_items_workspace_sync
before insert or update on public.order_items
for each row
execute function public.sync_workspace_from_parent();

drop trigger if exists trg_menu_items_workspace_sync on public.menu_items;
create trigger trg_menu_items_workspace_sync
before insert or update on public.menu_items
for each row
execute function public.sync_workspace_from_parent();

-- ------------------------------------------------------------
-- 4) Workspace-aware kitchen auth RPCs
-- ------------------------------------------------------------

revoke all on table public.workspace_kitchen_auth from public, anon, authenticated;

create or replace function public.verify_kitchen_credentials(
  p_workspace_id uuid,
  p_username text,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_username text;
  stored_hash text;
begin
  select username, password_hash
    into stored_username, stored_hash
  from public.workspace_kitchen_auth
  where workspace_id = p_workspace_id;

  if stored_hash is null or stored_username is null then
    return false;
  end if;

  if lower(trim(coalesce(p_username, ''))) <> lower(trim(stored_username)) then
    return false;
  end if;

  return extensions.crypt(coalesce(p_password, ''), stored_hash) = stored_hash;
end;
$$;

create or replace function public.change_kitchen_password(
  p_workspace_id uuid,
  p_username text,
  p_current text,
  p_next text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_username text;
  stored_hash text;
begin
  if not public.is_workspace_member(p_workspace_id, array['OWNER', 'ADMIN']) then
    return false;
  end if;

  select username, password_hash
    into stored_username, stored_hash
  from public.workspace_kitchen_auth
  where workspace_id = p_workspace_id;

  if stored_hash is null or stored_username is null then
    return false;
  end if;

  if lower(trim(coalesce(p_username, ''))) <> lower(trim(stored_username)) then
    return false;
  end if;

  if extensions.crypt(coalesce(p_current, ''), stored_hash) <> stored_hash then
    return false;
  end if;

  if length(trim(coalesce(p_next, ''))) < 6 then
    return false;
  end if;

  update public.workspace_kitchen_auth
  set password_hash = extensions.crypt(trim(p_next), extensions.gen_salt('bf')),
      updated_at = now()
  where workspace_id = p_workspace_id;

  return true;
end;
$$;

create or replace function public.change_kitchen_username(
  p_workspace_id uuid,
  p_current_username text,
  p_current_password text,
  p_next_username text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_username text;
  stored_hash text;
  next_username text;
begin
  if not public.is_workspace_member(p_workspace_id, array['OWNER', 'ADMIN']) then
    return false;
  end if;

  select username, password_hash
    into stored_username, stored_hash
  from public.workspace_kitchen_auth
  where workspace_id = p_workspace_id;

  if stored_hash is null or stored_username is null then
    return false;
  end if;

  if lower(trim(coalesce(p_current_username, ''))) <> lower(trim(stored_username)) then
    return false;
  end if;

  if extensions.crypt(coalesce(p_current_password, ''), stored_hash) <> stored_hash then
    return false;
  end if;

  next_username := trim(coalesce(p_next_username, ''));
  if length(next_username) < 3 then
    return false;
  end if;

  update public.workspace_kitchen_auth
  set username = next_username,
      updated_at = now()
  where workspace_id = p_workspace_id;

  return true;
end;
$$;

-- Compatibility wrappers (workspace id from JWT claim)
create or replace function public.verify_kitchen_credentials(p_username text, p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.verify_kitchen_credentials(public.current_workspace_id(), p_username, p_password);
$$;

create or replace function public.change_kitchen_password(p_username text, p_current text, p_next text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.change_kitchen_password(public.current_workspace_id(), p_username, p_current, p_next);
$$;

create or replace function public.change_kitchen_username(
  p_current_username text,
  p_current_password text,
  p_next_username text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.change_kitchen_username(public.current_workspace_id(), p_current_username, p_current_password, p_next_username);
$$;

grant execute on function public.verify_kitchen_credentials(uuid, text, text) to anon, authenticated;
grant execute on function public.change_kitchen_password(uuid, text, text, text) to authenticated;
grant execute on function public.change_kitchen_username(uuid, text, text, text) to authenticated;
grant execute on function public.verify_kitchen_credentials(text, text) to anon, authenticated;
grant execute on function public.change_kitchen_password(text, text, text) to authenticated;
grant execute on function public.change_kitchen_username(text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 5) RLS policies
-- ------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_kitchen_auth enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.final_bills enable row level security;
alter table public.service_requests enable row level security;
alter table public.admin_profiles enable row level security;

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces
  for select
  to authenticated
  using (public.is_workspace_member(id, null));

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner"
  on public.workspaces
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner"
  on public.workspaces
  for update
  to authenticated
  using (public.is_workspace_member(id, array['OWNER']))
  with check (public.is_workspace_member(id, array['OWNER']));

drop policy if exists "workspace_memberships_select_member" on public.workspace_memberships;
create policy "workspace_memberships_select_member"
  on public.workspace_memberships
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id, null));

drop policy if exists "workspace_memberships_owner_write" on public.workspace_memberships;
create policy "workspace_memberships_owner_write"
  on public.workspace_memberships
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER']))
  with check (public.is_workspace_member(workspace_id, array['OWNER']));

drop policy if exists "workspace_kitchen_auth_select_member" on public.workspace_kitchen_auth;
create policy "workspace_kitchen_auth_select_member"
  on public.workspace_kitchen_auth
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER']));

drop policy if exists "workspace_kitchen_auth_owner_admin_write" on public.workspace_kitchen_auth;
create policy "workspace_kitchen_auth_owner_admin_write"
  on public.workspace_kitchen_auth
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN']));

drop policy if exists "categories_member_access" on public.categories;
create policy "categories_member_access"
  on public.categories
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN']));

drop policy if exists "menu_items_member_access" on public.menu_items;
create policy "menu_items_member_access"
  on public.menu_items
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN']));

drop policy if exists "restaurant_tables_member_access" on public.restaurant_tables;
create policy "restaurant_tables_member_access"
  on public.restaurant_tables
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN']));

drop policy if exists "orders_member_access" on public.orders;
create policy "orders_member_access"
  on public.orders
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']));

drop policy if exists "order_items_member_access" on public.order_items;
create policy "order_items_member_access"
  on public.order_items
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']));

drop policy if exists "final_bills_member_access" on public.final_bills;
create policy "final_bills_member_access"
  on public.final_bills
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER']));

drop policy if exists "service_requests_member_access" on public.service_requests;
create policy "service_requests_member_access"
  on public.service_requests
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']))
  with check (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']));

drop policy if exists "admin_profiles_workspace_member_select" on public.admin_profiles;
create policy "admin_profiles_workspace_member_select"
  on public.admin_profiles
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF']));

drop policy if exists "admin_profiles_workspace_self_write" on public.admin_profiles;
create policy "admin_profiles_workspace_self_write"
  on public.admin_profiles
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF'])
  )
  with check (
    auth.uid() = user_id
    and public.is_workspace_member(workspace_id, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF'])
  );

-- Retire overly-permissive legacy policies where present.
drop policy if exists "final_bills_read_all" on public.final_bills;
drop policy if exists "final_bills_write_auth" on public.final_bills;

-- ------------------------------------------------------------
-- 6) Storage policy example (menu images in workspace-prefixed paths)
-- ------------------------------------------------------------
-- Expected object key format: <workspace_id>/menu/<filename>

drop policy if exists "menu_images_read_workspace" on storage.objects;
create policy "menu_images_read_workspace"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('menu-images', 'make-880825c9-menu-images')
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF'])
  );

drop policy if exists "menu_images_write_workspace" on storage.objects;
create policy "menu_images_write_workspace"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('menu-images', 'make-880825c9-menu-images')
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN'])
  )
  with check (
    bucket_id in ('menu-images', 'make-880825c9-menu-images')
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN'])
  );

drop policy if exists "admin_avatars_public_read" on storage.objects;
drop policy if exists "admin_avatars_insert_own" on storage.objects;
drop policy if exists "admin_avatars_update_own" on storage.objects;
drop policy if exists "admin_avatars_delete_own" on storage.objects;

drop policy if exists "admin_avatars_read_workspace" on storage.objects;
create policy "admin_avatars_read_workspace"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'admin-avatars'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN', 'KITCHEN_MANAGER', 'STAFF'])
  );

drop policy if exists "admin_avatars_write_workspace" on storage.objects;
create policy "admin_avatars_write_workspace"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'admin-avatars'
    and split_part(name, '/', 3) = auth.uid()::text
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN'])
  )
  with check (
    bucket_id = 'admin-avatars'
    and split_part(name, '/', 3) = auth.uid()::text
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN'])
  );

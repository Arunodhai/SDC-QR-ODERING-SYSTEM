-- Run this in Supabase SQL editor.
-- Stores cashier-generated final bill snapshots so customer and cashier see same bill.

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

create index if not exists idx_final_bills_lookup
  on public.final_bills (table_number, customer_phone, created_at desc);

alter table public.final_bills enable row level security;

drop policy if exists "final_bills_read_all" on public.final_bills;
create policy "final_bills_read_all"
  on public.final_bills
  for select
  to anon, authenticated
  using (true);

drop policy if exists "final_bills_write_auth" on public.final_bills;
create policy "final_bills_write_auth"
  on public.final_bills
  for all
  to authenticated
  using (true)
  with check (true);

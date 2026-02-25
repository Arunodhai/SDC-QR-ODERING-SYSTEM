-- Fix legacy global unique constraint on table_number.
-- Ensures table numbers are unique per workspace, not globally.
-- Safe to run multiple times.

do $$
begin
  alter table public.restaurant_tables
    drop constraint if exists restaurant_tables_table_number_key;
exception
  when undefined_table then null;
end $$;

drop index if exists public.restaurant_tables_table_number_key;

create unique index if not exists uq_restaurant_tables_workspace_table_number
  on public.restaurant_tables(workspace_id, table_number);

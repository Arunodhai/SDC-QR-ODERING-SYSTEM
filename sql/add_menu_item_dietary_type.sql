-- Add Veg / Non-Veg tagging on menu items
alter table if exists public.menu_items
  add column if not exists dietary_type text;

-- Backfill from category names where possible.
update public.menu_items mi
set dietary_type = case
  when lower(coalesce(c.name, '')) like '%non veg%' then 'NON_VEG'
  when lower(coalesce(c.name, '')) like '%veg%' then 'VEG'
  else coalesce(mi.dietary_type, 'NON_VEG')
end
from public.categories c
where c.id = mi.category_id
  and (mi.dietary_type is null or mi.dietary_type = '');

-- Default/finalize values.
update public.menu_items
set dietary_type = 'NON_VEG'
where dietary_type is null or dietary_type = '';

alter table if exists public.menu_items
  alter column dietary_type set default 'NON_VEG';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_dietary_type_check'
  ) then
    alter table public.menu_items
      add constraint menu_items_dietary_type_check
      check (dietary_type in ('VEG', 'NON_VEG'));
  end if;
end $$;

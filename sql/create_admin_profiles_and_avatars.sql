-- Admin profile + avatar storage setup
-- Run this in Supabase SQL editor.

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_admin_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_admin_profiles_updated_at();

alter table public.admin_profiles enable row level security;

drop policy if exists "admin_profiles_select_own" on public.admin_profiles;
create policy "admin_profiles_select_own"
on public.admin_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "admin_profiles_insert_own" on public.admin_profiles;
create policy "admin_profiles_insert_own"
on public.admin_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "admin_profiles_update_own" on public.admin_profiles;
create policy "admin_profiles_update_own"
on public.admin_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('admin-avatars', 'admin-avatars', true)
on conflict (id) do nothing;

drop policy if exists "admin_avatars_public_read" on storage.objects;
create policy "admin_avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'admin-avatars');

drop policy if exists "admin_avatars_insert_own" on storage.objects;
create policy "admin_avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'admin-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "admin_avatars_update_own" on storage.objects;
create policy "admin_avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'admin-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'admin-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "admin_avatars_delete_own" on storage.objects;
create policy "admin_avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'admin-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

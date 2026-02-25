-- Workspace logo persistence (DB + Storage)
-- Safe to run multiple times.

alter table public.workspaces
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-logos',
  'workspace-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "workspace_logos_write_workspace" on storage.objects;
create policy "workspace_logos_write_workspace"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'workspace-logos'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN'])
  )
  with check (
    bucket_id = 'workspace-logos'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid, array['OWNER', 'ADMIN'])
  );

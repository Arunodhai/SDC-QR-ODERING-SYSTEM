-- Shared kitchen username + password storage and verification via RPC (device-independent)

create extension if not exists pgcrypto;

create table if not exists public.kitchen_auth (
  id integer primary key check (id = 1),
  username text not null default 'kitchen',
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.kitchen_auth
  add column if not exists username text not null default 'kitchen';

insert into public.kitchen_auth (id, username, password_hash)
values (1, 'kitchen', crypt('kitchen123', gen_salt('bf')))
on conflict (id) do nothing;

update public.kitchen_auth
set username = 'kitchen'
where id = 1 and (username is null or btrim(username) = '');

-- Prevent direct table access from anon/authenticated API roles.
revoke all on table public.kitchen_auth from public, anon, authenticated;

create or replace function public.verify_kitchen_credentials(p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_username text;
  stored_hash text;
begin
  select username, password_hash into stored_username, stored_hash
  from public.kitchen_auth
  where id = 1;

  if stored_hash is null or stored_username is null then
    return false;
  end if;

  if lower(trim(coalesce(p_username, ''))) <> lower(trim(stored_username)) then
    return false;
  end if;

  return crypt(coalesce(p_password, ''), stored_hash) = stored_hash;
end;
$$;

create or replace function public.change_kitchen_password(p_username text, p_current text, p_next text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_username text;
  stored_hash text;
begin
  select username, password_hash into stored_username, stored_hash
  from public.kitchen_auth
  where id = 1;

  if stored_hash is null or stored_username is null then
    return false;
  end if;

  if lower(trim(coalesce(p_username, ''))) <> lower(trim(stored_username)) then
    return false;
  end if;

  if crypt(coalesce(p_current, ''), stored_hash) <> stored_hash then
    return false;
  end if;

  if length(trim(coalesce(p_next, ''))) < 6 then
    return false;
  end if;

  update public.kitchen_auth
  set
    password_hash = crypt(trim(p_next), gen_salt('bf')),
    updated_at = now()
  where id = 1;

  return true;
end;
$$;

create or replace function public.change_kitchen_username(
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
  select username, password_hash into stored_username, stored_hash
  from public.kitchen_auth
  where id = 1;

  if stored_hash is null or stored_username is null then
    return false;
  end if;

  if lower(trim(coalesce(p_current_username, ''))) <> lower(trim(stored_username)) then
    return false;
  end if;

  if crypt(coalesce(p_current_password, ''), stored_hash) <> stored_hash then
    return false;
  end if;

  next_username := trim(coalesce(p_next_username, ''));
  if length(next_username) < 3 then
    return false;
  end if;

  update public.kitchen_auth
  set
    username = next_username,
    updated_at = now()
  where id = 1;

  return true;
end;
$$;

grant execute on function public.verify_kitchen_credentials(text, text) to anon, authenticated;
grant execute on function public.change_kitchen_password(text, text, text) to anon, authenticated;
grant execute on function public.change_kitchen_username(text, text, text) to anon, authenticated;

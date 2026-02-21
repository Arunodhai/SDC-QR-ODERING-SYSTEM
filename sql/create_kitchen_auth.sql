-- Shared kitchen password storage and verification via RPC (device-independent)

create extension if not exists pgcrypto;

create table if not exists public.kitchen_auth (
  id integer primary key check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

insert into public.kitchen_auth (id, password_hash)
values (1, crypt('kitchen123', gen_salt('bf')))
on conflict (id) do nothing;

-- Prevent direct table access from anon/authenticated API roles.
revoke all on table public.kitchen_auth from public, anon, authenticated;

create or replace function public.verify_kitchen_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from public.kitchen_auth
  where id = 1;

  if stored_hash is null then
    return false;
  end if;

  return crypt(coalesce(p_password, ''), stored_hash) = stored_hash;
end;
$$;

create or replace function public.change_kitchen_password(p_current text, p_next text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from public.kitchen_auth
  where id = 1;

  if stored_hash is null then
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

grant execute on function public.verify_kitchen_password(text) to anon, authenticated;
grant execute on function public.change_kitchen_password(text, text) to anon, authenticated;

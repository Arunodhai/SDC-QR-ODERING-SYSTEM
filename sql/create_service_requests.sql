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

create index if not exists service_requests_created_at_idx on public.service_requests (created_at desc);
create index if not exists service_requests_status_idx on public.service_requests (status);

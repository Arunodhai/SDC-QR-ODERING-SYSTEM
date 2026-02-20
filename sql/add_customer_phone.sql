-- Add phone number support for customer order tracking
alter table orders
  add column if not exists customer_phone text;

create index if not exists idx_orders_customer_phone
  on orders(customer_phone);

create index if not exists idx_orders_table_phone_status
  on orders(table_number, customer_phone, status);

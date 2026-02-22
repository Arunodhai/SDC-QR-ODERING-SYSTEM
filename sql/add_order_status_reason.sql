-- Adds a human-readable reason for cancelled/rejected orders.
-- Safe to run multiple times.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS status_reason text;

-- Optional helper index for quick filtering/reporting on status + reason.
CREATE INDEX IF NOT EXISTS idx_orders_status_reason
ON orders(status, status_reason);

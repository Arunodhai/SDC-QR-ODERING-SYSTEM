-- Track item-level cancellations (for unavailable items after order placement)
-- Safe to run multiple times.
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS idx_order_items_cancelled
ON order_items(order_id, is_cancelled);

-- Preserve historical orders as delivery; new orders may choose pickup.
ALTER TABLE orders ADD COLUMN fulfillment TEXT NOT NULL DEFAULT 'delivery' CHECK(fulfillment IN ('delivery','pickup'));

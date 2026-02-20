-- Enable order cancellation state
alter type order_status add value if not exists 'CANCELLED';

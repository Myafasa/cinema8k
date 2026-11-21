ALTER TABLE bookings ADD COLUMN paid_at TIMESTAMPTZ(6);
CREATE INDEX bookings_tenant_paid_at_idx ON bookings(tenant_id, paid_at DESC)
  WHERE status = 'PAID';

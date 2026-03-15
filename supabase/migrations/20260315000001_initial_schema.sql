-- ============================================================
-- ADC Delivery System — Initial Schema Migration
-- Run: supabase db push
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  role        TEXT        CHECK (role IN ('super_admin','coordinator','sales','manager','delivery')),
  is_approved BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- LOCATIONS (pickup / delivery points)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  phone      TEXT,
  address    TEXT        NOT NULL,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  note       TEXT,
  created_by UUID        REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search indexes for autocomplete
CREATE INDEX IF NOT EXISTS idx_locations_name_fts
  ON locations USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_locations_address_fts
  ON locations USING gin(to_tsvector('simple', address));

-- ============================================================
-- ORDERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS order_seq;

CREATE TABLE IF NOT EXISTS orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT        UNIQUE NOT NULL
                         DEFAULT 'ORD-' || to_char(NOW(),'YYYY') || '-'
                                || lpad(nextval('order_seq')::TEXT, 5, '0'),
  pickup_location_id   UUID        NOT NULL REFERENCES locations(id),
  delivery_location_id UUID        NOT NULL REFERENCES locations(id),
  type                 TEXT        NOT NULL CHECK (type IN ('delivery','pickup','mixed')) DEFAULT 'delivery',
  status               TEXT        NOT NULL CHECK (status IN (
                         'pending','assigned','in_transit','delivered','failed','cancelled'
                       )) DEFAULT 'pending',
  note                 TEXT,
  proof_photo_url      TEXT,
  assigned_to          UUID        REFERENCES profiles(id),
  coordinated_by       UUID        REFERENCES profiles(id),
  trip_id              UUID,
  scheduled_at         TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        UUID        REFERENCES profiles(id),
  status           TEXT        NOT NULL CHECK (status IN ('planned','active','completed')) DEFAULT 'planned',
  optimized_route  JSONB,
  route_cache_key  TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_trip
  FOREIGN KEY (trip_id) REFERENCES trips(id);

-- ============================================================
-- DRIVER LOCATIONS (latest snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id UUID        PRIMARY KEY REFERENCES profiles(id),
  lat       DOUBLE PRECISION,
  lng       DOUBLE PRECISION,
  bearing   SMALLINT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER EVENTS (full audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id),
  actor_id   UUID        REFERENCES profiles(id),
  event_type TEXT        NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER TRACKING LOGS (time-series, partitioned by month)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_tracking_logs (
  id        BIGSERIAL,
  order_id  UUID        NOT NULL,
  driver_id UUID,
  status    TEXT        NOT NULL,
  lat       DOUBLE PRECISION,
  lng       DOUBLE PRECISION,
  note      TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (logged_at);

-- Initial partitions (2026 Q1 & Q2)
CREATE TABLE IF NOT EXISTS order_tracking_logs_y2026m03
  PARTITION OF order_tracking_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS order_tracking_logs_y2026m04
  PARTITION OF order_tracking_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS order_tracking_logs_y2026m05
  PARTITION OF order_tracking_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS order_tracking_logs_y2026m06
  PARTITION OF order_tracking_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- BRIN index for time-range queries (sequential writes → very efficient)
CREATE INDEX IF NOT EXISTS idx_otl_logged_at_brin
  ON order_tracking_logs USING BRIN (logged_at) WITH (pages_per_range = 32);

-- B-tree for per-order timeline lookup
CREATE INDEX IF NOT EXISTS idx_otl_order_id
  ON order_tracking_logs (order_id, logged_at DESC);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to  ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_trip_id      ON orders(trip_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_driver_status ON trips(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_order_events_order  ON order_events(order_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "super_admin_all_profiles" ON profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "staff_read_profiles" ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','sales','manager','super_admin')));

-- LOCATIONS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coordinator_write_locations" ON locations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','super_admin')));
CREATE POLICY "staff_read_locations" ON locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','sales','manager','super_admin')));

-- ORDERS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_select_own_orders" ON orders FOR SELECT
  USING (assigned_to = auth.uid());
CREATE POLICY "delivery_update_own_orders" ON orders FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (status IN ('in_transit','delivered','failed'));
CREATE POLICY "sales_manager_read_orders" ON orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('sales','manager')));
CREATE POLICY "coordinator_full_orders" ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','super_admin')));

-- TRIPS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_read_own_trips" ON trips FOR SELECT
  USING (driver_id = auth.uid());
CREATE POLICY "staff_read_trips" ON trips FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','sales','manager','super_admin')));
CREATE POLICY "coordinator_write_trips" ON trips FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','super_admin')));

-- DRIVER LOCATIONS
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_write_own_location" ON driver_locations FOR ALL
  USING (driver_id = auth.uid());
CREATE POLICY "staff_read_driver_locations" ON driver_locations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','sales','manager','super_admin')));

-- ORDER EVENTS
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_read_own_events" ON order_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND assigned_to = auth.uid()));
CREATE POLICY "staff_read_all_events" ON order_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','sales','manager','super_admin')));
CREATE POLICY "system_insert_events" ON order_events FOR INSERT
  WITH CHECK (TRUE);  -- Edge Functions (service_role) insert events

-- ORDER TRACKING LOGS
ALTER TABLE order_tracking_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_read_own_logs" ON order_tracking_logs FOR SELECT
  USING (driver_id = auth.uid());
CREATE POLICY "staff_read_all_logs" ON order_tracking_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator','sales','manager','super_admin')));
CREATE POLICY "system_insert_logs" ON order_tracking_logs FOR INSERT
  WITH CHECK (TRUE);  -- Edge Function (service_role) writes logs

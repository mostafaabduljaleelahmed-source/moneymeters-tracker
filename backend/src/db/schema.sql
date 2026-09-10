-- ==========================================================
-- MoneyMeters Tracker - Database Schema (PostgreSQL + PostGIS)
-- ==========================================================

-- فعّل امتداد PostGIS لتخزين الإحداثيات الجغرافية كـ geometry
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- جدول المستخدمين (مناديب + مديرين)
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'delegate' CHECK (role IN ('delegate', 'admin')),
    vehicle_type  VARCHAR(20) NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'motorcycle', 'walking')),
    phone         VARCHAR(30),
    is_online     BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==========================================================
-- جدول الرحلات: كل رحلة تبدأ بـ Start Trip وتنتهي بـ End Trip
-- ==========================================================
CREATE TABLE IF NOT EXISTS trips (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    distance_m  DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- ==========================================================
-- جدول المواقع: كل نقطة GPS يتم إرسالها من المندوب
-- الإحداثيات مخزنة كـ geometry(Point, 4326) عشان نستفيد من PostGIS
-- ==========================================================
CREATE TABLE IF NOT EXISTS locations (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    geom        geometry(Point, 4326) NOT NULL,
    speed       DOUBLE PRECISION DEFAULT 0,      -- م/ث
    heading     DOUBLE PRECISION,                -- اتجاه الحركة بالدرجات (اختياري)
    accuracy    DOUBLE PRECISION,                -- دقة الـ GPS بالمتر (اختياري)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index مكاني (GiST) لتسريع الاستعلامات الجغرافية (Geofence, أقرب نقطة...)
CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_locations_trip_id ON locations(trip_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_created ON locations(user_id, created_at DESC);

-- Trigger لملء عمود geom تلقائيًا من lat/lng عند الإدخال
CREATE OR REPLACE FUNCTION set_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_location_geom ON locations;
CREATE TRIGGER trg_set_location_geom
BEFORE INSERT OR UPDATE ON locations
FOR EACH ROW EXECUTE FUNCTION set_location_geom();

-- ==========================================================
-- جدول مناطق الـ Geofence (اختياري - لكل مندوب أو منطقة عامة)
-- ==========================================================
CREATE TABLE IF NOT EXISTS geofences (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(150) NOT NULL,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL يعني ينطبق على الكل
    center_lat  DOUBLE PRECISION NOT NULL,
    center_lng  DOUBLE PRECISION NOT NULL,
    radius_m    DOUBLE PRECISION NOT NULL DEFAULT 500,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================
-- جدول التنبيهات (توقف طويل / خروج عن النطاق)
-- ==========================================================
CREATE TABLE IF NOT EXISTS alerts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE,
    type        VARCHAR(30) NOT NULL CHECK (type IN ('idle', 'geofence_exit')),
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

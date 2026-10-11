/*
# Foundation improvements: Shift Presensi master, IoT RFID, per-event notifications

## 1. shift_presensi: add berlaku_untuk + keterangan
## 2. iot_rfid_devices: IoT RFID device registry
## 3. iot_rfid_taps: log of all RFID taps (success and failed)
## 4. notification_settings: per-event columns (hadir/pulang/terlambat/izin/sakit)
## 5. notification_log table (if not exists)
*/

-- ============================================================
-- 1. shift_presensi additions
-- ============================================================
ALTER TABLE shift_presensi ADD COLUMN IF NOT EXISTS berlaku_untuk text NOT NULL DEFAULT 'keduanya';
ALTER TABLE shift_presensi ADD COLUMN IF NOT EXISTS keterangan text;

-- Add unique constraint on kode (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_shift_kode') THEN
    ALTER TABLE shift_presensi ADD CONSTRAINT uniq_shift_kode UNIQUE (kode);
  END IF;
END $$;

-- ============================================================
-- 2. iot_rfid_devices — IoT RFID machine registry
-- ============================================================
CREATE TABLE IF NOT EXISTS iot_rfid_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sn text NOT NULL UNIQUE,
  nama_mesin text NOT NULL DEFAULT '',
  lokasi text,
  api_token text,
  firmware_version text,
  status text NOT NULL DEFAULT 'offline',
  last_seen timestamptz,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE iot_rfid_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_iot_devices" ON iot_rfid_devices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  );
CREATE POLICY "insert_iot_devices" ON iot_rfid_devices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  );
CREATE POLICY "update_iot_devices" ON iot_rfid_devices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  );
CREATE POLICY "delete_iot_devices" ON iot_rfid_devices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  );

-- ============================================================
-- 3. iot_rfid_taps — log of all RFID tap attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS iot_rfid_taps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn text,
  rfid text NOT NULL,
  person_type text,
  person_id uuid,
  person_name text,
  status text NOT NULL DEFAULT 'unknown',
  phase text,
  jam text,
  response jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE iot_rfid_taps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_iot_taps" ON iot_rfid_taps FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'kepala_sekolah'::text]))
  );

CREATE INDEX IF NOT EXISTS idx_iot_taps_timestamp ON iot_rfid_taps (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_iot_taps_rfid ON iot_rfid_taps (rfid);
CREATE INDEX IF NOT EXISTS idx_iot_taps_device ON iot_rfid_taps (device_sn);

-- ============================================================
-- 4. notification_settings: per-event columns
-- ============================================================
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS hadir_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS hadir_wa boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS hadir_push boolean NOT NULL DEFAULT false;

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS pulang_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS pulang_wa boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS pulang_push boolean NOT NULL DEFAULT false;

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS terlambat_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS terlambat_wa boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS terlambat_push boolean NOT NULL DEFAULT false;

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS izin_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS izin_wa boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS izin_push boolean NOT NULL DEFAULT false;

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS sakit_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS sakit_wa boolean NOT NULL DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS sakit_push boolean NOT NULL DEFAULT false;

-- ============================================================
-- 5. notification_log table (check if exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe text NOT NULL,
  penerima text,
  channel text NOT NULL DEFAULT 'whatsapp',
  provider text,
  status text NOT NULL DEFAULT 'menunggu',
  pesan text,
  pesan_error text,
  tanggal_waktu timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_notif_log" ON notification_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'kepala_sekolah'::text]))
  );

CREATE INDEX IF NOT EXISTS idx_notif_log_tanggal ON notification_log (tanggal_waktu DESC);

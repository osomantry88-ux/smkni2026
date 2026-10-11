/*
# Create presensi_siswa, presensi_settings, presensi_audit_log tables

## Purpose
Track daily student attendance (presensi) with masuk/pulang times, status, method, and GPS data.
Central settings for enabling/disabling presensi methods (RFID, QR, Selfie+GPS).
Audit trail for admin corrections.

## New Tables

### 1. `presensi_siswa`
Daily attendance transaction per student.
- `id` (uuid, PK)
- `siswa_id` (uuid, FK → siswa.id)
- `kelas_id` (uuid, FK → kelas.id, nullable — snapshot of student's class at time of presensi)
- `tahun_pelajaran_id` (uuid, FK → tahun_pelajaran.id, nullable)
- `tanggal` (date, NOT NULL) — the presensi date
- `jam_masuk` (timetz, nullable) — time of check-in
- `status_masuk` (text) — 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa'
- `metode_masuk` (text, nullable) — 'rfid' | 'qr' | 'selfie_gps' | 'manual'
- `jam_pulang` (timetz, nullable) — time of check-out
- `metode_pulang` (text, nullable) — 'rfid' | 'qr' | 'selfie_gps' | 'manual'
- `latitude` (double precision, nullable) — GPS latitude for selfie method
- `longitude` (double precision, nullable) — GPS longitude for selfie method
- `foto_url` (text, nullable) — storage path for selfie photo
- `jarak_meter` (double precision, nullable) — distance from school in meters
- `keterangan` (text, nullable) — admin note or reason for izin/sakit
- `dikoreksi_oleh` (uuid, nullable) — admin who corrected this record
- `created_at`, `updated_at` (timestamptz)

Unique constraint: (siswa_id, tanggal) — one record per student per day.

### 2. `presensi_settings` (singleton, id=1)
Configuration for presensi methods and rules.
- `id` (int, PK, always 1)
- `metode_rfid_aktif` (boolean, default true)
- `metode_qr_aktif` (boolean, default true)
- `metode_selfie_aktif` (boolean, default false)
- `auto_alfa_aktif` (boolean, default false) — whether to auto-mark alfa
- `batas_alfa_menit` (int, default 30) — minutes after jam_masuk before auto-alfa
- `waktu_pulang_mode` (text, default 'manual') — 'manual' | 'auto'
- `created_at`, `updated_at`

### 3. `presensi_audit_log`
Immutable audit trail for presensi corrections.
- `id` (uuid, PK)
- `presensi_id` (uuid, FK → presensi_siswa.id)
- `siswa_id` (uuid, FK → siswa.id)
- `user_id` (uuid) — admin who made the correction
- `data_sebelum` (jsonb) — record state before correction
- `data_sesudah` (jsonb) — record state after correction
- `alasan` (text) — reason for correction
- `waktu` (timestamptz, default now())

## Security

### presensi_siswa
- RLS enabled.
- SELECT: admin/super_admin/kepala_sekolah can see all; wali_kelas sees their class; guru sees all (read); siswa sees own (linked via siswa.user_id); orang_tua_wali sees own children (linked via siswa.user_id).
- INSERT: admin/super_admin can insert for any student; siswa can insert own (linked via siswa.user_id).
- UPDATE: only admin/super_admin.
- DELETE: only admin/super_admin.

### presensi_settings
- RLS enabled.
- SELECT: all authenticated can read.
- INSERT/UPDATE: only admin/super_admin.

### presensi_audit_log
- RLS enabled.
- SELECT: only admin/super_admin/kepala_sekolah.
- INSERT: all authenticated (edge function / admin writes).
- No UPDATE or DELETE (immutable).

## Indexes
- presensi_siswa(siswa_id)
- presensi_siswa(tanggal)
- presensi_siswa(kelas_id)
- presensi_siswa(tahun_pelajaran_id)
- presensi_siswa(status_masuk)
- presensi_siswa(metode_masuk)
- Unique: presensi_siswa(siswa_id, tanggal)
*/

-- ============================================================
-- 1. presensi_siswa
-- ============================================================
CREATE TABLE IF NOT EXISTS presensi_siswa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id uuid NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id uuid REFERENCES kelas(id) ON DELETE SET NULL,
  tahun_pelajaran_id uuid REFERENCES tahun_pelajaran(id) ON DELETE SET NULL,
  tanggal date NOT NULL,
  jam_masuk timetz,
  status_masuk text NOT NULL DEFAULT 'hadir',
  metode_masuk text,
  jam_pulang timetz,
  metode_pulang text,
  latitude double precision,
  longitude double precision,
  foto_url text,
  jarak_meter double precision,
  keterangan text,
  dikoreksi_oleh uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one record per student per day
CREATE UNIQUE INDEX IF NOT EXISTS uniq_presensi_siswa_tanggal ON presensi_siswa (siswa_id, tanggal);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_presensi_siswa_id ON presensi_siswa (siswa_id);
CREATE INDEX IF NOT EXISTS idx_presensi_tanggal ON presensi_siswa (tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_kelas ON presensi_siswa (kelas_id);
CREATE INDEX IF NOT EXISTS idx_presensi_tp ON presensi_siswa (tahun_pelajaran_id);
CREATE INDEX IF NOT EXISTS idx_presensi_status ON presensi_siswa (status_masuk);
CREATE INDEX IF NOT EXISTS idx_presensi_metode ON presensi_siswa (metode_masuk);

ALTER TABLE presensi_siswa ENABLE ROW LEVEL SECURITY;

-- SELECT: role-based visibility
DROP POLICY IF EXISTS "select_presensi" ON presensi_siswa;
CREATE POLICY "select_presensi"
  ON presensi_siswa FOR SELECT
  TO authenticated
  USING (
    -- admin & super_admin see all
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
    -- kepala_sekolah sees all (monitoring)
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'kepala_sekolah')
    -- guru sees all (read access for teaching)
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'pembina'))
    -- siswa sees own records (linked via siswa.user_id)
    OR EXISTS (SELECT 1 FROM siswa WHERE siswa.id = presensi_siswa.siswa_id AND siswa.user_id = auth.uid())
    -- orang_tua_wali sees own children (linked via siswa.user_id)
    OR (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'orang_tua_wali')
      AND EXISTS (SELECT 1 FROM siswa WHERE siswa.id = presensi_siswa.siswa_id AND siswa.user_id = auth.uid())
    )
  );

-- INSERT: admin can insert for any student; siswa can insert own
DROP POLICY IF EXISTS "insert_presensi" ON presensi_siswa;
CREATE POLICY "insert_presensi"
  ON presensi_siswa FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
    OR EXISTS (SELECT 1 FROM siswa WHERE siswa.id = presensi_siswa.siswa_id AND siswa.user_id = auth.uid())
  );

-- UPDATE: only admin/super_admin
DROP POLICY IF EXISTS "update_presensi" ON presensi_siswa;
CREATE POLICY "update_presensi"
  ON presensi_siswa FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- DELETE: only admin/super_admin
DROP POLICY IF EXISTS "delete_presensi" ON presensi_siswa;
CREATE POLICY "delete_presensi"
  ON presensi_siswa FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- ============================================================
-- 2. presensi_settings (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS presensi_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  metode_rfid_aktif boolean NOT NULL DEFAULT true,
  metode_qr_aktif boolean NOT NULL DEFAULT true,
  metode_selfie_aktif boolean NOT NULL DEFAULT false,
  auto_alfa_aktif boolean NOT NULL DEFAULT false,
  batas_alfa_menit integer NOT NULL DEFAULT 30,
  waktu_pulang_mode text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presensi_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_presensi_settings" ON presensi_settings;
CREATE POLICY "read_presensi_settings"
  ON presensi_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_presensi_settings" ON presensi_settings;
CREATE POLICY "insert_presensi_settings"
  ON presensi_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

DROP POLICY IF EXISTS "update_presensi_settings" ON presensi_settings;
CREATE POLICY "update_presensi_settings"
  ON presensi_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

INSERT INTO presensi_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. presensi_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS presensi_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presensi_id uuid REFERENCES presensi_siswa(id) ON DELETE CASCADE,
  siswa_id uuid REFERENCES siswa(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  data_sebelum jsonb,
  data_sesudah jsonb,
  alasan text,
  waktu timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_presensi_id ON presensi_audit_log (presensi_id);
CREATE INDEX IF NOT EXISTS idx_audit_siswa_id ON presensi_audit_log (siswa_id);
CREATE INDEX IF NOT EXISTS idx_audit_waktu ON presensi_audit_log (waktu DESC);

ALTER TABLE presensi_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin/super_admin/kepala_sekolah can read audit logs
DROP POLICY IF EXISTS "read_presensi_audit" ON presensi_audit_log;
CREATE POLICY "read_presensi_audit"
  ON presensi_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'kepala_sekolah'))
  );

-- Any authenticated can insert audit logs
DROP POLICY IF EXISTS "insert_presensi_audit" ON presensi_audit_log;
CREATE POLICY "insert_presensi_audit"
  ON presensi_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE — immutable log

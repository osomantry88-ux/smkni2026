/*
# Presensi Guru & Tendik — table and settings

## 1. New Table: presensi_guru_tendik
Tracks daily attendance for guru (teachers) and tendik (staff).
- id (uuid, PK)
- guru_tendik_id (uuid, FK → guru_tendik.id, NOT NULL)
- tahun_pelajaran_id (uuid, FK → tahun_pelajaran.id, nullable)
- shift_id (uuid, FK → shift_presensi.id, nullable) — used by tendik
- jadwal_mengajar_id (uuid, FK → jadwal_mengajar.id, nullable) — used by guru when presensi tied to a teaching schedule
- tanggal (date, NOT NULL)
- jam_masuk (timetz, nullable)
- status_masuk (text) — 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'tugas_luar' | 'cuti' | 'alfa'
- metode_masuk (text, nullable) — 'rfid' | 'qr' | 'selfie_gps' | 'manual'
- jam_pulang (timetz, nullable)
- metode_pulang (text, nullable)
- status_pulang (text, nullable)
- latitude, longitude (double precision, nullable)
- foto_url (text, nullable)
- jarak_meter (double precision, nullable)
- latitude_pulang, longitude_pulang (double precision, nullable)
- foto_pulang_url (text, nullable)
- jarak_pulang_meter (double precision, nullable)
- keterangan (text, nullable)
- dikoreksi_oleh (uuid, nullable)
- created_at, updated_at (timestamptz)

Unique constraint: (guru_tendik_id, tanggal) — one record per person per day.

## 2. presensi_settings additions
- presensi_guru_aktif (boolean, default true)
- presensi_tendik_aktif (boolean, default true)

## Security
### presensi_guru_tendik
- RLS enabled.
- SELECT: admin/super_admin/kepala_sekolah see all; guru/tendik see own records (linked via guru_tendik.user_id).
- INSERT: admin/super_admin can insert for any; guru/tendik can insert own (linked via guru_tendik.user_id).
- UPDATE: only admin/super_admin.
- DELETE: only admin/super_admin.
*/

-- ============================================================
-- 1. presensi_guru_tendik table
-- ============================================================
CREATE TABLE IF NOT EXISTS presensi_guru_tendik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_tendik_id uuid NOT NULL REFERENCES guru_tendik(id) ON DELETE CASCADE,
  tahun_pelajaran_id uuid REFERENCES tahun_pelajaran(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES shift_presensi(id) ON DELETE SET NULL,
  jadwal_mengajar_id uuid REFERENCES jadwal_mengajar(id) ON DELETE SET NULL,
  tanggal date NOT NULL,
  jam_masuk timetz,
  status_masuk text NOT NULL DEFAULT 'hadir',
  metode_masuk text,
  jam_pulang timetz,
  metode_pulang text,
  status_pulang text,
  latitude double precision,
  longitude double precision,
  foto_url text,
  jarak_meter double precision,
  latitude_pulang double precision,
  longitude_pulang double precision,
  foto_pulang_url text,
  jarak_pulang_meter double precision,
  keterangan text,
  dikoreksi_oleh uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_presensi_gt_tanggal ON presensi_guru_tendik (guru_tendik_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_gt_guru ON presensi_guru_tendik (guru_tendik_id);
CREATE INDEX IF NOT EXISTS idx_presensi_gt_tanggal ON presensi_guru_tendik (tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_gt_status ON presensi_guru_tendik (status_masuk);
CREATE INDEX IF NOT EXISTS idx_presensi_gt_shift ON presensi_guru_tendik (shift_id);
CREATE INDEX IF NOT EXISTS idx_presensi_gt_jadwal ON presensi_guru_tendik (jadwal_mengajar_id);

ALTER TABLE presensi_guru_tendik ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "select_presensi_gt" ON presensi_guru_tendik;
CREATE POLICY "select_presensi_gt"
  ON presensi_guru_tendik FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'kepala_sekolah'))
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'pembina'))
    OR EXISTS (SELECT 1 FROM guru_tendik WHERE guru_tendik.id = presensi_guru_tendik.guru_tendik_id AND guru_tendik.user_id = auth.uid())
  );

-- INSERT
DROP POLICY IF EXISTS "insert_presensi_gt" ON presensi_guru_tendik;
CREATE POLICY "insert_presensi_gt"
  ON presensi_guru_tendik FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
    OR EXISTS (SELECT 1 FROM guru_tendik WHERE guru_tendik.id = presensi_guru_tendik.guru_tendik_id AND guru_tendik.user_id = auth.uid())
  );

-- UPDATE
DROP POLICY IF EXISTS "update_presensi_gt" ON presensi_guru_tendik;
CREATE POLICY "update_presensi_gt"
  ON presensi_guru_tendik FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- DELETE
DROP POLICY IF EXISTS "delete_presensi_gt" ON presensi_guru_tendik;
CREATE POLICY "delete_presensi_gt"
  ON presensi_guru_tendik FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- ============================================================
-- 2. presensi_settings additions
-- ============================================================
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS presensi_guru_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS presensi_tendik_aktif boolean NOT NULL DEFAULT true;

INSERT INTO presensi_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

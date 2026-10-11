-- Add user_id to siswa for account linking
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add last_login_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Create shift_presensi_detail for per-day schedules
CREATE TABLE IF NOT EXISTS shift_presensi_detail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_presensi_id uuid NOT NULL REFERENCES shift_presensi(id) ON DELETE CASCADE,
  hari text NOT NULL CHECK (hari IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  aktif boolean NOT NULL DEFAULT true,
  jam_masuk text,
  batas_terlambat text,
  jam_pulang text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shift_presensi_id, hari)
);

ALTER TABLE shift_presensi_detail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_shift_detail" ON shift_presensi_detail FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_shift_detail" ON shift_presensi_detail FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_shift_detail" ON shift_presensi_detail FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_shift_detail" ON shift_presensi_detail FOR DELETE TO authenticated USING (true);

-- Migrate existing shift data into detail table
INSERT INTO shift_presensi_detail (shift_presensi_id, hari, aktif, jam_masuk, batas_terlambat, jam_pulang)
SELECT s.id, d.hari, true, s.jam_masuk, s.batas_terlambat, s.jam_pulang
FROM shift_presensi s
CROSS JOIN (VALUES ('Senin'),('Selasa'),('Rabu'),('Kamis'),('Jumat'),('Sabtu'),('Minggu')) AS d(hari)
WHERE NOT EXISTS (
  SELECT 1 FROM shift_presensi_detail sd WHERE sd.shift_presensi_id = s.id AND sd.hari = d.hari
)
ON CONFLICT (shift_presensi_id, hari) DO NOTHING;

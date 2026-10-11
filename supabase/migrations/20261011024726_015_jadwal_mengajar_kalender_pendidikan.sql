/*
# Create Jam Pelajaran, Jadwal Mengajar, and Kalender Pendidikan tables

1. New Tables
- `jam_pelajaran`: Master jam pelajaran (time slots for teaching periods).
  Columns: id, kode, nama, jam_mulai, jam_selesai, urutan, aktif, created_at, updated_at.
- `jadwal_mengajar`: Teaching schedule linking guru, kelas, mapel, ruangan, jam pelajaran, hari.
  Columns: id, tahun_pelajaran_id, semester, hari, jam_pelajaran_id, kelas_id, guru_id, mata_pelajaran_id, ruangan_id, catatan, aktif, created_at, updated_at.
- `kalender_pendidikan`: School calendar with effective/non-effective days and activities.
  Columns: id, tahun_pelajaran_id, tanggal_mulai, tanggal_selesai, jenis, nama_kegiatan, keterangan, hari_efektif, presensi_diperbolehkan, aktif, created_at, updated_at.

2. Security
- RLS enabled on all three tables.
- Policies: TO anon, authenticated for all CRUD (school data is shared among staff).
- This is a school management app where all authenticated users need to read schedules and calendar.

3. Indexes
- jadwal_mengajar: index on guru_id+hari, kelas_id+hari, ruangan_id+hari for conflict checks.
- kalender_pendidikan: index on tahun_pelajaran_id, tanggal_mulai.

4. Important Notes
- jadwal_mengajar.semester is 'ganjil' or 'genap' check constraint.
- kalender_pendidikan.jenis uses a check constraint for valid calendar types.
- Foreign keys reference existing master tables: tahun_pelajaran, kelas, guru_tendik, mata_pelajaran, ruangan, jam_pelajaran.
*/

-- Jam Pelajaran (master time slots)
CREATE TABLE IF NOT EXISTS jam_pelajaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL,
  nama text NOT NULL,
  jam_mulai time NOT NULL,
  jam_selesai time NOT NULL,
  urutan integer NOT NULL DEFAULT 0,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jam_pelajaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_jam_pelajaran" ON jam_pelajaran;
CREATE POLICY "anon_select_jam_pelajaran" ON jam_pelajaran FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_jam_pelajaran" ON jam_pelajaran;
CREATE POLICY "anon_insert_jam_pelajaran" ON jam_pelajaran FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_jam_pelajaran" ON jam_pelajaran;
CREATE POLICY "anon_update_jam_pelajaran" ON jam_pelajaran FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_jam_pelajaran" ON jam_pelajaran;
CREATE POLICY "anon_delete_jam_pelajaran" ON jam_pelajaran FOR DELETE
  TO anon, authenticated USING (true);

-- Jadwal Mengajar (teaching schedule)
CREATE TABLE IF NOT EXISTS jadwal_mengajar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tahun_pelajaran_id uuid NOT NULL REFERENCES tahun_pelajaran(id) ON DELETE CASCADE,
  semester text NOT NULL DEFAULT 'ganjil' CHECK (semester IN ('ganjil', 'genap')),
  hari text NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu')),
  jam_pelajaran_id uuid NOT NULL REFERENCES jam_pelajaran(id) ON DELETE RESTRICT,
  kelas_id uuid NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  guru_id uuid NOT NULL REFERENCES guru_tendik(id) ON DELETE CASCADE,
  mata_pelajaran_id uuid NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  ruangan_id uuid REFERENCES ruangan(id) ON DELETE SET NULL,
  catatan text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jadwal_mengajar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_jadwal_mengajar" ON jadwal_mengajar;
CREATE POLICY "anon_select_jadwal_mengajar" ON jadwal_mengajar FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_jadwal_mengajar" ON jadwal_mengajar;
CREATE POLICY "anon_insert_jadwal_mengajar" ON jadwal_mengajar FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_jadwal_mengajar" ON jadwal_mengajar;
CREATE POLICY "anon_update_jadwal_mengajar" ON jadwal_mengajar FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_jadwal_mengajar" ON jadwal_mengajar;
CREATE POLICY "anon_delete_jadwal_mengajar" ON jadwal_mengajar FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_jadwal_guru_hari ON jadwal_mengajar(guru_id, hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_hari ON jadwal_mengajar(kelas_id, hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_ruangan_hari ON jadwal_mengajar(ruangan_id, hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_tahun_semester ON jadwal_mengajar(tahun_pelajaran_id, semester);

-- Kalender Pendidikan (school calendar)
CREATE TABLE IF NOT EXISTS kalender_pendidikan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tahun_pelajaran_id uuid NOT NULL REFERENCES tahun_pelajaran(id) ON DELETE CASCADE,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  jenis text NOT NULL CHECK (jenis IN ('hari_efektif', 'libur_nasional', 'libur_sekolah', 'cuti_bersama', 'libur_semester', 'kegiatan_sekolah', 'ujian', 'pts', 'pas_sas', 'pkl_prakerin', 'lainnya')),
  nama_kegiatan text NOT NULL,
  keterangan text,
  hari_efektif boolean NOT NULL DEFAULT true,
  presensi_diperbolehkan boolean NOT NULL DEFAULT true,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE kalender_pendidikan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_kalender_pendidikan" ON kalender_pendidikan;
CREATE POLICY "anon_select_kalender_pendidikan" ON kalender_pendidikan FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_kalender_pendidikan" ON kalender_pendidikan;
CREATE POLICY "anon_insert_kalender_pendidikan" ON kalender_pendidikan FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_kalender_pendidikan" ON kalender_pendidikan;
CREATE POLICY "anon_update_kalender_pendidikan" ON kalender_pendidikan FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_kalender_pendidikan" ON kalender_pendidikan;
CREATE POLICY "anon_delete_kalender_pendidikan" ON kalender_pendidikan FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_kalender_tahun ON kalender_pendidikan(tahun_pelajaran_id);
CREATE INDEX IF NOT EXISTS idx_kalender_tanggal ON kalender_pendidikan(tanggal_mulai, tanggal_selesai);

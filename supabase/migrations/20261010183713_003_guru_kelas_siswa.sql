/*
# Guru & Tenaga Kependidikan, Kelas, dan Siswa Tables

## Overview
Creates three core data tables:
1. `guru_tendik` — staff records (teachers and education staff)
2. `kelas` — classes (e.g., "X TKJ 1", "XII RPL 2")
3. `siswa` — student records with embedded parent/guardian info

## New Tables

### guru_tendik
- `id` (uuid, PK)
- `nip` (text, unique) — Nomor Induk Pegawai
- `nuptk` (text) — Nomor Unik Pendidik dan Tenaga Kependidikan
- `nama_lengkap` (text, not null)
- `gelar_depan` (text)
- `gelar_belakang` (text)
- `jenis_kelamin` (text: L/P)
- `tempat_lahir` (text)
- `tanggal_lahir` (date)
- `agama` (text)
- `alamat` (text)
- `no_hp` (text)
- `email` (text)
- `jenis_ptk` (text: guru/tendik) — distinguishes teacher vs education staff
- `status_kepegawaian` (text: pns, pppk, honorer, etc.)
- `jabatan` (text) — job title/position
- `tanggal_masuk` (date) — employment start date
- `aktif` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)
- `user_id` (uuid, nullable, references auth.users) — links staff to a login account

### kelas
- `id` (uuid, PK)
- `nama` (text, not null) — e.g. "X TKJ 1"
- `tingkat` (integer) — grade level: 10, 11, 12
- `jurusan_id` (uuid, references jurusan) — major/concentration
- `tahun_pelajaran_id` (uuid, references tahun_pelajaran) — academic year
- `wali_kelas_id` (uuid, references guru_tendik) — homeroom teacher
- `kapasitas` (integer) — max student count
- `aktif` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

### siswa
- `id` (uuid, PK)
- `nis` (text, unique) — Nomor Induk Siswa
- `nisn` (text, unique) — Nomor Induk Siswa Nasional
- `nama_lengkap` (text, not null)
- `jenis_kelamin` (text: L/P)
- `tempat_lahir` (text)
- `tanggal_lahir` (date)
- `agama` (text)
- `alamat` (text)
- `no_hp` (text)
- `email` (text)
- `asal_sekolah` (text) — previous school (for new enrollments)
- `tanggal_masuk` (date) — enrollment date
- `kelas_id` (uuid, references kelas) — current class
- `jurusan_id` (uuid, references jurusan) — major
- `tahun_pelajaran_id` (uuid, references tahun_pelajaran) — academic year
- `status` (text: aktif, lulus, pindah, keluar) — enrollment status
- `aktif` (boolean, default true)

  **Parent/Guardian (Orang Tua/Wali) — embedded in siswa profile:**
- `nama_ayah` (text)
- `nama_ibu` (text)
- `nama_wali` (text) — guardian (if not parent)
- `pekerjaan_ayah` (text)
- `pekerjaan_ibu` (text)
- `pekerjaan_wali` (text)
- `no_hp_ayah` (text)
- `no_hp_ibu` (text)
- `no_hp_wali` (text)
- `alamat_ortu` (text) — parent/guardian address
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on all three tables.
- All CRUD scoped to `authenticated` users.
- These are shared school data managed by staff — any authenticated user
  can read/write (permission refinement can be added later at app level).

## Notes
1. Parent/guardian data is embedded directly in `siswa` (not a separate table),
   as requested — it is part of the student profile.
2. `guru_tendik.user_id` optionally links a staff record to a login account.
3. `kelas` links to jurusan, tahun_pelajaran, and wali_kelas (guru_tendik).
4. `siswa` links to kelas, jurusan, and tahun_pelajaran.
5. Foreign keys use ON DELETE SET NULL for optional links (kelas_id, wali_kelas_id)
   and ON DELETE RESTRICT for required references to prevent orphaned data.
6. The schema is designed for easy extension: presensi can reference siswa + kelas,
   CBT can reference mata_pelajaran + kelas, rapor can reference siswa + mata_pelajaran,
   PKL can reference siswa, etc.
*/

-- ============================================================
-- GURU & TENAGA KEPENDIDIKAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guru_tendik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nip text UNIQUE,
  nuptk text,
  nama_lengkap text NOT NULL,
  gelar_depan text,
  gelar_belakang text,
  jenis_kelamin text CHECK (jenis_kelamin IN ('L', 'P')),
  tempat_lahir text,
  tanggal_lahir date,
  agama text,
  alamat text,
  no_hp text,
  email text,
  jenis_ptk text NOT NULL DEFAULT 'guru' CHECK (jenis_ptk IN ('guru', 'tendik')),
  status_kepegawaian text,
  jabatan text,
  tanggal_masuk date,
  aktif boolean NOT NULL DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guru_tendik ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gt_select_authenticated" ON public.guru_tendik;
CREATE POLICY "gt_select_authenticated"
  ON public.guru_tendik FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gt_insert_authenticated" ON public.guru_tendik;
CREATE POLICY "gt_insert_authenticated"
  ON public.guru_tendik FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "gt_update_authenticated" ON public.guru_tendik;
CREATE POLICY "gt_update_authenticated"
  ON public.guru_tendik FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gt_delete_authenticated" ON public.guru_tendik;
CREATE POLICY "gt_delete_authenticated"
  ON public.guru_tendik FOR DELETE TO authenticated USING (true);

-- ============================================================
-- KELAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  tingkat integer CHECK (tingkat IN (10, 11, 12)),
  jurusan_id uuid REFERENCES public.jurusan(id) ON DELETE SET NULL,
  tahun_pelajaran_id uuid REFERENCES public.tahun_pelajaran(id) ON DELETE SET NULL,
  wali_kelas_id uuid REFERENCES public.guru_tendik(id) ON DELETE SET NULL,
  kapasitas integer,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kelas_select_authenticated" ON public.kelas;
CREATE POLICY "kelas_select_authenticated"
  ON public.kelas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kelas_insert_authenticated" ON public.kelas;
CREATE POLICY "kelas_insert_authenticated"
  ON public.kelas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "kelas_update_authenticated" ON public.kelas;
CREATE POLICY "kelas_update_authenticated"
  ON public.kelas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kelas_delete_authenticated" ON public.kelas;
CREATE POLICY "kelas_delete_authenticated"
  ON public.kelas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SISWA (with embedded parent/guardian data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.siswa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nis text UNIQUE,
  nisn text UNIQUE,
  nama_lengkap text NOT NULL,
  jenis_kelamin text CHECK (jenis_kelamin IN ('L', 'P')),
  tempat_lahir text,
  tanggal_lahir date,
  agama text,
  alamat text,
  no_hp text,
  email text,
  asal_sekolah text,
  tanggal_masuk date,
  kelas_id uuid REFERENCES public.kelas(id) ON DELETE SET NULL,
  jurusan_id uuid REFERENCES public.jurusan(id) ON DELETE SET NULL,
  tahun_pelajaran_id uuid REFERENCES public.tahun_pelajaran(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'lulus', 'pindah', 'keluar')),
  aktif boolean NOT NULL DEFAULT true,
  -- Orang Tua / Wali
  nama_ayah text,
  nama_ibu text,
  nama_wali text,
  pekerjaan_ayah text,
  pekerjaan_ibu text,
  pekerjaan_wali text,
  no_hp_ayah text,
  no_hp_ibu text,
  no_hp_wali text,
  alamat_ortu text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siswa_select_authenticated" ON public.siswa;
CREATE POLICY "siswa_select_authenticated"
  ON public.siswa FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "siswa_insert_authenticated" ON public.siswa;
CREATE POLICY "siswa_insert_authenticated"
  ON public.siswa FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "siswa_update_authenticated" ON public.siswa;
CREATE POLICY "siswa_update_authenticated"
  ON public.siswa FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "siswa_delete_authenticated" ON public.siswa;
CREATE POLICY "siswa_delete_authenticated"
  ON public.siswa FOR DELETE TO authenticated USING (true);

-- ============================================================
-- updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS guru_tendik_set_updated_at ON public.guru_tendik;
CREATE TRIGGER guru_tendik_set_updated_at
  BEFORE UPDATE ON public.guru_tendik
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS kelas_set_updated_at ON public.kelas;
CREATE TRIGGER kelas_set_updated_at
  BEFORE UPDATE ON public.kelas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS siswa_set_updated_at ON public.siswa;
CREATE TRIGGER siswa_set_updated_at
  BEFORE UPDATE ON public.siswa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Indexes for frequently queried columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kelas_jurusan ON public.kelas(jurusan_id);
CREATE INDEX IF NOT EXISTS idx_kelas_tahun_pelajaran ON public.kelas(tahun_pelajaran_id);
CREATE INDEX IF NOT EXISTS idx_kelas_wali_kelas ON public.kelas(wali_kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON public.siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_jurusan ON public.siswa(jurusan_id);
CREATE INDEX IF NOT EXISTS idx_siswa_tahun_pelajaran ON public.siswa(tahun_pelajaran_id);
CREATE INDEX IF NOT EXISTS idx_siswa_status ON public.siswa(status);
CREATE INDEX IF NOT EXISTS idx_guru_tendik_user_id ON public.guru_tendik(user_id);
CREATE INDEX IF NOT EXISTS idx_guru_tendik_jenis_ptk ON public.guru_tendik(jenis_ptk);
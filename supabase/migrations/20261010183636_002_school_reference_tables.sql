/*
# School Foundation Tables: Tahun Pelajaran, Jurusan, Mata Pelajaran

## Overview
Creates three foundational reference tables for the school: academic years
(tahun pelajaran), vocational majors/concentrations (jurusan/konsentrasi
keahlian), and subjects (mata pelajaran). These are shared reference data that
all other school modules (siswa, kelas, presensi, CBT, rapor, PKL) will link to.

## New Tables

### tahun_pelajaran
- `id` (uuid, PK)
- `nama` (text, unique, not null) — e.g. "2025/2026"
- `tanggal_mulai` (date) — start of academic year
- `tanggal_selesai` (date) — end of academic year
- `aktif` (boolean, default false) — whether this is the current academic year
- `created_at`, `updated_at` (timestamptz)

### jurusan
- `id` (uuid, PK)
- `kode` (text, unique, not null) — e.g. "TKJ", "RPL"
- `nama` (text, not null) — full name, e.g. "Teknik Komputer dan Jaringan"
- `deskripsi` (text) — optional description
- `aktif` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

### mata_pelajaran
- `id` (uuid, PK)
- `kode` (text, unique, not null) — e.g. "MAT-10"
- `nama` (text, not null) — e.g. "Matematika"
- `kelompok` (text) — category: A (wajib), B (peminatan), C (produktif), etc.
- `deskripsi` (text)
- `kkm` (integer) — minimum passing score (Kriteria Ketuntasan Minimal)
- `aktif` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on all three tables.
- All CRUD scoped to `authenticated` users (app has sign-in).
- No ownership column needed — these are shared reference data managed by
  school staff. Any authenticated staff member can read/write.

## Notes
1. These are reference/lookup tables shared across the entire school.
2. `tahun_pelajaran.aktif` flags the current academic year — enforce single
   active year at the application level.
3. `mata_pelajaran.kkm` stores the minimum passing score for each subject.
4. `jurusan` represents SMK vocational majors/concentrations.
5. All tables use ON DELETE RESTRICT (implied by no CASCADE) to prevent
   accidental deletion of referenced reference data.
*/

-- ============================================================
-- TAHUN PELAJARAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tahun_pelajaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text UNIQUE NOT NULL,
  tanggal_mulai date,
  tanggal_selesai date,
  aktif boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tahun_pelajaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tp_select_authenticated" ON public.tahun_pelajaran;
CREATE POLICY "tp_select_authenticated"
  ON public.tahun_pelajaran FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tp_insert_authenticated" ON public.tahun_pelajaran;
CREATE POLICY "tp_insert_authenticated"
  ON public.tahun_pelajaran FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tp_update_authenticated" ON public.tahun_pelajaran;
CREATE POLICY "tp_update_authenticated"
  ON public.tahun_pelajaran FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tp_delete_authenticated" ON public.tahun_pelajaran;
CREATE POLICY "tp_delete_authenticated"
  ON public.tahun_pelajaran FOR DELETE TO authenticated USING (true);

-- ============================================================
-- JURUSAN / KONSENTRASI KEAHLIAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jurusan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE NOT NULL,
  nama text NOT NULL,
  deskripsi text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jurusan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jurusan_select_authenticated" ON public.jurusan;
CREATE POLICY "jurusan_select_authenticated"
  ON public.jurusan FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jurusan_insert_authenticated" ON public.jurusan;
CREATE POLICY "jurusan_insert_authenticated"
  ON public.jurusan FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "jurusan_update_authenticated" ON public.jurusan;
CREATE POLICY "jurusan_update_authenticated"
  ON public.jurusan FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "jurusan_delete_authenticated" ON public.jurusan;
CREATE POLICY "jurusan_delete_authenticated"
  ON public.jurusan FOR DELETE TO authenticated USING (true);

-- ============================================================
-- MATA PELAJARAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mata_pelajaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE NOT NULL,
  nama text NOT NULL,
  kelompok text,
  deskripsi text,
  kkm integer,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mata_pelajaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mapel_select_authenticated" ON public.mata_pelajaran;
CREATE POLICY "mapel_select_authenticated"
  ON public.mata_pelajaran FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "mapel_insert_authenticated" ON public.mata_pelajaran;
CREATE POLICY "mapel_insert_authenticated"
  ON public.mata_pelajaran FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "mapel_update_authenticated" ON public.mata_pelajaran;
CREATE POLICY "mapel_update_authenticated"
  ON public.mata_pelajaran FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "mapel_delete_authenticated" ON public.mata_pelajaran;
CREATE POLICY "mapel_delete_authenticated"
  ON public.mata_pelajaran FOR DELETE TO authenticated USING (true);

-- ============================================================
-- updated_at triggers for all three tables
-- ============================================================
DROP TRIGGER IF EXISTS tahun_pelajaran_set_updated_at ON public.tahun_pelajaran;
CREATE TRIGGER tahun_pelajaran_set_updated_at
  BEFORE UPDATE ON public.tahun_pelajaran
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS jurusan_set_updated_at ON public.jurusan;
CREATE TRIGGER jurusan_set_updated_at
  BEFORE UPDATE ON public.jurusan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS mapel_set_updated_at ON public.mata_pelajaran;
CREATE TRIGGER mapel_set_updated_at
  BEFORE UPDATE ON public.mata_pelajaran
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
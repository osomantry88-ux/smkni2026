/*
# Master Ruangan and Shift Presensi tables + link to Kelas and Guru/Tendik

## Overview
Creates two new master data tables: `ruangan` (rooms) and `shift_presensi`
(attendance shifts). Links `kelas.ruangan` to the new `ruangan` master via
a new `ruangan_id` FK, and adds `shift_presensi_id` to both `kelas` and
`guru_tendik` (for Tendik only — Guru follows teaching schedule).

## New Tables

### ruangan
- `id` (uuid, PK)
- `kode` (text, unique, not null) — room code, e.g. "R-101"
- `nama` (text, not null) — room name, e.g. "Ruang Kelas 101"
- `lokasi` (text) — location/floor, e.g. "Lantai 1"
- `kapasitas` (integer) — seating capacity
- `aktif` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

### shift_presensi
- `id` (uuid, PK)
- `kode` (text, unique, not null) — shift code, e.g. "SHP-REG"
- `nama` (text, not null) — shift name, e.g. "Shift Reguler"
- `jam_masuk` (time, not null) — check-in time
- `batas_terlambat` (time, not null) — late threshold
- `jam_pulang` (time, not null) — check-out time
- `hari_aktif` (text[]) — array of active days, e.g. {"Senin","Selasa",...}
- `aktif` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

## Modified Tables

### kelas
- New column: `ruangan_id` (uuid, nullable, FK to ruangan)
- New column: `shift_presensi_id` (uuid, nullable, FK to shift_presensi)

### guru_tendik
- New column: `shift_presensi_id` (uuid, nullable, FK to shift_presensi)
  — Only used when jenis_ptk = 'tendik'. Guru follows teaching schedule.

## Security
- RLS enabled on both new tables.
- CRUD scoped to authenticated users (app has sign-in).

## Notes
1. The existing `kelas.ruangan` text column is preserved for backward
   compatibility. The new `ruangan_id` FK provides the structured link.
2. `shift_presensi.hari_aktif` uses a text array for flexibility.
3. Both tables are master data shared across modules (Kelas, CBT, Jadwal).
*/

-- ============================================================
-- RUANGAN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ruangan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE NOT NULL,
  nama text NOT NULL,
  lokasi text,
  kapasitas integer,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ruangan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ruangan_select_authenticated" ON public.ruangan;
CREATE POLICY "ruangan_select_authenticated"
  ON public.ruangan FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ruangan_insert_authenticated" ON public.ruangan;
CREATE POLICY "ruangan_insert_authenticated"
  ON public.ruangan FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ruangan_update_authenticated" ON public.ruangan;
CREATE POLICY "ruangan_update_authenticated"
  ON public.ruangan FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ruangan_delete_authenticated" ON public.ruangan;
CREATE POLICY "ruangan_delete_authenticated"
  ON public.ruangan FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SHIFT PRESENSI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shift_presensi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE NOT NULL,
  nama text NOT NULL,
  jam_masuk time NOT NULL,
  batas_terlambat time NOT NULL,
  jam_pulang time NOT NULL,
  hari_aktif text[] NOT NULL DEFAULT '{"Senin","Selasa","Rabu","Kamis","Jumat"}',
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_presensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_presensi_select_authenticated" ON public.shift_presensi;
CREATE POLICY "shift_presensi_select_authenticated"
  ON public.shift_presensi FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_presensi_insert_authenticated" ON public.shift_presensi;
CREATE POLICY "shift_presensi_insert_authenticated"
  ON public.shift_presensi FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "shift_presensi_update_authenticated" ON public.shift_presensi;
CREATE POLICY "shift_presensi_update_authenticated"
  ON public.shift_presensi FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shift_presensi_delete_authenticated" ON public.shift_presensi;
CREATE POLICY "shift_presensi_delete_authenticated"
  ON public.shift_presensi FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Add FK columns to kelas
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kelas' AND column_name = 'ruangan_id') THEN
    ALTER TABLE public.kelas ADD COLUMN ruangan_id uuid REFERENCES public.ruangan(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kelas' AND column_name = 'shift_presensi_id') THEN
    ALTER TABLE public.kelas ADD COLUMN shift_presensi_id uuid REFERENCES public.shift_presensi(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Add shift_presensi_id to guru_tendik
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guru_tendik' AND column_name = 'shift_presensi_id') THEN
    ALTER TABLE public.guru_tendik ADD COLUMN shift_presensi_id uuid REFERENCES public.shift_presensi(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS ruangan_set_updated_at ON public.ruangan;
CREATE TRIGGER ruangan_set_updated_at
  BEFORE UPDATE ON public.ruangan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS shift_presensi_set_updated_at ON public.shift_presensi;
CREATE TRIGGER shift_presensi_set_updated_at
  BEFORE UPDATE ON public.shift_presensi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kelas_ruangan_id ON public.kelas(ruangan_id);
CREATE INDEX IF NOT EXISTS idx_kelas_shift_presensi_id ON public.kelas(shift_presensi_id);
CREATE INDEX IF NOT EXISTS idx_guru_tendik_shift_presensi_id ON public.guru_tendik(shift_presensi_id);
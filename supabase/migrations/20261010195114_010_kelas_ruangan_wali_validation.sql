/*
# Add ruangan column to kelas table

## Overview
Adds a `ruangan` (room) column to the existing `kelas` table to track
the physical room assigned to each class. Also adds a partial unique
index to prevent the same wali kelas from being assigned to two active
classes in the same tahun pelajaran.

## Changes
### kelas table
- New column: `ruangan` (text, nullable) — physical room/location, e.g. "Ruang 101"

### Validation
- Partial unique index: one wali_kelas cannot be active in two classes
  within the same tahun_pelajaran. Enforced at the DB level.
*/

-- 1. Add ruangan column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kelas' AND column_name = 'ruangan') THEN
    ALTER TABLE public.kelas ADD COLUMN ruangan text;
  END IF;
END $$;

-- 2. Prevent duplicate wali kelas assignment in same active tahun pelajaran
--    (only applies when both kelas are active and wali_kelas_id + tahun_pelajaran_id are set)
DROP INDEX IF EXISTS idx_kelas_unique_wali_aktif;
CREATE UNIQUE INDEX idx_kelas_unique_wali_aktif
  ON public.kelas (wali_kelas_id, tahun_pelajaran_id)
  WHERE aktif = true AND wali_kelas_id IS NOT NULL AND tahun_pelajaran_id IS NOT NULL;
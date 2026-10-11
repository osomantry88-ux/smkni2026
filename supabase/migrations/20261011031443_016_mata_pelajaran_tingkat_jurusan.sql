/*
# Add tingkat and jurusan_id to mata_pelajaran

1. Modified Tables
- `mata_pelajaran`: add `tingkat` integer column (nullable, for grades 10/11/12).
- `mata_pelajaran`: add `jurusan_id` uuid column (nullable, FK to jurusan).
  This allows mapel to be scoped to a specific tingkat and/or jurusan.
  Same mapel name can exist for different tingkat (e.g. "Matematika" for grade 10 and 11).

2. Security
- No RLS changes needed — existing policies cover new columns automatically.
3. Important Notes
- Both columns are nullable so existing mapel data is not broken.
- jurusan_id references jurusan(id) ON DELETE SET NULL.
*/

ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS tingkat integer;
ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS jurusan_id uuid REFERENCES jurusan(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mapel_tingkat ON mata_pelajaran(tingkat);
CREATE INDEX IF NOT EXISTS idx_mapel_jurusan ON mata_pelajaran(jurusan_id);

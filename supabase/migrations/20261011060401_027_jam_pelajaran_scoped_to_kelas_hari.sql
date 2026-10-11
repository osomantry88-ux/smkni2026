-- Add kelas/hari/TP scoping to jam_pelajaran
ALTER TABLE jam_pelajaran ADD COLUMN IF NOT EXISTS tahun_pelajaran_id uuid REFERENCES tahun_pelajaran(id) ON DELETE SET NULL;
ALTER TABLE jam_pelajaran ADD COLUMN IF NOT EXISTS kelas_id uuid REFERENCES kelas(id) ON DELETE CASCADE;
ALTER TABLE jam_pelajaran ADD COLUMN IF NOT EXISTS hari text DEFAULT 'Senin';
ALTER TABLE jam_pelajaran ADD COLUMN IF NOT EXISTS catatan text;

-- Allow same kode for different kelas/hari by dropping the old unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jam_pelajaran_kode_key') THEN
    ALTER TABLE jam_pelajaran DROP CONSTRAINT jam_pelajaran_kode_key;
  END IF;
END $$;

-- Unique per kelas + hari + urutan (prevents duplicate periode for same kelas/hari)
CREATE UNIQUE INDEX IF NOT EXISTS jam_pelajaran_kelas_hari_urutan_unique
  ON jam_pelajaran (kelas_id, hari, urutan)
  WHERE kelas_id IS NOT NULL;

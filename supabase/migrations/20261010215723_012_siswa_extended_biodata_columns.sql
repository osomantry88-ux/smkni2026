-- Add missing columns to siswa for import and extended biodata
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik_ayah text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik_ibu text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik_wali text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS tahun_lahir_ayah text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS tahun_lahir_ibu text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS pendidikan_ayah text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS pendidikan_ibu text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS pendidikan_wali text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS penghasilan_ayah text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS penghasilan_ibu text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS penghasilan_wali text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS hubungan_wali text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS alamat_ayah text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS alamat_ibu text;
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS alamat_wali text;

-- Add unique constraint on NIK (nullable, so only non-null values are checked)
CREATE UNIQUE INDEX IF NOT EXISTS siswa_nik_unique_idx ON siswa(nik) WHERE nik IS NOT NULL;

-- Add unique constraint on RFID for active siswa
CREATE UNIQUE INDEX IF NOT EXISTS siswa_rfid_active_unique_idx ON siswa(no_rfid) WHERE no_rfid IS NOT NULL;

-- Add unique constraint on RFID for active guru_tendik
CREATE UNIQUE INDEX IF NOT EXISTS guru_tendik_rfid_active_unique_idx ON guru_tendik(no_rfid) WHERE no_rfid IS NOT NULL;

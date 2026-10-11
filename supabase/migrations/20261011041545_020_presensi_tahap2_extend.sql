/*
# Extend presensi_siswa and presensi_settings for Tahap 2 transactions

## Changes to presensi_siswa (ADD COLUMNS ONLY — no data loss)
- shift_id (uuid, nullable, FK → shift_presensi.id) — snapshot of the class's shift at time of presensi
- status_pulang (text, nullable) — status for pulang phase
- latitude_pulang (double precision, nullable)
- longitude_pulang (double precision, nullable)
- foto_pulang_url (text, nullable)
- jarak_pulang_meter (double precision, nullable)

## Changes to presensi_settings (ADD COLUMNS ONLY)
- presensi_masuk_aktif (boolean, default true) — global toggle for masuk phase
- presensi_pulang_aktif (boolean, default true) — global toggle for pulang phase
- anti_duplikasi_aktif (boolean, default true) — prevent duplicate masuk
- batas_duplikasi_menit (integer, default 1) — minimum minutes between taps before considered duplicate
- jam_pulang_buka (text, nullable) — earliest time pulang presensi is accepted (HH:MM format)
- jam_pulang_tutup (text, nullable) — latest time pulang presensi is accepted (HH:MM format)

## Security
- No RLS policy changes needed — existing policies already cover new columns.
- New index on shift_id for query performance.
*/

-- ============================================================
-- 1. Add columns to presensi_siswa
-- ============================================================
ALTER TABLE presensi_siswa ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shift_presensi(id) ON DELETE SET NULL;
ALTER TABLE presensi_siswa ADD COLUMN IF NOT EXISTS status_pulang text;
ALTER TABLE presensi_siswa ADD COLUMN IF NOT EXISTS latitude_pulang double precision;
ALTER TABLE presensi_siswa ADD COLUMN IF NOT EXISTS longitude_pulang double precision;
ALTER TABLE presensi_siswa ADD COLUMN IF NOT EXISTS foto_pulang_url text;
ALTER TABLE presensi_siswa ADD COLUMN IF NOT EXISTS jarak_pulang_meter double precision;

CREATE INDEX IF NOT EXISTS idx_presensi_shift ON presensi_siswa (shift_id);

-- ============================================================
-- 2. Add columns to presensi_settings
-- ============================================================
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS presensi_masuk_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS presensi_pulang_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS anti_duplikasi_aktif boolean NOT NULL DEFAULT true;
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS batas_duplikasi_menit integer NOT NULL DEFAULT 1;
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS jam_pulang_buka text;
ALTER TABLE presensi_settings ADD COLUMN IF NOT EXISTS jam_pulang_tutup text;

-- Ensure settings row exists
INSERT INTO presensi_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

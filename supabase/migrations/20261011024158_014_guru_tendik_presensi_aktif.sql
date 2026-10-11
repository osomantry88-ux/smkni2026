/*
# Add presensi_aktif column to guru_tendik

1. Modified Tables
- `guru_tendik`: add `presensi_aktif` boolean column, default true.
  This controls whether presensi tracking is active for this person,
  separate from the general `aktif` field which controls employment status.
2. Security
- No changes to RLS — existing policies cover the new column automatically.
*/

ALTER TABLE guru_tendik ADD COLUMN IF NOT EXISTS presensi_aktif boolean NOT NULL DEFAULT true;

-- Partial unique indexes for duplicate prevention at the database level.
-- These complement the frontend validation by enforcing uniqueness even if
-- a client bypasses the UI checks. Partial indexes (WHERE IS NOT NULL) ensure
-- that NULL values don't conflict with each other.

-- Guru & Tendik: NIP, NUPTK, NIK unique among active records
CREATE UNIQUE INDEX IF NOT EXISTS guru_tendik_nip_unique
  ON guru_tendik (nip) WHERE nip IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guru_tendik_nuptk_unique
  ON guru_tendik (nuptk) WHERE nuptk IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guru_tendik_nik_unique
  ON guru_tendik (nik) WHERE nik IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guru_tendik_rfid_unique
  ON guru_tendik (no_rfid) WHERE no_rfid IS NOT NULL AND aktif = true;

-- Siswa: NIS, NISN, NIK unique; RFID unique among active
CREATE UNIQUE INDEX IF NOT EXISTS siswa_nis_unique
  ON siswa (nis) WHERE nis IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS siswa_nisn_unique
  ON siswa (nisn) WHERE nisn IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS siswa_nik_unique
  ON siswa (nik) WHERE nik IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS siswa_rfid_unique
  ON siswa (no_rfid) WHERE no_rfid IS NOT NULL AND aktif = true;

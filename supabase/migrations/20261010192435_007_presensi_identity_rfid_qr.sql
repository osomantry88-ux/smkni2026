/*
# Add Presensi Identity (RFID & QR) to Siswa and Guru/Tendik

## Overview
Integrates attendance identity (RFID and QR Code) directly into existing
siswa and guru_tendik biodata. No new person records are created — RFID
and QR point to the same record. QR codes are generated on-demand from
existing identifiers (NISN for siswa; NIP > NUPTK > NIK for guru_tendik),
not stored as images.

## Changes to siswa table
- `no_rfid` (text, nullable) — active RFID card number, unique across siswa
- Unique index on `nisn` (NISN must be unique for QR code generation)
- Unique index on `no_rfid` WHERE not null (one active RFID per siswa)

## Changes to guru_tendik table
- `nik` (text, nullable) — National ID, used as QR fallback
- `no_rfid` (text, nullable) — active RFID card number, unique across guru_tendik
- Unique index on `nip` WHERE not null
- Unique index on `nuptk` WHERE not null
- Unique index on `nik` WHERE not null
- Unique index on `no_rfid` WHERE not null

## New table: rfid_history
Tracks RFID card assignment history per person. When RFID is replaced,
old RFID is deactivated (not deleted) so history is preserved.
- `id` (uuid, PK)
- `person_type` ('siswa' | 'guru_tendik') — which table this belongs to
- `person_id` (uuid) — FK to siswa.id or guru_tendik.id
- `no_rfid` (text, not null) — the RFID number assigned
- `status` ('aktif' | 'nonaktif') — whether this card is currently active
- `assigned_at` (timestamptz) — when the card was assigned
- `deactivated_at` (timestamptz, nullable) — when the card was replaced
- `notes` (text, nullable)
- `created_at` (timestamptz)

## Security
- RLS enabled on rfid_history, SELECT/INSERT/UPDATE/DELETE for authenticated
- Uses ON DELETE CASCADE so deleting a person cleans up their RFID history

## Notes
1. QR codes are NOT stored in the database — they are generated on-demand
   from existing identifiers (NISN for siswa; NIP > NUPTK > NIK for guru).
2. Only one RFID can be active per person (enforced by unique partial index).
3. RFID uniqueness is enforced at the database level via partial unique indexes.
4. When RFID is changed, the old RFID record in rfid_history is set to
   'nonaktif' and a new 'aktif' record is inserted.
5. This migration is idempotent — safe to re-run.
*/

-- Add no_rfid column to siswa
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa' AND column_name = 'no_rfid') THEN
    ALTER TABLE public.siswa ADD COLUMN no_rfid text;
  END IF;
END $$;

-- Add nik and no_rfid columns to guru_tendik
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guru_tendik' AND column_name = 'nik') THEN
    ALTER TABLE public.guru_tendik ADD COLUMN nik text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guru_tendik' AND column_name = 'no_rfid') THEN
    ALTER TABLE public.guru_tendik ADD COLUMN no_rfid text;
  END IF;
END $$;

-- Unique indexes on siswa
CREATE UNIQUE INDEX IF NOT EXISTS siswa_nisn_unique
  ON public.siswa (nisn) WHERE nisn IS NOT NULL AND nisn != '';

CREATE UNIQUE INDEX IF NOT EXISTS siswa_rfid_unique
  ON public.siswa (no_rfid) WHERE no_rfid IS NOT NULL AND no_rfid != '';

-- Unique indexes on guru_tendik
CREATE UNIQUE INDEX IF NOT EXISTS gt_nip_unique
  ON public.guru_tendik (nip) WHERE nip IS NOT NULL AND nip != '';

CREATE UNIQUE INDEX IF NOT EXISTS gt_nuptk_unique
  ON public.guru_tendik (nuptk) WHERE nuptk IS NOT NULL AND nuptk != '';

CREATE UNIQUE INDEX IF NOT EXISTS gt_nik_unique
  ON public.guru_tendik (nik) WHERE nik IS NOT NULL AND nik != '';

CREATE UNIQUE INDEX IF NOT EXISTS gt_rfid_unique
  ON public.guru_tendik (no_rfid) WHERE no_rfid IS NOT NULL AND no_rfid != '';

-- Create rfid_history table
CREATE TABLE IF NOT EXISTS public.rfid_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type text NOT NULL CHECK (person_type IN ('siswa', 'guru_tendik')),
  person_id uuid NOT NULL,
  no_rfid text NOT NULL,
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys with CASCADE delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfid_history_siswa_fk') THEN
    ALTER TABLE public.rfid_history
      ADD CONSTRAINT rfid_history_siswa_fk
      FOREIGN KEY (person_id) REFERENCES public.siswa(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfid_history_gt_fk') THEN
    ALTER TABLE public.rfid_history
      ADD CONSTRAINT rfid_history_gt_fk
      FOREIGN KEY (person_id) REFERENCES public.guru_tendik(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for querying a person's RFID history
CREATE INDEX IF NOT EXISTS rfid_history_person_idx
  ON public.rfid_history (person_type, person_id, assigned_at DESC);

-- RLS on rfid_history
ALTER TABLE public.rfid_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfid_history_select_authenticated" ON public.rfid_history;
CREATE POLICY "rfid_history_select_authenticated"
  ON public.rfid_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rfid_history_insert_authenticated" ON public.rfid_history;
CREATE POLICY "rfid_history_insert_authenticated"
  ON public.rfid_history FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rfid_history_update_authenticated" ON public.rfid_history;
CREATE POLICY "rfid_history_update_authenticated"
  ON public.rfid_history FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rfid_history_delete_authenticated" ON public.rfid_history;
CREATE POLICY "rfid_history_delete_authenticated"
  ON public.rfid_history FOR DELETE
  TO authenticated USING (true);
/*
# Create school_settings table — central school configuration

1. New Tables
- `school_settings`: single-row configuration table holding all school-wide settings.
  - `id` (int, primary key, always 1) — enforced singleton via CHECK constraint.
  - `nama_sekolah` (text) — school name.
  - `npsn` (text) — National School Identification Number.
  - `nss` (text) — National School Standard number (optional).
  - `alamat` (text) — school street address.
  - `kecamatan` (text) — sub-district.
  - `kabupaten` (text) — regency/city.
  - `provinsi` (text) — province.
  - `kode_pos` (text) — postal code.
  - `no_telepon` (text) — phone number.
  - `email` (text) — official email.
  - `website` (text) — website URL.
  - `logo_url` (text) — path to logo in storage bucket `school-logos`.
  - `latitude` (double precision) — school location latitude for presensi validation.
  - `longitude` (double precision) — school location longitude for presensi validation.
  - `radius_presensi` (integer) — presensi radius in meters.
  - `hari_aktif` (text[]) — active school days, e.g. {'Senin','Selasa',...}.
  - `jam_mulai` (text) — school start time (HH:MM).
  - `jam_batas_terlambat` (text) — late threshold time (HH:MM).
  - `jam_selesai` (text) — school end time (HH:MM).
  - `kepala_sekolah_id` (uuid, FK to guru_tendik) — linked headmaster record.
  - `tanda_tangan_kepsek_url` (text) — path to headmaster signature image in storage.
  - `notifikasi_jadwal_aktif` (boolean, default false) — enable schedule reminders.
  - `notifikasi_wa` (boolean, default false) — WhatsApp notification channel.
  - `notifikasi_push` (boolean, default false) — Push notification channel.
  - `created_at` (timestamptz), `updated_at` (timestamptz).

2. Security
- RLS enabled on `school_settings`.
- All authenticated users can SELECT (read) — needed for app-wide config.
- Only super_admin and admin can INSERT/UPDATE — enforced via user_roles check.
- No DELETE policy (singleton row should never be deleted).

3. Storage
- Creates `school-logos` storage bucket (public) for school logo uploads.
- Creates `school-signatures` storage bucket (public) for headmaster signature images.

4. Important Notes
- The table is a singleton: CHECK constraint forces id = 1.
- An initial empty row is inserted automatically.
- Latitude/longitude validation handled in application layer (-90..90, -180..180).
- Hari aktif uses text[] to store multiple day names.
*/

CREATE TABLE IF NOT EXISTS school_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nama_sekolah text NOT NULL DEFAULT '',
  npsn text,
  nss text,
  alamat text,
  kecamatan text,
  kabupaten text,
  provinsi text,
  kode_pos text,
  no_telepon text,
  email text,
  website text,
  logo_url text,
  latitude double precision,
  longitude double precision,
  radius_presensi integer DEFAULT 100,
  hari_aktif text[] DEFAULT ARRAY['Senin','Selasa','Rabu','Kamis','Jumat'],
  jam_mulai text DEFAULT '07:00',
  jam_batas_terlambat text DEFAULT '07:30',
  jam_selesai text DEFAULT '15:00',
  kepala_sekolah_id uuid REFERENCES guru_tendik(id) ON DELETE SET NULL,
  tanda_tangan_kepsek_url text,
  notifikasi_jadwal_aktif boolean NOT NULL DEFAULT false,
  notifikasi_wa boolean NOT NULL DEFAULT false,
  notifikasi_push boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
DROP POLICY IF EXISTS "read_school_settings" ON school_settings;
CREATE POLICY "read_school_settings"
  ON school_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/super_admin can insert
DROP POLICY IF EXISTS "insert_school_settings" ON school_settings;
CREATE POLICY "insert_school_settings"
  ON school_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Only admin/super_admin can update
DROP POLICY IF EXISTS "update_school_settings" ON school_settings;
CREATE POLICY "update_school_settings"
  ON school_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Insert the singleton row if it doesn't exist
INSERT INTO school_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Create storage buckets for logo and signature
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-signatures', 'school-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated can read, admin can write
DROP POLICY IF EXISTS "read_school_logos" ON storage.objects;
CREATE POLICY "read_school_logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'school-logos');

DROP POLICY IF EXISTS "write_school_logos" ON storage.objects;
CREATE POLICY "write_school_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_school_logos" ON storage.objects;
CREATE POLICY "update_school_logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_school_logos" ON storage.objects;
CREATE POLICY "delete_school_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Signature bucket policies
DROP POLICY IF EXISTS "read_school_signatures" ON storage.objects;
CREATE POLICY "read_school_signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'school-signatures');

DROP POLICY IF EXISTS "write_school_signatures" ON storage.objects;
CREATE POLICY "write_school_signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-signatures'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_school_signatures" ON storage.objects;
CREATE POLICY "update_school_signatures"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-signatures'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_school_signatures" ON storage.objects;
CREATE POLICY "delete_school_signatures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-signatures'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

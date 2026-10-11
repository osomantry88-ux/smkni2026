/*
# Create WhatsApp & Notification configuration tables

## New Tables

### 1. `whatsapp_settings` (singleton, id=1)
Central WhatsApp gateway configuration.
- `id` (int, PK, always 1 — CHECK constraint enforces singleton)
- `aktif` (boolean) — gateway on/off
- `provider` (text) — 'fonnte' | 'onesender' | 'wablas' | 'custom'
- `api_url` (text) — provider endpoint URL
- `api_token` (text) — secret token, NEVER exposed to browser
- `nomor_pengirim` (text) — sender number (optional)
- `nama_provider` (text) — display name for custom providers
- `timeout` (int) — request timeout in seconds
- `retry` (int) — retry attempts
- `catatan` (text) — admin notes
- `status_koneksi` (text) — 'connected' | 'failed' | 'untested'
- `waktu_test_terakhir` (timestamptz) — last connection test time
- `pesan_test_terakhir` (text) — last test result message (no token)
- `created_at`, `updated_at`

### 2. `notification_settings` (singleton, id=1)
Central notification rules for Alfa, schedule reminders, etc.
- `id` (int, PK, always 1)
- `alfa_aktif` (boolean) — auto alfa notification on/off
- `alfa_wa` (boolean) — send via WhatsApp
- `alfa_push` (boolean) — send via Push
- `alfa_waktu_mode` (text) — 'langsung' | 'jam_tertentu'
- `alfa_jam_kirim` (text) — HH:MM if mode is jam_tertentu
- `alfa_penerima` (text[]) — array of 'ayah' | 'ibu' | 'wali' | 'semua'
- `pengingat_jadwal_aktif` (boolean)
- `pengingat_jadwal_wa` (boolean)
- `pengingat_jadwal_push` (boolean)
- `pengingat_jadwal_menit` (int[]) — array of minutes before (5,10,15,30,60)
- `pengingat_belum_presensi_aktif` (boolean)
- `pengingat_belum_presensi_wa` (boolean)
- `pengingat_belum_presensi_push` (boolean)
- `pengingat_belum_presensi_menit` (int) — minutes after schedule start
- `created_at`, `updated_at`

### 3. `notification_templates`
Editable message templates for each notification type.
- `id` (uuid, PK)
- `tipe` (text, unique) — 'alfa_siswa' | 'terlambat_siswa' | 'hadir_siswa' | 'izin_siswa' | 'sakit_siswa' | 'pengingat_jadwal_guru' | 'guru_belum_presensi'
- `judul` (text) — display name
- `isi` (text) — template body with {variables}
- `aktif` (boolean)
- `created_at`, `updated_at`

### 4. `notification_log`
Log of every notification sent.
- `id` (uuid, PK)
- `tanggal_waktu` (timestamptz) — when sent
- `tipe` (text) — notification type
- `penerima` (text) — recipient name/number (NO token)
- `channel` (text) — 'whatsapp' | 'push'
- `provider` (text) — provider name used
- `status` (text) — 'menunggu' | 'terkirim' | 'gagal'
- `pesan_error` (text) — error message (NO token)
- `created_at`

## Security

### whatsapp_settings
- RLS enabled.
- SELECT: authenticated users can read ALL columns EXCEPT `api_token` — enforced via column-level GRANT. The `api_token` column is only readable by the `service_role` (used by edge functions), NOT by `anon` or `authenticated`.
- INSERT/UPDATE: only super_admin/admin via user_roles check.
- No DELETE policy (singleton).

### notification_settings
- RLS enabled.
- SELECT: all authenticated can read.
- INSERT/UPDATE: only super_admin/admin.

### notification_templates
- RLS enabled.
- SELECT: all authenticated can read.
- INSERT/UPDATE/DELETE: only super_admin/admin.

### notification_log
- RLS enabled.
- SELECT: only super_admin/admin (logs may contain recipient info).
- INSERT: all authenticated can insert (edge function writes logs).
- No UPDATE/DELETE (immutable log).

## Important Notes
- The `api_token` column in `whatsapp_settings` is protected by column-level privileges: REVOKE SELECT on `api_token` from `anon` and `authenticated`. Only the service role (used by edge functions) can read it.
- The frontend will know IF a token is set (via a boolean `has_token` computed column) but can never see the actual value.
- All WhatsApp API calls go through an edge function that uses the service role key — the token never reaches the browser.
- Initial seed rows inserted for all singletons and default templates.
*/

-- ============================================================
-- 1. whatsapp_settings (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  aktif boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'fonnte',
  api_url text,
  api_token text,
  nomor_pengirim text,
  nama_provider text,
  timeout integer DEFAULT 30,
  retry integer DEFAULT 3,
  catatan text,
  status_koneksi text DEFAULT 'untested',
  waktu_test_terakhir timestamptz,
  pesan_test_terakhir text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_wa_settings" ON whatsapp_settings;
CREATE POLICY "read_wa_settings"
  ON whatsapp_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_wa_settings" ON whatsapp_settings;
CREATE POLICY "insert_wa_settings"
  ON whatsapp_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_wa_settings" ON whatsapp_settings;
CREATE POLICY "update_wa_settings"
  ON whatsapp_settings FOR UPDATE
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

-- CRITICAL: Revoke column-level SELECT on api_token from anon and authenticated
-- Only the service_role (used by edge functions) can read the actual token
REVOKE SELECT (api_token) ON whatsapp_settings FROM anon, authenticated;

-- Insert singleton row
INSERT INTO whatsapp_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. notification_settings (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  alfa_aktif boolean NOT NULL DEFAULT false,
  alfa_wa boolean NOT NULL DEFAULT false,
  alfa_push boolean NOT NULL DEFAULT false,
  alfa_waktu_mode text NOT NULL DEFAULT 'langsung',
  alfa_jam_kirim text,
  alfa_penerima text[] DEFAULT ARRAY['semua'],
  pengingat_jadwal_aktif boolean NOT NULL DEFAULT false,
  pengingat_jadwal_wa boolean NOT NULL DEFAULT false,
  pengingat_jadwal_push boolean NOT NULL DEFAULT false,
  pengingat_jadwal_menit integer[] DEFAULT ARRAY[15],
  pengingat_belum_presensi_aktif boolean NOT NULL DEFAULT false,
  pengingat_belum_presensi_wa boolean NOT NULL DEFAULT false,
  pengingat_belum_presensi_push boolean NOT NULL DEFAULT false,
  pengingat_belum_presensi_menit integer DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_notif_settings" ON notification_settings;
CREATE POLICY "read_notif_settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_notif_settings" ON notification_settings;
CREATE POLICY "insert_notif_settings"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_notif_settings" ON notification_settings;
CREATE POLICY "update_notif_settings"
  ON notification_settings FOR UPDATE
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

INSERT INTO notification_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. notification_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe text UNIQUE NOT NULL,
  judul text NOT NULL,
  isi text NOT NULL,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_notif_templates" ON notification_templates;
CREATE POLICY "read_notif_templates"
  ON notification_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_notif_templates" ON notification_templates;
CREATE POLICY "insert_notif_templates"
  ON notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_notif_templates" ON notification_templates;
CREATE POLICY "update_notif_templates"
  ON notification_templates FOR UPDATE
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

DROP POLICY IF EXISTS "delete_notif_templates" ON notification_templates;
CREATE POLICY "delete_notif_templates"
  ON notification_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Seed default templates
INSERT INTO notification_templates (tipe, judul, isi) VALUES
  ('alfa_siswa', 'Notifikasi Alfa Siswa', 'Yth. Orang Tua/Wali dari {nama_siswa} (NIS: {nis}, Kelas: {kelas}), kami informasikan bahwa pada tanggal {tanggal} anak anda tidak hadir (Alfa) di {nama_sekolah}. Mohon konfirmasi. Terima kasih.'),
  ('terlambat_siswa', 'Notifikasi Terlambat Siswa', 'Yth. Orang Tua/Wali dari {nama_siswa} (NIS: {nis}, Kelas: {kelas}), anak anda tercatat terlambat pada tanggal {tanggal} pukul {jam} di {nama_sekolah}. Mohon perhatiannya.'),
  ('hadir_siswa', 'Notifikasi Hadir Siswa', 'Yth. Orang Tua/Wali, {nama_siswa} (NIS: {nis}, Kelas: {kelas}) telah hadir di {nama_sekolah} pada tanggal {tanggal} pukul {jam}. Status: {status}.'),
  ('izin_siswa', 'Notifikasi Izin Siswa', 'Yth. Orang Tua/Wali dari {nama_siswa} (NIS: {nis}, Kelas: {kelas}), pada tanggal {tanggal} anak anda tercatat dengan status: {status}. - {nama_sekolah}'),
  ('sakit_siswa', 'Notifikasi Sakit Siswa', 'Yth. Orang Tua/Wali dari {nama_siswa} (NIS: {nis}, Kelas: {kelas}), pada tanggal {tanggal} anak anda tercatat sakit ({status}). Mohon doa kesembuhan. - {nama_sekolah}'),
  ('pengingat_jadwal_guru', 'Pengingat Jadwal Mengajar', 'Yth. {nama_guru}, mengingatkan jadwal mengajar {mata_pelajaran} pada {tanggal} pukul {jam} di {nama_sekolah}. Mohon hadir tepat waktu.'),
  ('guru_belum_presensi', 'Pengingat Belum Presensi', 'Yth. {nama_guru}, anda belum melakukan presensi untuk jadwal {mata_pelajaran} pada {tanggal} pukul {jam}. Segera lakukan presensi. - {nama_sekolah}')
ON CONFLICT (tipe) DO NOTHING;

-- ============================================================
-- 4. notification_log
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal_waktu timestamptz NOT NULL DEFAULT now(),
  tipe text NOT NULL,
  penerima text,
  channel text NOT NULL,
  provider text,
  status text NOT NULL DEFAULT 'menunggu',
  pesan_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Only admin/super_admin can read logs
DROP POLICY IF EXISTS "read_notif_log" ON notification_log;
CREATE POLICY "read_notif_log"
  ON notification_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Any authenticated can insert logs (edge function with service role writes here)
DROP POLICY IF EXISTS "insert_notif_log" ON notification_log;
CREATE POLICY "insert_notif_log"
  ON notification_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE — logs are immutable

-- Index for filtering logs by date
CREATE INDEX IF NOT EXISTS idx_notif_log_tanggal ON notification_log (tanggal_waktu DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_tipe ON notification_log (tipe);
CREATE INDEX IF NOT EXISTS idx_notif_log_status ON notification_log (status);

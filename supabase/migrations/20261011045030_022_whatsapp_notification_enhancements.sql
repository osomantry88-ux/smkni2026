/*
# WhatsApp & Notification Enhancements

## Changes

### 1. whatsapp_settings: add device_id, rate_limit_delay, queue_paused
- `device_id` (text) — Sender/Device ID for providers that require it (e.g. Fonnte device ID, OneSender instance ID)
- `rate_limit_delay` (integer, default 2) — seconds between outgoing messages to avoid provider throttling
- `queue_paused` (boolean, default false) — admin can pause/resume the notification queue

### 2. notification_settings: fix defaults + add alfa schedule fields
- Fix terlambat/izin/sakit defaults to false (per spec: Hadir+Pulang active by default, others off)
- `alfa_hari_berlaku` (text[]) — days when alfa checking runs (e.g. ['Senin','Selasa',...])
- `alfa_jam_cek` (text) — time when alfa status is determined (e.g. '08:00')

### 3. notification_log: add detail columns
- `nama_siswa` (text) — student name for filtering
- `kelas` (text) — class name for filtering
- `nomor_tujuan` (text) — recipient phone number
- `pesan` (text) — the actual message content sent

### 4. notification_templates: add pulang_siswa template
- New template type 'pulang_siswa' for checkout notifications

## Security
- No new tables. RLS policies unchanged.
- device_id is not a secret — readable by authenticated.
- rate_limit_delay and queue_paused are config — readable by authenticated.
*/

-- ============================================================
-- 1. whatsapp_settings additions
-- ============================================================
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS rate_limit_delay integer NOT NULL DEFAULT 2;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS queue_paused boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. notification_settings: fix defaults + alfa schedule
-- ============================================================
-- Fix defaults: terlambat/izin/sakit should be OFF by default
ALTER TABLE notification_settings ALTER COLUMN terlambat_aktif SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN terlambat_wa SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN terlambat_push SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN izin_aktif SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN izin_wa SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN izin_push SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN sakit_aktif SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN sakit_wa SET DEFAULT false;
ALTER TABLE notification_settings ALTER COLUMN sakit_push SET DEFAULT false;

-- Update existing row to match spec defaults
UPDATE notification_settings SET
  terlambat_aktif = false, terlambat_wa = false, terlambat_push = false,
  izin_aktif = false, izin_wa = false, izin_push = false,
  sakit_aktif = false, sakit_wa = false, sakit_push = false
WHERE id = 1;

-- Alfa schedule fields
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS alfa_hari_berlaku text[] NOT NULL DEFAULT ARRAY['Senin','Selasa','Rabu','Kamis','Jumat'];
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS alfa_jam_cek text;

-- ============================================================
-- 3. notification_log: add detail columns
-- ============================================================
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS nama_siswa text;
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS kelas text;
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS nomor_tujuan text;
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS pesan text;

-- Add indexes for new filter columns
CREATE INDEX IF NOT EXISTS idx_notif_log_kelas ON notification_log (kelas);
CREATE INDEX IF NOT EXISTS idx_notif_log_nama_siswa ON notification_log (nama_siswa);

-- ============================================================
-- 4. notification_templates: add pulang_siswa template
-- ============================================================
INSERT INTO notification_templates (tipe, judul, isi) VALUES
  ('pulang_siswa', 'Notifikasi Pulang Siswa', 'Yth. Orang Tua/Wali, {nama_siswa} (NIS: {nis}, Kelas: {kelas}) telah pulang dari {nama_sekolah} pada tanggal {tanggal} pukul {jam}. Status: {status}.')
ON CONFLICT (tipe) DO NOTHING;

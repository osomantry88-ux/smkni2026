export const ALL_ROLES = [
  'super_admin',
  'admin',
  'kepala_sekolah',
  'guru',
  'wali_kelas',
  'guru_bk',
  'guru_piket',
  'pembina',
  'siswa',
  'orang_tua_wali',
] as const;

export type Role = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin / Operator',
  kepala_sekolah: 'Kepala Sekolah',
  guru: 'Guru',
  wali_kelas: 'Wali Kelas',
  guru_bk: 'Guru BK',
  guru_piket: 'Guru Piket',
  pembina: 'Pembina',
  siswa: 'Siswa',
  orang_tua_wali: 'Orang Tua / Wali',
};

export interface UserRole {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface UserDuty {
  id: string;
  user_id: string;
  duty: string;
  kelas_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface TahunPelajaran {
  id: string;
  nama: string;
  semester: 'ganjil' | 'genap';
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Jurusan {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface MataPelajaran {
  id: string;
  kode: string;
  nama: string;
  kelompok: string | null;
  tingkat: number | null;
  jurusan_id: string | null;
  deskripsi: string | null;
  kkm: number | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
  jurusan?: Jurusan | null;
}

export interface GuruTendik {
  id: string;
  nip: string | null;
  nuptk: string | null;
  nik: string | null;
  no_rfid: string | null;
  nama_lengkap: string;
  gelar_depan: string | null;
  gelar_belakang: string | null;
  jenis_kelamin: 'L' | 'P' | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  agama: string | null;
  alamat: string | null;
  no_hp: string | null;
  email: string | null;
  jenis_ptk: 'guru' | 'tendik';
  status_kepegawaian: string | null;
  jabatan: string | null;
  tanggal_masuk: string | null;
  aktif: boolean;
  shift_presensi_id: string | null;
  user_id: string | null;
  foto_url: string | null;
  presensi_aktif: boolean;
  created_at: string;
  updated_at: string;
  // Joined field
  shift_presensi?: ShiftPresensi | null;
}

export interface ShiftPresensiDetail {
  id: string;
  shift_presensi_id: string;
  hari: string;
  aktif: boolean;
  jam_masuk: string | null;
  batas_terlambat: string | null;
  jam_pulang: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ruangan {
  id: string;
  kode: string;
  nama: string;
  lokasi: string | null;
  kapasitas: number | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export type ShiftBerlakuUntuk = 'siswa' | 'tendik' | 'keduanya';

export interface ShiftPresensi {
  id: string;
  kode: string;
  nama: string;
  jam_masuk: string;
  batas_terlambat: string;
  jam_pulang: string;
  hari_aktif: string[];
  berlaku_untuk: ShiftBerlakuUntuk;
  keterangan: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Kelas {
  id: string;
  nama: string;
  tingkat: number | null;
  jurusan_id: string | null;
  tahun_pelajaran_id: string | null;
  wali_kelas_id: string | null;
  kapasitas: number | null;
  ruangan: string | null;
  ruangan_id: string | null;
  shift_presensi_id: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  jurusan?: Jurusan | null;
  tahun_pelajaran?: TahunPelajaran | null;
  wali_kelas?: GuruTendik | null;
  ruangan_ref?: Ruangan | null;
  shift_presensi?: ShiftPresensi | null;
  _count?: { siswa: number };
}

export interface Siswa {
  id: string;
  nis: string | null;
  nisn: string | null;
  nama_lengkap: string;
  jenis_kelamin: 'L' | 'P' | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  agama: string | null;
  alamat: string | null;
  no_hp: string | null;
  email: string | null;
  asal_sekolah: string | null;
  tanggal_masuk: string | null;
  kelas_id: string | null;
  jurusan_id: string | null;
  tahun_pelajaran_id: string | null;
  status: 'aktif' | 'lulus' | 'pindah' | 'keluar';
  aktif: boolean;
  no_rfid: string | null;
  foto_url: string | null;
  // Orang Tua / Wali
  nama_ayah: string | null;
  nama_ibu: string | null;
  nama_wali: string | null;
  pekerjaan_ayah: string | null;
  pekerjaan_ibu: string | null;
  pekerjaan_wali: string | null;
  no_hp_ayah: string | null;
  no_hp_ibu: string | null;
  no_hp_wali: string | null;
  alamat_ortu: string | null;
  nik: string | null;
  nik_ayah: string | null;
  nik_ibu: string | null;
  nik_wali: string | null;
  tahun_lahir_ayah: string | null;
  tahun_lahir_ibu: string | null;
  pendidikan_ayah: string | null;
  pendidikan_ibu: string | null;
  pendidikan_wali: string | null;
  penghasilan_ayah: string | null;
  penghasilan_ibu: string | null;
  penghasilan_wali: string | null;
  hubungan_wali: string | null;
  alamat_ayah: string | null;
  alamat_ibu: string | null;
  alamat_wali: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  kelas?: Kelas | null;
  jurusan?: Jurusan | null;
  tahun_pelajaran?: TahunPelajaran | null;
  user_id?: string | null;
}

export interface RfidHistory {
  id: string;
  person_type: 'siswa' | 'guru_tendik';
  person_id: string;
  no_rfid: string;
  status: 'aktif' | 'nonaktif';
  assigned_at: string;
  deactivated_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface SiswaKelasRiwayat {
  id: string;
  siswa_id: string;
  tahun_pelajaran_id: string;
  semester: 'ganjil' | 'genap';
  kelas_id: string | null;
  jurusan_id: string | null;
  status: 'aktif' | 'naik_kelas' | 'tinggal_kelas' | 'pindah_kelas' | 'pindah_jurusan' | 'lulus' | 'mutasi';
  catatan: string | null;
  created_at: string;
  updated_at: string;
  siswa?: Siswa | null;
  tahun_pelajaran?: TahunPelajaran | null;
  kelas?: Kelas | null;
  jurusan?: Jurusan | null;
}

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  banned: boolean;
  linked_type?: 'siswa' | 'guru_tendik' | null;
  linked_id?: string | null;
}

export interface JamPelajaran {
  id: string;
  kode: string;
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
  urutan: number;
  aktif: boolean;
  tahun_pelajaran_id: string | null;
  kelas_id: string | null;
  hari: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
}

export type HariSeminggu = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export interface JadwalMengajar {
  id: string;
  tahun_pelajaran_id: string;
  semester: 'ganjil' | 'genap';
  hari: HariSeminggu;
  jam_pelajaran_id: string;
  kelas_id: string;
  guru_id: string;
  mata_pelajaran_id: string;
  ruangan_id: string | null;
  catatan: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  jam_pelajaran?: JamPelajaran | null;
  kelas?: Kelas | null;
  guru?: GuruTendik | null;
  mata_pelajaran?: MataPelajaran | null;
  ruangan?: Ruangan | null;
  tahun_pelajaran?: TahunPelajaran | null;
}

export type JenisKalender =
  | 'hari_efektif'
  | 'libur_nasional'
  | 'libur_sekolah'
  | 'cuti_bersama'
  | 'libur_semester'
  | 'kegiatan_sekolah'
  | 'ujian'
  | 'pts'
  | 'pas_sas'
  | 'pkl_prakerin'
  | 'lainnya';

export interface KalenderPendidikan {
  id: string;
  tahun_pelajaran_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jenis: JenisKalender;
  nama_kegiatan: string;
  keterangan: string | null;
  hari_efektif: boolean;
  presensi_diperbolehkan: boolean;
  aktif: boolean;
  created_at: string;
  updated_at: string;
  tahun_pelajaran?: TahunPelajaran | null;
}

export const JENIS_KALENDER_LABELS: Record<JenisKalender, string> = {
  hari_efektif: 'Hari Efektif',
  libur_nasional: 'Libur Nasional',
  libur_sekolah: 'Libur Sekolah',
  cuti_bersama: 'Cuti Bersama',
  libur_semester: 'Libur Semester',
  kegiatan_sekolah: 'Kegiatan Sekolah',
  ujian: 'Ujian',
  pts: 'PTS',
  pas_sas: 'PAS/SAS',
  pkl_prakerin: 'PKL/Prakerin',
  lainnya: 'Lainnya',
};

export const JENIS_KALENDER_COLORS: Record<JenisKalender, string> = {
  hari_efektif: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  libur_nasional: 'bg-red-100 text-red-700 border-red-200',
  libur_sekolah: 'bg-orange-100 text-orange-700 border-orange-200',
  cuti_bersama: 'bg-amber-100 text-amber-700 border-amber-200',
  libur_semester: 'bg-blue-100 text-blue-700 border-blue-200',
  kegiatan_sekolah: 'bg-purple-100 text-purple-700 border-purple-200',
  ujian: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  pts: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  pas_sas: 'bg-teal-100 text-teal-700 border-teal-200',
  pkl_prakerin: 'bg-lime-100 text-lime-700 border-lime-200',
  lainnya: 'bg-gray-100 text-gray-700 border-gray-200',
};

export interface SchoolSettings {
  id: number;
  nama_sekolah: string;
  npsn: string | null;
  nss: string | null;
  alamat: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kode_pos: string | null;
  no_telepon: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_presensi: number | null;
  hari_aktif: string[];
  jam_mulai: string | null;
  jam_batas_terlambat: string | null;
  jam_selesai: string | null;
  kepala_sekolah_id: string | null;
  tanda_tangan_kepsek_url: string | null;
  notifikasi_jadwal_aktif: boolean;
  notifikasi_wa: boolean;
  notifikasi_push: boolean;
  created_at: string;
  updated_at: string;
  kepala_sekolah?: GuruTendik | null;
}

export type WhatsAppProvider = 'fonnte' | 'onesender' | 'wablas' | 'custom';

export interface WhatsAppSettings {
  id: number;
  aktif: boolean;
  provider: WhatsAppProvider;
  api_url: string | null;
  api_token: string | null;
  device_id: string | null;
  nomor_pengirim: string | null;
  nama_provider: string | null;
  timeout: number | null;
  retry: number | null;
  rate_limit_delay: number;
  queue_paused: boolean;
  catatan: string | null;
  status_koneksi: string | null;
  waktu_test_terakhir: string | null;
  pesan_test_terakhir: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  id: number;
  alfa_aktif: boolean;
  alfa_wa: boolean;
  alfa_push: boolean;
  alfa_waktu_mode: 'langsung' | 'jam_tertentu';
  alfa_jam_kirim: string | null;
  alfa_penerima: string[];
  pengingat_jadwal_aktif: boolean;
  pengingat_jadwal_wa: boolean;
  pengingat_jadwal_push: boolean;
  pengingat_jadwal_menit: number[];
  pengingat_belum_presensi_aktif: boolean;
  pengingat_belum_presensi_wa: boolean;
  pengingat_belum_presensi_push: boolean;
  pengingat_belum_presensi_menit: number;
  alfa_hari_berlaku: string[];
  alfa_jam_cek: string | null;
  hadir_aktif: boolean;
  hadir_wa: boolean;
  hadir_push: boolean;
  pulang_aktif: boolean;
  pulang_wa: boolean;
  pulang_push: boolean;
  terlambat_aktif: boolean;
  terlambat_wa: boolean;
  terlambat_push: boolean;
  izin_aktif: boolean;
  izin_wa: boolean;
  izin_push: boolean;
  sakit_aktif: boolean;
  sakit_wa: boolean;
  sakit_push: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationTemplateType =
  | 'alfa_siswa'
  | 'terlambat_siswa'
  | 'hadir_siswa'
  | 'pulang_siswa'
  | 'izin_siswa'
  | 'sakit_siswa'
  | 'pengingat_jadwal_guru'
  | 'guru_belum_presensi';

export interface NotificationTemplate {
  id: string;
  tipe: NotificationTemplateType;
  judul: string;
  isi: string;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  tanggal_waktu: string;
  tipe: string;
  penerima: string | null;
  nama_siswa: string | null;
  kelas: string | null;
  nomor_tujuan: string | null;
  channel: string;
  provider: string | null;
  status: 'menunggu' | 'terkirim' | 'gagal';
  pesan: string | null;
  pesan_error: string | null;
  created_at: string;
}

export type PresensiStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa';
export type PresensiMetode = 'rfid' | 'qr' | 'selfie_gps' | 'manual';

export interface PresensiSiswa {
  id: string;
  siswa_id: string;
  kelas_id: string | null;
  tahun_pelajaran_id: string | null;
  shift_id: string | null;
  tanggal: string;
  jam_masuk: string | null;
  status_masuk: PresensiStatus;
  metode_masuk: PresensiMetode | null;
  jam_pulang: string | null;
  metode_pulang: PresensiMetode | null;
  status_pulang: PresensiStatus | null;
  latitude: number | null;
  longitude: number | null;
  foto_url: string | null;
  jarak_meter: number | null;
  latitude_pulang: number | null;
  longitude_pulang: number | null;
  foto_pulang_url: string | null;
  jarak_pulang_meter: number | null;
  keterangan: string | null;
  dikoreksi_oleh: string | null;
  created_at: string;
  updated_at: string;
  siswa?: { id: string; nama_lengkap: string; nis: string | null; nisn: string | null; kelas_id: string | null; jurusan_id: string | null; foto_url: string | null } | null;
  kelas?: { id: string; nama: string; jurusan_id: string | null } | null;
}

export interface PresensiSettings {
  id: number;
  metode_rfid_aktif: boolean;
  metode_qr_aktif: boolean;
  metode_selfie_aktif: boolean;
  auto_alfa_aktif: boolean;
  batas_alfa_menit: number;
  presensi_masuk_aktif: boolean;
  presensi_pulang_aktif: boolean;
  anti_duplikasi_aktif: boolean;
  batas_duplikasi_menit: number;
  presensi_guru_aktif: boolean;
  presensi_tendik_aktif: boolean;
  created_at: string;
  updated_at: string;
}

export type PresensiGuruStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'tugas_luar' | 'cuti' | 'alfa';

export const PRESENSI_GURU_STATUS_LABELS: Record<PresensiGuruStatus, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  tugas_luar: 'Tugas Luar',
  cuti: 'Cuti',
  alfa: 'Alfa',
};

export const PRESENSI_GURU_STATUS_VARIANTS: Record<PresensiGuruStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  hadir: 'success',
  terlambat: 'warning',
  izin: 'info',
  sakit: 'neutral',
  tugas_luar: 'info',
  cuti: 'neutral',
  alfa: 'error',
};

export interface PresensiGuruTendik {
  id: string;
  guru_tendik_id: string;
  tahun_pelajaran_id: string | null;
  shift_id: string | null;
  jadwal_mengajar_id: string | null;
  tanggal: string;
  jam_masuk: string | null;
  status_masuk: PresensiGuruStatus;
  metode_masuk: PresensiMetode | null;
  jam_pulang: string | null;
  metode_pulang: PresensiMetode | null;
  status_pulang: PresensiGuruStatus | null;
  latitude: number | null;
  longitude: number | null;
  foto_url: string | null;
  jarak_meter: number | null;
  latitude_pulang: number | null;
  longitude_pulang: number | null;
  foto_pulang_url: string | null;
  jarak_pulang_meter: number | null;
  keterangan: string | null;
  dikoreksi_oleh: string | null;
  created_at: string;
  updated_at: string;
  guru_tendik?: { id: string; nama_lengkap: string; nip: string | null; nuptk: string | null; jenis_ptk: string; jabatan: string | null; user_id: string | null; foto_url: string | null } | null;
  shift_presensi?: { id: string; kode: string; nama: string } | null;
  jadwal_mengajar?: { id: string; hari: string; kelas_id: string; mata_pelajaran_id: string; jam_pelajaran_id: string; kelas?: { id: string; nama: string } | null; mata_pelajaran?: { id: string; nama: string } | null; jam_pelajaran?: { id: string; jam_mulai: string; jam_selesai: string } | null } | null;
}

export interface PresensiAuditLog {
  id: string;
  presensi_id: string;
  siswa_id: string;
  user_id: string;
  data_sebelum: Record<string, unknown> | null;
  data_sesudah: Record<string, unknown> | null;
  alasan: string | null;
  waktu: string;
}

export const PRESENSI_STATUS_LABELS: Record<PresensiStatus, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  alfa: 'Alfa',
};

export const PRESENSI_STATUS_VARIANTS: Record<PresensiStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  hadir: 'success',
  terlambat: 'warning',
  izin: 'info',
  sakit: 'neutral',
  alfa: 'error',
};

export const PRESENSI_METODE_LABELS: Record<PresensiMetode, string> = {
  rfid: 'RFID',
  qr: 'QR Code',
  selfie_gps: 'Selfie + GPS',
  manual: 'Manual',
};

export interface IotRfidDevice {
  id: string;
  sn: string;
  nama_mesin: string;
  lokasi: string | null;
  api_token: string | null;
  firmware_version: string | null;
  status: string;
  last_seen: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface IotRfidTap {
  id: string;
  device_sn: string | null;
  rfid: string;
  person_type: string | null;
  person_id: string | null;
  person_name: string | null;
  status: string;
  phase: string | null;
  jam: string | null;
  response: Record<string, unknown> | null;
  timestamp: string;
}

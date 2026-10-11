import { supabase } from './supabase';
import type { PresensiStatus, PresensiMetode, PresensiSettings, Siswa, Kelas } from '@/types/database';

export interface ShiftPresensiInfo {
  id: string;
  kode: string;
  nama: string;
  jam_masuk: string;
  batas_terlambat: string;
  jam_pulang: string;
  hari_aktif: string[];
  aktif: boolean;
}

export interface KalenderInfo {
  hari_efektif: boolean;
  presensi_diperbolehkan: boolean;
  jenis: string;
  nama_kegiatan: string | null;
}

export interface SchoolLocation {
  latitude: number | null;
  longitude: number | null;
  radius_presensi: number | null;
}

export type PresensiPhase = 'masuk' | 'pulang';

export interface PresensiResult {
  success: boolean;
  message: string;
  phase: PresensiPhase;
  siswa?: { id: string; nama_lengkap: string; nis: string | null; nisn: string | null };
  kelas?: { id: string; nama: string } | null;
  jam?: string;
  status?: PresensiStatus;
  metode?: PresensiMetode;
  jarak_meter?: number | null;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function nowTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function isTimeAfter(a: string, b: string): boolean {
  return a > b;
}

function isTimeBefore(a: string, b: string): boolean {
  return a < b;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function fetchPresensiSettings(): Promise<PresensiSettings | null> {
  const { data } = await supabase.from('presensi_settings').select('*').eq('id', 1).maybeSingle();
  return data as PresensiSettings | null;
}

export async function fetchSchoolLocation(): Promise<SchoolLocation> {
  const { data } = await supabase
    .from('school_settings')
    .select('latitude, longitude, radius_presensi')
    .eq('id', 1)
    .maybeSingle();
  return (data ?? { latitude: null, longitude: null, radius_presensi: null }) as SchoolLocation;
}

export async function checkKalenderPendidikan(tanggal: string, tpId: string | null): Promise<KalenderInfo> {
  const dayDate = new Date(tanggal + 'T00:00:00');
  const dayOfWeek = dayDate.getDay();

  // Sunday is always non-effective
  if (dayOfWeek === 0) {
    return { hari_efektif: false, presensi_diperbolehkan: false, jenis: 'libur', nama_kegiatan: 'Minggu' };
  }

  let query = supabase
    .from('kalender_pendidikan')
    .select('hari_efektif, presensi_diperbolehkan, jenis, nama_kegiatan')
    .lte('tanggal_mulai', tanggal)
    .gte('tanggal_selesai', tanggal)
    .eq('aktif', true);

  if (tpId) {
    query = query.eq('tahun_pelajaran_id', tpId);
  }

  const { data } = await query.maybeSingle();

  if (data) {
    return data as KalenderInfo;
  }

  // No calendar entry found — default to effective day
  return { hari_efektif: true, presensi_diperbolehkan: true, jenis: 'normal', nama_kegiatan: null };
}

export async function fetchSiswaByRfid(rfid: string): Promise<(Siswa & { kelas: Kelas | null }) | null> {
  const { data, error } = await supabase
    .from('siswa')
    .select('*, kelas:kelas_id(id, nama, tingkat, jurusan_id, shift_presensi_id)')
    .eq('no_rfid', rfid.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Siswa & { kelas: Kelas | null };
}

export async function fetchSiswaByNisn(nisn: string): Promise<(Siswa & { kelas: Kelas | null }) | null> {
  const { data, error } = await supabase
    .from('siswa')
    .select('*, kelas:kelas_id(id, nama, tingkat, jurusan_id, shift_presensi_id)')
    .eq('nisn', nisn.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Siswa & { kelas: Kelas | null };
}

export async function fetchShiftPresensi(shiftId: string): Promise<ShiftPresensiInfo | null> {
  const { data } = await supabase
    .from('shift_presensi')
    .select('id, kode, nama, jam_masuk, batas_terlambat, jam_pulang, hari_aktif, aktif')
    .eq('id', shiftId)
    .maybeSingle();
  return data as ShiftPresensiInfo | null;
}

export async function fetchActiveTahunPelajaran(): Promise<{ id: string; nama: string } | null> {
  const { data } = await supabase
    .from('tahun_pelajaran')
    .select('id, nama')
    .eq('aktif', true)
    .maybeSingle();
  return data as { id: string; nama: string } | null;
}

export async function fetchExistingPresensi(siswaId: string, tanggal: string) {
  const { data } = await supabase
    .from('presensi_siswa')
    .select('*')
    .eq('siswa_id', siswaId)
    .eq('tanggal', tanggal)
    .maybeSingle();
  return data;
}

function determineStatusMasuk(jamMasukShift: string, batasTerlambatShift: string, currentTime: string): PresensiStatus {
  if (isTimeAfter(currentTime, batasTerlambatShift)) {
    return 'terlambat';
  }
  return 'hadir';
}

function shouldProcessPulang(
  settings: PresensiSettings,
  existingJamMasuk: string | null,
  currentTime: string,
  shiftJamPulang: string | null,
): { canPulang: boolean; reason: string } {
  if (!settings.presensi_pulang_aktif) {
    return { canPulang: false, reason: 'Presensi pulang tidak aktif.' };
  }
  if (!existingJamMasuk) {
    return { canPulang: false, reason: 'Belum ada presensi masuk.' };
  }

  // Only allow pulang after shift jam_pulang
  if (shiftJamPulang && isTimeBefore(currentTime, shiftJamPulang)) {
    return { canPulang: false, reason: `Presensi pulang baru dapat dilakukan setelah pukul ${shiftJamPulang}.` };
  }

  return { canPulang: true, reason: '' };
}

export interface ProcessPresensiParams {
  siswa: Siswa & { kelas: Kelas | null };
  metode: PresensiMetode;
  settings: PresensiSettings;
  latitude?: number | null;
  longitude?: number | null;
  fotoPath?: string | null;
  jarakMeter?: number | null;
}

export async function processPresensi(params: ProcessPresensiParams): Promise<PresensiResult> {
  const { siswa, metode, settings, latitude, longitude, fotoPath, jarakMeter } = params;
  const tanggal = todayStr();
  const currentTime = nowTimeStr();

  // 1. Check siswa aktif
  if (!siswa.aktif) {
    return { success: false, message: 'Siswa tidak aktif. Tidak dapat melakukan presensi.', phase: 'masuk' };
  }

  // 2. Check kelas
  if (!siswa.kelas_id || !siswa.kelas) {
    return { success: false, message: 'Siswa belum ditempatkan di kelas. Tidak dapat melakukan presensi.', phase: 'masuk' };
  }

  // 3. Fetch shift from kelas
  const kelasWithShift = siswa.kelas as Kelas & { shift_presensi_id?: string | null };
  const shiftId = kelasWithShift.shift_presensi_id;
  if (!shiftId) {
    return { success: false, message: 'Kelas belum memiliki Shift Presensi. Hubungi Admin untuk mengatur shift kelas.', phase: 'masuk' };
  }

  const shift = await fetchShiftPresensi(shiftId);
  if (!shift || !shift.aktif) {
    return { success: false, message: 'Shift Presensi kelas tidak aktif. Hubungi Admin.', phase: 'masuk' };
  }

  // 4. Check hari aktif from shift
  const dayOfWeek = new Date().getDay().toString();
  if (shift.hari_aktif && shift.hari_aktif.length > 0 && !shift.hari_aktif.includes(dayOfWeek)) {
    return { success: false, message: 'Hari ini bukan hari aktif untuk shift kelas ini.', phase: 'masuk' };
  }

  // 5. Check kalender pendidikan
  const activeTp = await fetchActiveTahunPelajaran();
  const kalender = await checkKalenderPendidikan(tanggal, activeTp?.id ?? null);
  if (!kalender.presensi_diperbolehkan || !kalender.hari_efektif) {
    const info = kalender.nama_kegiatan ?? kalender.jenis;
    return { success: false, message: `Hari ini bukan hari efektif presensi${info ? `: ${info}` : ''}.`, phase: 'masuk' };
  }

  // 6. Check existing presensi
  const existing = await fetchExistingPresensi(siswa.id, tanggal);

  // 7. Determine masuk or pulang
  if (existing && existing.jam_masuk) {
    // Already has masuk — check if should process pulang
    if (existing.jam_pulang) {
      return {
        success: false,
        message: 'Presensi hari ini sudah lengkap (masuk dan pulang sudah tercatat).',
        phase: 'masuk',
        siswa: { id: siswa.id, nama_lengkap: siswa.nama_lengkap, nis: siswa.nis, nisn: siswa.nisn },
        kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama },
        jam: existing.jam_masuk.substring(0, 5),
      };
    }

    // Check anti-duplikasi
    if (settings.anti_duplikasi_aktif && settings.batas_duplikasi_menit > 0) {
      const masukTime = existing.jam_masuk.substring(0, 5);
      const [masukH, masukM] = masukTime.split(':').map(Number);
      const [nowH, nowM, nowS] = currentTime.split(':').map(Number);
      const diffSeconds = (nowH * 3600 + nowM * 60 + nowS) - (masukH * 3600 + masukM * 60);
      const diffMinutes = diffSeconds / 60;
      if (diffMinutes < settings.batas_duplikasi_menit) {
        return {
          success: false,
          message: 'Presensi masuk hari ini sudah tercatat. Tap terlalu cepat dianggap duplikat.',
          phase: 'masuk',
          siswa: { id: siswa.id, nama_lengkap: siswa.nama_lengkap, nis: siswa.nis, nisn: siswa.nisn },
          kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama },
          jam: existing.jam_masuk.substring(0, 5),
          status: existing.status_masuk as PresensiStatus,
          metode: existing.metode_masuk as PresensiMetode,
        };
      }
    }

    // Try pulang
    const pulangCheck = shouldProcessPulang(settings, existing.jam_masuk, currentTime, shift.jam_pulang);
    if (!pulangCheck.canPulang) {
      return {
        success: false,
        message: pulangCheck.reason,
        phase: 'pulang',
        siswa: { id: siswa.id, nama_lengkap: siswa.nama_lengkap, nis: siswa.nis, nisn: siswa.nisn },
        kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama },
        jam: existing.jam_masuk.substring(0, 5),
        status: existing.status_masuk as PresensiStatus,
        metode: existing.metode_masuk as PresensiMetode,
      };
    }

    // Process pulang — update existing record
    const updatePayload: Record<string, unknown> = {
      jam_pulang: currentTime,
      metode_pulang: metode,
      status_pulang: 'hadir',
      updated_at: new Date().toISOString(),
    };

    if (latitude != null) updatePayload.latitude_pulang = latitude;
    if (longitude != null) updatePayload.longitude_pulang = longitude;
    if (fotoPath) updatePayload.foto_pulang_url = fotoPath;
    if (jarakMeter != null) updatePayload.jarak_pulang_meter = jarakMeter;

    const { error: updateErr } = await supabase
      .from('presensi_siswa')
      .update(updatePayload)
      .eq('id', existing.id);

    if (updateErr) {
      return { success: false, message: `Gagal menyimpan presensi pulang: ${updateErr.message}`, phase: 'pulang' };
    }

    return {
      success: true,
      message: 'PRESENSI PULANG BERHASIL',
      phase: 'pulang',
      siswa: { id: siswa.id, nama_lengkap: siswa.nama_lengkap, nis: siswa.nis, nisn: siswa.nisn },
      kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama },
      jam: currentTime.substring(0, 5),
      status: 'hadir',
      metode,
      jarak_meter: jarakMeter ?? null,
    };
  }

  // Process masuk — new record
  if (!settings.presensi_masuk_aktif) {
    return { success: false, message: 'Presensi masuk tidak aktif.', phase: 'masuk' };
  }

  const statusMasuk = determineStatusMasuk(shift.jam_masuk, shift.batas_terlambat, currentTime);

  const insertPayload: Record<string, unknown> = {
    siswa_id: siswa.id,
    kelas_id: siswa.kelas_id,
    tahun_pelajaran_id: activeTp?.id ?? null,
    shift_id: shift.id,
    tanggal,
    jam_masuk: currentTime,
    status_masuk: statusMasuk,
    metode_masuk: metode,
    keterangan: null,
  };

  if (latitude != null) insertPayload.latitude = latitude;
  if (longitude != null) insertPayload.longitude = longitude;
  if (fotoPath) insertPayload.foto_url = fotoPath;
  if (jarakMeter != null) insertPayload.jarak_meter = jarakMeter;

  const { error: insertErr } = await supabase
    .from('presensi_siswa')
    .insert(insertPayload);

  if (insertErr) {
    // Check if it's a unique constraint violation (duplicate)
    if (insertErr.code === '23505') {
      return {
        success: false,
        message: 'Presensi masuk hari ini sudah tercatat.',
        phase: 'masuk',
        siswa: { id: siswa.id, nama_lengkap: siswa.nama_lengkap, nis: siswa.nis, nisn: siswa.nisn },
        kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama },
      };
    }
    return { success: false, message: `Gagal menyimpan presensi: ${insertErr.message}`, phase: 'masuk' };
  }

  return {
    success: true,
    message: statusMasuk === 'terlambat' ? 'PRESENSI BERHASIL — TERLAMBAT' : 'PRESENSI BERHASIL',
    phase: 'masuk',
    siswa: { id: siswa.id, nama_lengkap: siswa.nama_lengkap, nis: siswa.nis, nisn: siswa.nisn },
    kelas: { id: siswa.kelas.id, nama: siswa.kelas.nama },
    jam: currentTime.substring(0, 5),
    status: statusMasuk,
    metode,
    jarak_meter: jarakMeter ?? null,
  };
}

export async function processRfidPresensi(rfid: string, settings: PresensiSettings): Promise<PresensiResult> {
  if (!settings.metode_rfid_aktif) {
    return { success: false, message: 'Metode RFID tidak aktif.', phase: 'masuk' };
  }

  const siswa = await fetchSiswaByRfid(rfid);
  if (!siswa) {
    return { success: false, message: 'RFID TIDAK TERDAFTAR', phase: 'masuk' };
  }

  return processPresensi({ siswa, metode: 'rfid', settings });
}

export async function processQrPresensi(nisn: string, settings: PresensiSettings): Promise<PresensiResult> {
  if (!settings.metode_qr_aktif) {
    return { success: false, message: 'Metode QR Code tidak aktif.', phase: 'masuk' };
  }

  const siswa = await fetchSiswaByNisn(nisn);
  if (!siswa) {
    return { success: false, message: 'QR Code tidak valid. Siswa tidak ditemukan.', phase: 'masuk' };
  }

  return processPresensi({ siswa, metode: 'qr', settings });
}

export async function processSelfieGpsPresensi(
  nisn: string,
  settings: PresensiSettings,
  latitude: number,
  longitude: number,
  fotoPath: string | null,
): Promise<PresensiResult> {
  if (!settings.metode_selfie_aktif) {
    return { success: false, message: 'Metode Selfie + GPS tidak aktif.', phase: 'masuk' };
  }

  const siswa = await fetchSiswaByNisn(nisn);
  if (!siswa) {
    return { success: false, message: 'Siswa tidak ditemukan.', phase: 'masuk' };
  }

  // Check school location
  const schoolLoc = await fetchSchoolLocation();
  if (schoolLoc.latitude == null || schoolLoc.longitude == null) {
    return { success: false, message: 'Lokasi sekolah belum diatur. Hubungi Admin.', phase: 'masuk' };
  }

  const radius = schoolLoc.radius_presensi ?? 100;
  const jarak = haversineDistance(latitude, longitude, schoolLoc.latitude, schoolLoc.longitude);

  if (jarak > radius) {
    return {
      success: false,
      message: `Anda berada di luar radius presensi sekolah. Jarak: ${jarak} meter (radius: ${radius} meter).`,
      phase: 'masuk',
      jarak_meter: jarak,
    };
  }

  return processPresensi({
    siswa,
    metode: 'selfie_gps',
    settings,
    latitude,
    longitude,
    fotoPath,
    jarakMeter: jarak,
  });
}

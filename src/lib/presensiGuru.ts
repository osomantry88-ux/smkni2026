import { supabase } from './supabase';
import type {
  PresensiGuruStatus, PresensiMetode, PresensiSettings,
  GuruTendik, ShiftPresensi,
} from '@/types/database';

export interface PresensiGuruResult {
  success: boolean;
  message: string;
  phase: 'masuk' | 'pulang';
  guru?: { id: string; nama_lengkap: string; nip: string | null; jenis_ptk: string };
  jam?: string;
  status?: PresensiGuruStatus;
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

function isTimeAfter(a: string, b: string): boolean { return a > b; }
function isTimeBefore(a: string, b: string): boolean { return a < b; }

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const HARI_MAP: Record<string, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu',
  4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

export async function fetchGuruByRfid(rfid: string): Promise<GuruTendik | null> {
  const { data, error } = await supabase
    .from('guru_tendik')
    .select('*')
    .eq('no_rfid', rfid.trim())
    .eq('aktif', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as GuruTendik;
}

export async function fetchGuruByNip(nip: string): Promise<GuruTendik | null> {
  const { data, error } = await supabase
    .from('guru_tendik')
    .select('*')
    .eq('nip', nip.trim())
    .eq('aktif', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as GuruTendik;
}

export async function fetchGuruByUserId(userId: string): Promise<GuruTendik | null> {
  const { data, error } = await supabase
    .from('guru_tendik')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as GuruTendik;
}

export async function fetchShiftForGuru(guru: GuruTendik): Promise<ShiftPresensi | null> {
  if (!guru.shift_presensi_id) return null;
  const { data } = await supabase
    .from('shift_presensi')
    .select('*')
    .eq('id', guru.shift_presensi_id)
    .maybeSingle();
  return data as ShiftPresensi | null;
}

export async function fetchJadwalMengajarHariIni(guruId: string, hari: string) {
  const { data } = await supabase
    .from('jadwal_mengajar')
    .select(`
      *,
      jam_pelajaran:jam_pelajaran_id(id, jam_mulai, jam_selesai),
      kelas:kelas_id(id, nama),
      mata_pelajaran:mata_pelajaran_id(id, nama)
    `)
    .eq('guru_id', guruId)
    .eq('hari', hari)
    .eq('aktif', true)
    .order('jam_pelajaran(jam_mulai)', { ascending: true });
  return data ?? [];
}

interface ProcessGuruParams {
  guru: GuruTendik;
  metode: PresensiMetode;
  settings: PresensiSettings;
  latitude?: number | null;
  longitude?: number | null;
  fotoPath?: string | null;
  jarakMeter?: number | null;
}

export async function processPresensiGuru(params: ProcessGuruParams): Promise<PresensiGuruResult> {
  const { guru, metode, settings, latitude, longitude, fotoPath, jarakMeter } = params;
  const tanggal = todayStr();
  const currentTime = nowTimeStr();

  if (!guru.aktif) {
    return { success: false, message: 'Guru/Tendik tidak aktif.', phase: 'masuk' };
  }

  const isGuru = guru.jenis_ptk === 'guru';
  const isTendik = guru.jenis_ptk === 'tendik';

  if (isGuru && !settings.presensi_guru_aktif) {
    return { success: false, message: 'Presensi guru tidak aktif.', phase: 'masuk' };
  }
  if (isTendik && !settings.presensi_tendik_aktif) {
    return { success: false, message: 'Presensi tendik tidak aktif.', phase: 'masuk' };
  }

  // Determine time source
  let jamMasukRef: string | null = null;
  let batasTerlambatRef: string | null = null;
  let jamPulangRef: string | null = null;
  let shiftId: string | null = null;
  let jadwalId: string | null = null;

  if (isTendik) {
    // Tendik uses Shift Presensi
    const shift = await fetchShiftForGuru(guru);
    if (!shift || !shift.aktif) {
      return { success: false, message: 'Shift Presensi belum diatur untuk tendik ini. Hubungi Admin.', phase: 'masuk' };
    }
    jamMasukRef = shift.jam_masuk;
    batasTerlambatRef = shift.batas_terlambat;
    jamPulangRef = shift.jam_pulang;
    shiftId = shift.id;

    // Check hari aktif
    const dayOfWeek = new Date().getDay().toString();
    if (shift.hari_aktif && shift.hari_aktif.length > 0 && !shift.hari_aktif.includes(dayOfWeek)) {
      return { success: false, message: 'Hari ini bukan hari aktif untuk shift tendik ini.', phase: 'masuk' };
    }
  } else {
    // Guru uses Jadwal Mengajar as the sole time source
    const hariIni = HARI_MAP[new Date().getDay().toString()];
    const jadwalHariIni = await fetchJadwalMengajarHariIni(guru.id, hariIni);

    if (jadwalHariIni.length > 0) {
      const firstJadwal = jadwalHariIni[0] as { jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null; id: string };
      jamMasukRef = firstJadwal.jam_pelajaran?.jam_mulai ?? null;
      jamPulangRef = jadwalHariIni[jadwalHariIni.length - 1]?.jam_pelajaran?.jam_selesai ?? null;
      jadwalId = firstJadwal.id;
      // Batas terlambat = jam mulai jadwal pertama + 15 menit
      if (jamMasukRef) {
        const [h, m] = jamMasukRef.split(':').map(Number);
        const totalMin = h * 60 + m + 15;
        batasTerlambatRef = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
      }
    } else {
      // No jadwal today — guru can still clock in, but no terlambat determination
      jamMasukRef = null;
      batasTerlambatRef = null;
      jamPulangRef = null;
    }
  }

  // Check kalender pendidikan
  const { data: activeTp } = await supabase
    .from('tahun_pelajaran')
    .select('id, nama')
    .eq('aktif', true)
    .maybeSingle();

  const { data: kalenderData } = await supabase
    .from('kalender_pendidikan')
    .select('hari_efektif, presensi_diperbolehkan, jenis, nama_kegiatan')
    .lte('tanggal_mulai', tanggal)
    .gte('tanggal_selesai', tanggal)
    .eq('aktif', true)
    .maybeSingle();

  if (kalenderData) {
    const kalender = kalenderData as { hari_efektif: boolean; presensi_diperbolehkan: boolean; jenis: string; nama_kegiatan: string | null };
    if (!kalender.presensi_diperbolehkan || !kalender.hari_efektif) {
      const info = kalender.nama_kegiatan ?? kalender.jenis;
      return { success: false, message: `Hari ini bukan hari efektif presensi${info ? `: ${info}` : ''}.`, phase: 'masuk' };
    }
  }

  // Check existing
  const { data: existing } = await supabase
    .from('presensi_guru_tendik')
    .select('*')
    .eq('guru_tendik_id', guru.id)
    .eq('tanggal', tanggal)
    .maybeSingle();

  if (existing) {
    // Has masuk already
    if (existing.jam_masuk && existing.jam_pulang) {
      return {
        success: false,
        message: 'Presensi hari ini sudah lengkap (masuk dan pulang).',
        phase: 'masuk',
        guru: { id: guru.id, nama_lengkap: guru.nama_lengkap, nip: guru.nip, jenis_ptk: guru.jenis_ptk },
        jam: existing.jam_masuk.substring(0, 5),
      };
    }

    if (existing.jam_masuk && !existing.jam_pulang) {
      // Process pulang
      if (!settings.presensi_pulang_aktif) {
        return { success: false, message: 'Presensi pulang tidak aktif.', phase: 'pulang' };
      }

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
        .from('presensi_guru_tendik')
        .update(updatePayload)
        .eq('id', existing.id);

      if (updateErr) {
        return { success: false, message: `Gagal menyimpan presensi pulang: ${updateErr.message}`, phase: 'pulang' };
      }

      return {
        success: true,
        message: 'PRESENSI PULANG BERHASIL',
        phase: 'pulang',
        guru: { id: guru.id, nama_lengkap: guru.nama_lengkap, nip: guru.nip, jenis_ptk: guru.jenis_ptk },
        jam: currentTime.substring(0, 5),
        status: 'hadir',
        metode,
        jarak_meter: jarakMeter ?? null,
      };
    }

    // Has record but no jam_masuk (e.g., izin/sakit recorded by admin) — update to hadir
    if (!existing.jam_masuk) {
      const statusMasuk: PresensiGuruStatus = (batasTerlambatRef && isTimeAfter(currentTime, batasTerlambatRef))
        ? 'terlambat' : 'hadir';

      const updatePayload: Record<string, unknown> = {
        jam_masuk: currentTime,
        status_masuk: statusMasuk,
        metode_masuk: metode,
        shift_id: shiftId,
        jadwal_mengajar_id: jadwalId,
        updated_at: new Date().toISOString(),
      };
      if (latitude != null) updatePayload.latitude = latitude;
      if (longitude != null) updatePayload.longitude = longitude;
      if (fotoPath) updatePayload.foto_url = fotoPath;
      if (jarakMeter != null) updatePayload.jarak_meter = jarakMeter;

      const { error: updateErr } = await supabase
        .from('presensi_guru_tendik')
        .update(updatePayload)
        .eq('id', existing.id);

      if (updateErr) {
        return { success: false, message: `Gagal: ${updateErr.message}`, phase: 'masuk' };
      }

      return {
        success: true,
        message: statusMasuk === 'terlambat' ? 'PRESENSI BERHASIL — TERLAMBAT' : 'PRESENSI BERHASIL',
        phase: 'masuk',
        guru: { id: guru.id, nama_lengkap: guru.nama_lengkap, nip: guru.nip, jenis_ptk: guru.jenis_ptk },
        jam: currentTime.substring(0, 5),
        status: statusMasuk,
        metode,
        jarak_meter: jarakMeter ?? null,
      };
    }
  }

  // New record — masuk
  if (!settings.presensi_masuk_aktif) {
    return { success: false, message: 'Presensi masuk tidak aktif.', phase: 'masuk' };
  }

  const statusMasuk: PresensiGuruStatus = (batasTerlambatRef && isTimeAfter(currentTime, batasTerlambatRef))
    ? 'terlambat' : 'hadir';

  const insertPayload: Record<string, unknown> = {
    guru_tendik_id: guru.id,
    tahun_pelajaran_id: activeTp?.id ?? null,
    shift_id: shiftId,
    jadwal_mengajar_id: jadwalId,
    tanggal,
    jam_masuk: currentTime,
    status_masuk: statusMasuk,
    metode_masuk: metode,
  };
  if (latitude != null) insertPayload.latitude = latitude;
  if (longitude != null) insertPayload.longitude = longitude;
  if (fotoPath) insertPayload.foto_url = fotoPath;
  if (jarakMeter != null) insertPayload.jarak_meter = jarakMeter;

  const { error: insertErr } = await supabase
    .from('presensi_guru_tendik')
    .insert(insertPayload);

  if (insertErr) {
    if (insertErr.code === '23505') {
      return {
        success: false,
        message: 'Presensi masuk hari ini sudah tercatat.',
        phase: 'masuk',
        guru: { id: guru.id, nama_lengkap: guru.nama_lengkap, nip: guru.nip, jenis_ptk: guru.jenis_ptk },
      };
    }
    return { success: false, message: `Gagal menyimpan presensi: ${insertErr.message}`, phase: 'masuk' };
  }

  return {
    success: true,
    message: statusMasuk === 'terlambat' ? 'PRESENSI BERHASIL — TERLAMBAT' : 'PRESENSI BERHASIL',
    phase: 'masuk',
    guru: { id: guru.id, nama_lengkap: guru.nama_lengkap, nip: guru.nip, jenis_ptk: guru.jenis_ptk },
    jam: currentTime.substring(0, 5),
    status: statusMasuk,
    metode,
    jarak_meter: jarakMeter ?? null,
  };
}

export async function processRfidPresensiGuru(rfid: string, settings: PresensiSettings): Promise<PresensiGuruResult> {
  if (!settings.metode_rfid_aktif) {
    return { success: false, message: 'Metode RFID tidak aktif.', phase: 'masuk' };
  }
  const guru = await fetchGuruByRfid(rfid);
  if (!guru) {
    return { success: false, message: 'RFID TIDAK TERDAFTAR untuk guru/tendik.', phase: 'masuk' };
  }
  return processPresensiGuru({ guru, metode: 'rfid', settings });
}

export async function processQrPresensiGuru(nip: string, settings: PresensiSettings): Promise<PresensiGuruResult> {
  if (!settings.metode_qr_aktif) {
    return { success: false, message: 'Metode QR Code tidak aktif.', phase: 'masuk' };
  }
  const guru = await fetchGuruByNip(nip);
  if (!guru) {
    return { success: false, message: 'NIP tidak ditemukan.', phase: 'masuk' };
  }
  return processPresensiGuru({ guru, metode: 'qr', settings });
}

export async function processSelfieGpsPresensiGuru(
  nip: string,
  settings: PresensiSettings,
  latitude: number,
  longitude: number,
  fotoPath: string | null,
): Promise<PresensiGuruResult> {
  if (!settings.metode_selfie_aktif) {
    return { success: false, message: 'Metode Selfie + GPS tidak aktif.', phase: 'masuk' };
  }
  const guru = await fetchGuruByNip(nip);
  if (!guru) {
    return { success: false, message: 'NIP tidak ditemukan.', phase: 'masuk' };
  }

  const { data: schoolLoc } = await supabase
    .from('school_settings')
    .select('latitude, longitude, radius_presensi')
    .eq('id', 1)
    .maybeSingle();

  if (!schoolLoc || schoolLoc.latitude == null || schoolLoc.longitude == null) {
    return { success: false, message: 'Lokasi sekolah belum diatur.', phase: 'masuk' };
  }

  const radius = schoolLoc.radius_presensi ?? 100;
  const jarak = haversineDistance(latitude, longitude, schoolLoc.latitude, schoolLoc.longitude);

  if (jarak > radius) {
    return {
      success: false,
      message: `Di luar radius presensi. Jarak: ${jarak}m (radius: ${radius}m).`,
      phase: 'masuk',
      jarak_meter: jarak,
    };
  }

  return processPresensiGuru({
    guru, metode: 'selfie_gps', settings,
    latitude, longitude, fotoPath, jarakMeter: jarak,
  });
}

// IoT RFID edge function — tap and heartbeat endpoints for RFID machines
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Token, X-Device-SN",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nowTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function isTimeAfter(a: string, b: string): boolean {
  return a > b;
}

const HARI_MAP: Record<number, string> = {
  0: "Minggu", 1: "Senin", 2: "Selasa", 3: "Rabu",
  4: "Kamis", 5: "Jumat", 6: "Sabtu",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  // Route: /heartbeat
  if (path.endsWith("/heartbeat") && req.method === "POST") {
    return handleHeartbeat(req);
  }

  // Default: /tap
  if (req.method === "POST") {
    return handleTap(req);
  }

  return jsonResponse({ status: "error", message: "Method not allowed" }, 405);
});

async function handleHeartbeat(req: Request): Promise<Response> {
  let body: { sn?: string; timestamp?: string; firmware_version?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON" }, 400);
  }

  const sn = body.sn?.trim();
  if (!sn) {
    return jsonResponse({ status: "error", message: "SN required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: device } = await supabase
    .from("iot_rfid_devices")
    .select("id, sn, api_token, aktif")
    .eq("sn", sn)
    .maybeSingle();

  if (!device) {
    return jsonResponse({ status: "error", message: "Device not registered" }, 404);
  }

  if (!device.aktif) {
    return jsonResponse({ status: "error", message: "Device disabled" }, 403);
  }

  await supabase
    .from("iot_rfid_devices")
    .update({
      last_seen: new Date().toISOString(),
      status: "online",
      firmware_version: body.firmware_version ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", device.id);

  return jsonResponse({ status: "success", message: "Heartbeat received", timestamp: new Date().toISOString() });
}

async function handleTap(req: Request): Promise<Response> {
  let body: { sn?: string; rfid?: string; timestamp?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON" }, 400);
  }

  const sn = body.sn?.trim();
  const rfid = body.rfid?.trim();

  if (!sn || !rfid) {
    return jsonResponse({ status: "error", message: "sn and rfid required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Validate device
  const { data: device } = await supabase
    .from("iot_rfid_devices")
    .select("id, sn, api_token, aktif")
    .eq("sn", sn)
    .maybeSingle();

  if (!device) {
    return jsonResponse({ status: "error", message: "Device not registered" }, 404);
  }

  if (!device.aktif) {
    return jsonResponse({ status: "error", message: "Device disabled" }, 403);
  }

  // Validate token from header
  const deviceToken = req.headers.get("X-Device-Token");
  if (device.api_token && deviceToken !== device.api_token) {
    return jsonResponse({ status: "error", message: "Invalid device token" }, 401);
  }

  // Update heartbeat
  await supabase
    .from("iot_rfid_devices")
    .update({ last_seen: new Date().toISOString(), status: "online", updated_at: new Date().toISOString() })
    .eq("id", device.id);

  // 2. Find RFID in siswa first
  const { data: siswa } = await supabase
    .from("siswa")
    .select("id, nama_lengkap, nis, nisn, kelas_id, aktif, no_rfid, kelas:kelas_id(id, nama, shift_presensi_id)")
    .eq("no_rfid", rfid)
    .maybeSingle();

  if (siswa) {
    return await processSiswaTap(supabase, siswa, rfid, sn);
  }

  // 3. Find RFID in guru_tendik
  const { data: guru } = await supabase
    .from("guru_tendik")
    .select("id, nama_lengkap, nip, aktif, no_rfid, jenis_ptk, shift_presensi_id")
    .eq("no_rfid", rfid)
    .maybeSingle();

  if (guru) {
    return await processGuruTap(supabase, guru, rfid, sn);
  }

  // 4. RFID not found — log and return error
  await supabase.from("iot_rfid_taps").insert({
    device_sn: sn,
    rfid,
    status: "unknown",
    response: { status: "error", message: "RFID tidak terdaftar" },
  });

  return jsonResponse({
    status: "error",
    message: "RFID tidak terdaftar",
    lcd_line1: "KARTU TIDAK",
    lcd_line2: "TERDAFTAR",
  });
}

async function processSiswaTap(
  supabase: ReturnType<typeof createClient>,
  siswa: Record<string, unknown>,
  rfid: string,
  deviceSn: string
): Promise<Response> {
  const namaLengkap = siswa.nama_lengkap as string;
  const siswaId = siswa.id as string;
  const kelasId = siswa.kelas_id as string | null;
  const kelas = siswa.kelas as Record<string, unknown> | null;
  const shiftId = kelas?.shift_presensi_id as string | null;

  if (!siswa.aktif) {
    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "nonaktif", null, null);
    return jsonResponse({ status: "error", message: "Siswa tidak aktif", lcd_line1: "SISWA TIDAK", lcd_line2: "AKTIF" });
  }

  if (!kelasId || !shiftId) {
    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "no_shift", null, null);
    return jsonResponse({ status: "error", message: "Kelas belum memiliki Shift Presensi", lcd_line1: "KELAS BELUM", lcd_line2: "PUNYA SHIFT" });
  }

  // Fetch shift
  const { data: shift } = await supabase
    .from("shift_presensi")
    .select("jam_masuk, batas_terlambat, jam_pulang, hari_aktif, aktif")
    .eq("id", shiftId)
    .maybeSingle();

  if (!shift || !shift.aktif) {
    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "shift_inactive", null, null);
    return jsonResponse({ status: "error", message: "Shift tidak aktif", lcd_line1: "SHIFT", lcd_line2: "TIDAK AKTIF" });
  }

  // Check hari aktif
  const dayOfWeek = new Date().getDay().toString();
  const hariAktif = shift.hari_aktif as string[];
  if (hariAktif && hariAktif.length > 0 && !hariAktif.includes(HARI_MAP[new Date().getDay()])) {
    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "hari_nonaktif", null, null);
    return jsonResponse({ status: "error", message: "Hari ini bukan hari aktif shift", lcd_line1: "HARI INI", lcd_line2: "LIBUR" });
  }

  // Check kalender pendidikan
  const { data: activeTp } = await supabase
    .from("tahun_pelajaran")
    .select("id")
    .eq("aktif", true)
    .maybeSingle();

  const today = todayStr();
  const { data: kalender } = await supabase
    .from("kalender_pendidikan")
    .select("hari_efektif, presensi_diperbolehkan, jenis, nama_kegiatan")
    .lte("tanggal_mulai", today)
    .gte("tanggal_selesai", today)
    .eq("aktif", true)
    .maybeSingle();

  if (kalender && (!kalender.presensi_diperbolehkan || !kalender.hari_efektif)) {
    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "hari_libur", null, null);
    return jsonResponse({ status: "error", message: "Hari ini bukan hari efektif presensi", lcd_line1: "HARI LIBUR", lcd_line2: kalender.nama_kegiatan ?? "" });
  }

  // Check existing presensi
  const { data: existing } = await supabase
    .from("presensi_siswa")
    .select("id, jam_masuk, jam_pulang, status_masuk")
    .eq("siswa_id", siswaId)
    .eq("tanggal", today)
    .maybeSingle();

  const currentTime = nowTimeStr();

  if (existing && existing.jam_masuk) {
    if (existing.jam_pulang) {
      await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "sudah_lengkap", "masuk", existing.jam_masuk);
      return jsonResponse({
        status: "success",
        name: namaLengkap,
        attendance: existing.status_masuk,
        timestamp: `${today} ${currentTime}`,
        lcd_line1: "SUDAH LENGKAP",
        lcd_line2: namaLengkap.substring(0, 16),
      });
    }

    // Try pulang — check settings
    const { data: settings } = await supabase
      .from("presensi_settings")
      .select("presensi_pulang_aktif, waktu_pulang_mode, jam_pulang_buka, jam_pulang_tutup, anti_duplikasi_aktif, batas_duplikasi_menit")
      .eq("id", 1)
      .maybeSingle();

    if (settings && !settings.presensi_pulang_aktif) {
      await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "pulang_nonaktif", "masuk", existing.jam_masuk);
      return jsonResponse({ status: "success", name: namaLengkap, attendance: existing.status_masuk, timestamp: `${today} ${currentTime}`, lcd_line1: "PRESENSI MASUK", lcd_line2: "SUDAH TERCATAT" });
    }

    // Check anti-duplikasi
    if (settings?.anti_duplikasi_aktif && settings.batas_duplikasi_menit > 0) {
      const masukTime = (existing.jam_masuk as string).substring(0, 5);
      const [masukH, masukM] = masukTime.split(":").map(Number);
      const [nowH, nowM, nowS] = currentTime.split(":").map(Number);
      const diffMin = ((nowH * 3600 + nowM * 60 + nowS) - (masukH * 3600 + masukM * 60)) / 60;
      if (diffMin < settings.batas_duplikasi_menit) {
        await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "duplikat", "masuk", existing.jam_masuk);
        return jsonResponse({ status: "error", message: "Presensi masuk sudah tercatat. Tap terlalu cepat.", lcd_line1: "SUDAH", lcd_line2: "TERCATAT" });
      }
    }

    // Check jam pulang window
    if (settings?.jam_pulang_buka && isTimeAfter(settings.jam_pulang_buka, currentTime)) {
      await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "belum_waktu_pulang", "pulang", currentTime);
      return jsonResponse({ status: "error", message: `Presensi pulang dibuka pukul ${settings.jam_pulang_buka}`, lcd_line1: "BELUM WAKTU", lcd_line2: "PULANG" });
    }

    // Process pulang
    await supabase
      .from("presensi_siswa")
      .update({
        jam_pulang: currentTime,
        metode_pulang: "rfid",
        status_pulang: "hadir",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "hadir", "pulang", currentTime);

    return jsonResponse({
      status: "success",
      name: namaLengkap,
      attendance: "pulang",
      timestamp: `${today} ${currentTime}`,
      lcd_line1: "SELAMAT JALAN",
      lcd_line2: namaLengkap.substring(0, 16),
    });
  }

  // Process masuk — new record
  const statusMasuk = isTimeAfter(currentTime, shift.batas_terlambat as string) ? "terlambat" : "hadir";

  const { error: insertErr } = await supabase.from("presensi_siswa").insert({
    siswa_id: siswaId,
    kelas_id: kelasId,
    tahun_pelajaran_id: activeTp?.id ?? null,
    shift_id: shiftId,
    tanggal: today,
    jam_masuk: currentTime,
    status_masuk: statusMasuk,
    metode_masuk: "rfid",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "duplikat", "masuk", null);
      return jsonResponse({ status: "error", message: "Presensi masuk sudah tercatat", lcd_line1: "SUDAH", lcd_line2: "TERCATAT" });
    }
    await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, "error", "masuk", currentTime);
    return jsonResponse({ status: "error", message: `Gagal menyimpan: ${insertErr.message}` }, 500);
  }

  await logTap(supabase, deviceSn, rfid, "siswa", siswaId, namaLengkap, statusMasuk, "masuk", currentTime);

  return jsonResponse({
    status: "success",
    name: namaLengkap,
    attendance: statusMasuk,
    timestamp: `${today} ${currentTime}`,
    lcd_line1: statusMasuk === "terlambat" ? "TERLAMBAT" : "SELAMAT DATANG",
    lcd_line2: namaLengkap.substring(0, 16),
  });
}

async function processGuruTap(
  supabase: ReturnType<typeof createClient>,
  guru: Record<string, unknown>,
  rfid: string,
  deviceSn: string
): Promise<Response> {
  const namaLengkap = guru.nama_lengkap as string;
  const guruId = guru.id as string;
  const shiftId = guru.shift_presensi_id as string | null;
  const jenisPtk = guru.jenis_ptk as string | null;

  if (!guru.aktif) {
    await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "nonaktif", null, null);
    return jsonResponse({ status: "error", message: "Guru/Tendik tidak aktif", lcd_line1: "TIDAK AKTIF", lcd_line2: namaLengkap.substring(0, 16) });
  }

  // Guru with teaching schedule — use jadwal mengajar, not shift
  // For now, Tendik uses shift_presensi_id
  if (!shiftId) {
    await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "no_shift", null, null);
    return jsonResponse({ status: "error", message: "Belum memiliki Shift Presensi. Guru menggunakan Jadwal Mengajar.", lcd_line1: "TANPA SHIFT", lcd_line2: namaLengkap.substring(0, 16) });
  }

  const { data: shift } = await supabase
    .from("shift_presensi")
    .select("jam_masuk, batas_terlambat, jam_pulang, hari_aktif, aktif")
    .eq("id", shiftId)
    .maybeSingle();

  if (!shift || !shift.aktif) {
    await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "shift_inactive", null, null);
    return jsonResponse({ status: "error", message: "Shift tidak aktif", lcd_line1: "SHIFT", lcd_line2: "TIDAK AKTIF" });
  }

  const today = todayStr();
  const currentTime = nowTimeStr();
  const dayOfWeek = new Date().getDay().toString();
  const hariAktif = shift.hari_aktif as string[];
  if (hariAktif && hariAktif.length > 0 && !hariAktif.includes(HARI_MAP[new Date().getDay()])) {
    await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "hari_nonaktif", null, null);
    return jsonResponse({ status: "error", message: "Hari ini bukan hari aktif shift", lcd_line1: "HARI INI", lcd_line2: "LIBUR" });
  }

  // Check existing presensi for guru_tendik
  const { data: existing } = await supabase
    .from("presensi_guru_tendik")
    .select("id, jam_masuk, jam_pulang, status_masuk")
    .eq("guru_tendik_id", guruId)
    .eq("tanggal", today)
    .maybeSingle();

  if (existing && existing.jam_masuk) {
    if (existing.jam_pulang) {
      await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "sudah_lengkap", "masuk", existing.jam_masuk);
      return jsonResponse({ status: "success", name: namaLengkap, attendance: existing.status_masuk, timestamp: `${today} ${currentTime}`, lcd_line1: "SUDAH LENGKAP", lcd_line2: namaLengkap.substring(0, 16) });
    }

    // Process pulang
    await supabase
      .from("presensi_guru_tendik")
      .update({
        jam_pulang: currentTime,
        metode_pulang: "rfid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "hadir", "pulang", currentTime);
    return jsonResponse({ status: "success", name: namaLengkap, attendance: "pulang", timestamp: `${today} ${currentTime}`, lcd_line1: "SELAMAT JALAN", lcd_line2: namaLengkap.substring(0, 16) });
  }

  const statusMasuk = isTimeAfter(currentTime, shift.batas_terlambat as string) ? "terlambat" : "hadir";

  const { error: insertErr } = await supabase.from("presensi_guru_tendik").insert({
    guru_tendik_id: guruId,
    tanggal: today,
    jam_masuk: currentTime,
    status_masuk: statusMasuk,
    metode_masuk: "rfid",
  });

  if (insertErr) {
    await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, "error", "masuk", currentTime);
    return jsonResponse({ status: "error", message: `Gagal menyimpan: ${insertErr.message}` }, 500);
  }

  await logTap(supabase, deviceSn, rfid, "guru_tendik", guruId, namaLengkap, statusMasuk, "masuk", currentTime);

  return jsonResponse({
    status: "success",
    name: namaLengkap,
    attendance: statusMasuk,
    timestamp: `${today} ${currentTime}`,
    lcd_line1: statusMasuk === "terlambat" ? "TERLAMBAT" : "SELAMAT DATANG",
    lcd_line2: namaLengkap.substring(0, 16),
  });
}

async function logTap(
  supabase: ReturnType<typeof createClient>,
  deviceSn: string,
  rfid: string,
  personType: string,
  personId: string,
  personName: string,
  status: string,
  phase: string | null,
  jam: string | null
): Promise<void> {
  await supabase.from("iot_rfid_taps").insert({
    device_sn: deviceSn,
    rfid,
    person_type: personType,
    person_id: personId,
    person_name: personName,
    status,
    phase,
    jam,
  });
}

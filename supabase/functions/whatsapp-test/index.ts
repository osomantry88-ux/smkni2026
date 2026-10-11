import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCallerContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");
  return { userId: user.id, roles, isAdmin };
}

// Provider test endpoints
const PROVIDER_TEST_PATHS: Record<string, string> = {
  fonnte: "/api/get_device",
  onesender: "/api/status",
  wablas: "/api/device",
  custom: "/api/status",
};

async function testConnection(
  provider: string,
  apiUrl: string,
  apiToken: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const testPath = PROVIDER_TEST_PATHS[provider] ?? "/api/status";
  const testUrl = baseUrl + testPath;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider === "fonnte") headers["Authorization"] = apiToken;
    else if (provider === "onesender") headers["Authorization"] = `Bearer ${apiToken}`;
    else if (provider === "wablas") headers["Authorization"] = apiToken;
    else headers["Authorization"] = `Bearer ${apiToken}`;

    const res = await fetch(testUrl, { method: "GET", headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) return { success: true, message: `Koneksi berhasil (HTTP ${res.status})` };
    if (res.status === 401 || res.status === 403) return { success: false, message: "Token tidak valid atau kedaluwarsa" };
    return { success: false, message: `Provider merespons HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("abort")) return { success: false, message: "Koneksi timeout (15 detik)" };
    return { success: false, message: `Gagal terhubung: ${msg}` };
  }
}

async function sendTestMessage(
  provider: string,
  apiUrl: string,
  apiToken: string,
  nomor: string,
  deviceId?: string | null
): Promise<{ success: boolean; message: string }> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const message = "Pesan test dari SMK Nur Insani - WhatsApp Gateway berfungsi dengan baik.";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let sendUrl = baseUrl;
    let method = "POST";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: string;

    if (provider === "fonnte") {
      sendUrl = baseUrl + "/api/send_message";
      headers["Authorization"] = apiToken;
      body = JSON.stringify({ target: nomor, message, device: deviceId ?? "" });
    } else if (provider === "onesender") {
      sendUrl = baseUrl + "/api/send_message";
      headers["Authorization"] = `Bearer ${apiToken}`;
      body = JSON.stringify({ to: nomor, message });
    } else if (provider === "wablas") {
      sendUrl = baseUrl + "/api/send-message";
      headers["Authorization"] = apiToken;
      body = JSON.stringify({ phone: nomor, message });
    } else {
      // custom — try a generic POST
      headers["Authorization"] = `Bearer ${apiToken}`;
      body = JSON.stringify({ to: nomor, message, phone: nomor });
    }

    const res = await fetch(sendUrl, { method, headers, body, signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) return { success: true, message: `Pesan test terkirim ke ${nomor}` };
    const errText = await res.text().catch(() => "");
    return { success: false, message: `Gagal mengirim (HTTP ${res.status}): ${errText.substring(0, 100)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("abort")) return { success: false, message: "Timeout mengirim pesan (20 detik)" };
    return { success: false, message: `Gagal mengirim: ${msg}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ctx = await getCallerContext(req);
    if (!ctx || !ctx.isAdmin) {
      return json({ error: "Akses ditolak. Hanya admin." }, 403);
    }

    const reqBody = await req.json().catch(() => ({}));
    const action = reqBody.action ?? "test_connection";

    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError || !settings) {
      return json({ error: "Konfigurasi WhatsApp tidak ditemukan" }, 404);
    }

    if (!settings.api_url || !settings.api_token) {
      return json({ error: "URL dan Token API harus diisi terlebih dahulu" }, 400);
    }

    if (action === "test_send") {
      const nomor = reqBody.nomor;
      if (!nomor) return json({ error: "Nomor tujuan harus diisi" }, 400);

      const result = await sendTestMessage(
        settings.provider,
        settings.api_url,
        settings.api_token,
        String(nomor),
        settings.device_id
      );

      // Log the test send
      await supabase.from("notification_log").insert({
        tipe: "test_send",
        penerima: nomor,
        nomor_tujuan: String(nomor),
        channel: "whatsapp",
        provider: settings.provider,
        status: result.success ? "terkirim" : "gagal",
        pesan: "Pesan test dari WhatsApp Gateway",
        pesan_error: result.success ? null : result.message,
      });

      return json({ success: result.success, message: result.message });
    }

    // Default: test_connection
    const result = await testConnection(settings.provider, settings.api_url, settings.api_token);
    const now = new Date().toISOString();
    const status = result.success ? "connected" : "failed";

    await supabase
      .from("whatsapp_settings")
      .update({
        status_koneksi: status,
        waktu_test_terakhir: now,
        pesan_test_terakhir: result.message,
        updated_at: now,
      })
      .eq("id", 1);

    return json({ success: result.success, message: result.message, status, waktu_test: now });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return json({ error: `Terjadi kesalahan: ${msg}` }, 500);
  }
});

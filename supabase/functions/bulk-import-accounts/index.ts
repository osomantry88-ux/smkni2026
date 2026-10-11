import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AccountRequest {
  email: string;
  password: string;
  full_name: string;
  roles: string[];
  link_to?: { table: "siswa" | "guru_tendik"; id: string };
}

interface BatchResult {
  success: boolean;
  email: string;
  user_id?: string;
  error?: string;
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

async function createSingleAccount(req: AccountRequest): Promise<BatchResult> {
  const { email, password, full_name, roles, link_to } = req;

  if (!email || !password || !full_name) {
    return { success: false, email: email ?? "", error: "Email, password, dan full_name wajib diisi" };
  }

  if (password.length < 6) {
    return { success: false, email, error: "Password minimal 6 karakter" };
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    let msg = authError.message;
    if (authError.message.includes("already")) {
      msg = "Email sudah terdaftar";
    }
    return { success: false, email, error: msg };
  }

  const userId = authData.user.id;

  await supabase.from("profiles").update({ full_name }).eq("id", userId);

  if (roles.length > 0) {
    const roleRows = roles.map((r) => ({ user_id: userId, role: r }));
    const { error: rolesError } = await supabase.from("user_roles").insert(roleRows);
    if (rolesError) {
      await supabase.auth.admin.deleteUser(userId);
      return { success: false, email, error: "Gagal menetapkan role" };
    }
  }

  if (link_to) {
    const { error: linkError } = await supabase
      .from(link_to.table)
      .update({ user_id: userId })
      .eq("id", link_to.id);
    if (linkError) {
      console.error("Link error:", JSON.stringify(linkError));
    }
  }

  return { success: true, email, user_id: userId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ctx = await getCallerContext(req);
    if (!ctx || !ctx.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Tidak memiliki izin. Hanya admin yang dapat melakukan import." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Metode tidak didukung" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { accounts } = body as { accounts: AccountRequest[] };

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Daftar akun kosong" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: BatchResult[] = [];
    for (const account of accounts) {
      const result = await createSingleAccount(account);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ results, summary: { total: results.length, succeeded, failed } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("bulk-import-accounts error:", message);
    return new Response(
      JSON.stringify({ error: `Terjadi kesalahan: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

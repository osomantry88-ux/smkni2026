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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Metode tidak didukung" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Check if any super_admin already exists
    const { data: existingAdmins, error: checkError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);

    if (checkError) {
      return new Response(
        JSON.stringify({ error: "Gagal memeriksa status setup" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "Super Admin sudah dikonfigurasi. Setup tidak dapat dijalankan lagi." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Email, password, dan nama lengkap wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Kata sandi minimal 6 karakter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create the auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      console.error("createUser error:", JSON.stringify(authError));
      let msg: string;
      if (authError.name === "AuthWeakPasswordError" || authError.message.toLowerCase().includes("weak")) {
        msg = "Kata sandi terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol.";
      } else if (authError.message.includes("already")) {
        msg = "Email sudah terdaftar";
      } else {
        msg = authError.message;
      }
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = authData.user.id;
    console.log("User created:", userId);

    // Update profile full_name (trigger already created the row)
    const { error: profileError } = await supabase.from("profiles").update({ full_name }).eq("id", userId);
    if (profileError) {
      console.error("profile update error:", JSON.stringify(profileError));
    }

    // Assign super_admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "super_admin" });

    if (roleError) {
      console.error("role insert error:", JSON.stringify(roleError));
      // Best-effort cleanup
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Gagal menetapkan role: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Akun Super Admin berhasil dibuat. Silakan masuk dengan email dan password yang telah dibuat.",
        email,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("setup-admin unexpected error:", message);
    return new Response(
      JSON.stringify({ error: `Terjadi kesalahan: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

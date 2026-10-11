import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_ROLES = [
  "super_admin", "admin", "kepala_sekolah", "guru",
  "wali_kelas", "guru_bk", "guru_piket", "pembina",
  "siswa", "orang_tua_wali",
] as const;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AuthContext {
  userId: string;
  roles: string[];
  isAdmin: boolean;
}

async function getCallerContext(req: Request): Promise<AuthContext | null> {
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCreateUser(body: {
  email: string;
  password: string;
  full_name: string;
  roles: string[];
}) {
  const { email, password, full_name, roles } = body;

  if (!email || !password || !full_name || !roles || !Array.isArray(roles)) {
    return json({ error: "Email, password, full_name, dan roles wajib diisi" }, 400);
  }

  if (password.length < 6) {
    return json({ error: "Kata sandi minimal 6 karakter" }, 400);
  }

  for (const r of roles) {
    if (!VALID_ROLES.includes(r as typeof VALID_ROLES[number])) {
      return json({ error: `Role tidak valid: ${r}` }, 400);
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    let msg: string;
    if (authError.name === "AuthWeakPasswordError" || authError.message.toLowerCase().includes("weak")) {
      msg = "Kata sandi terlalu lemah.";
    } else if (authError.message.includes("already")) {
      msg = "Email sudah terdaftar";
    } else {
      msg = authError.message;
    }
    return json({ error: msg }, 400);
  }

  const userId = authData.user.id;
  await supabase.from("profiles").update({ full_name }).eq("id", userId);

  const roleRows = roles.map((r) => ({ user_id: userId, role: r }));
  const { error: rolesError } = await supabase.from("user_roles").insert(roleRows);

  if (rolesError) {
    await supabase.auth.admin.deleteUser(userId);
    return json({ error: "Gagal menetapkan role pengguna" }, 500);
  }

  return json({ id: userId, email, full_name, roles }, 201);
}

async function handleListUsers() {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, updated_at, last_login_at")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return json({ error: "Gagal memuat daftar pengguna" }, 500);
  }

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, role");

  const rolesByUser = new Map<string, string[]>();
  for (const r of rolesData ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  const { data: usersData } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailMap = new Map<string, string>();
  const bannedMap = new Map<string, boolean>();
  for (const u of usersData?.users ?? []) {
    emailMap.set(u.id, u.email ?? "");
    bannedMap.set(u.id, u.banned ?? false);
  }

  // Get linked guru_tendik and siswa
  const { data: guruLinks } = await supabase
    .from("guru_tendik")
    .select("id, user_id, nama_lengkap");
  const { data: siswaLinks } = await supabase
    .from("siswa")
    .select("id, user_id, nama_lengkap");

  const guruByUserId = new Map<string, { id: string; nama: string }>();
  for (const g of guruLinks ?? []) {
    if (g.user_id) guruByUserId.set(g.user_id, { id: g.id, nama: g.nama_lengkap });
  }
  const siswaByUserId = new Map<string, { id: string; nama: string }>();
  for (const s of siswaLinks ?? []) {
    if (s.user_id) siswaByUserId.set(s.user_id, { id: s.id, nama: s.nama_lengkap });
  }

  const result = (profiles ?? []).map((p) => {
    const guru = guruByUserId.get(p.id);
    const siswa = siswaByUserId.get(p.id);
    return {
      ...p,
      email: emailMap.get(p.id) ?? "",
      roles: rolesByUser.get(p.id) ?? [],
      banned: bannedMap.get(p.id) ?? false,
      last_login_at: p.last_login_at ?? null,
      linked_type: guru ? "guru_tendik" : siswa ? "siswa" : null,
      linked_id: guru?.id ?? siswa?.id ?? null,
    };
  });

  return json(result);
}

async function handleUpdateUser(userId: string, body: {
  full_name?: string;
  roles?: string[];
}) {
  if (body.full_name !== undefined) {
    await supabase.from("profiles").update({ full_name: body.full_name }).eq("id", userId);
  }

  if (body.roles !== undefined && Array.isArray(body.roles)) {
    for (const r of body.roles) {
      if (!VALID_ROLES.includes(r as typeof VALID_ROLES[number])) {
        return json({ error: `Role tidak valid: ${r}` }, 400);
      }
    }
    await supabase.from("user_roles").delete().eq("user_id", userId);
    if (body.roles.length > 0) {
      const roleRows = body.roles.map((r) => ({ user_id: userId, role: r }));
      const { error: rolesError } = await supabase.from("user_roles").insert(roleRows);
      if (rolesError) {
        return json({ error: "Gagal memperbarui role pengguna" }, 500);
      }
    }
  }

  return json({ id: userId, updated: true });
}

async function handleResetPassword(userId: string) {
  const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = usersData?.users?.find((u) => u.id === userId);
  if (!user?.email) {
    return json({ error: "Pengguna tidak ditemukan" }, 404);
  }

  let newPassword = user.email;

  const { data: guru } = await supabase
    .from("guru_tendik")
    .select("nip, nuptk, nik")
    .eq("user_id", userId)
    .maybeSingle();

  if (guru) {
    newPassword = guru.nip || guru.nuptk || guru.nik || user.email;
  } else {
    const { data: siswa } = await supabase
      .from("siswa")
      .select("nisn")
      .eq("user_id", userId)
      .maybeSingle();

    if (siswa?.nisn) {
      newPassword = siswa.nisn;
    }
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    return json({ error: `Gagal reset password: ${updateError.message}` }, 400);
  }

  return json({ reset: true, userId });
}

async function handleSetPassword(userId: string, body: { password: string }) {
  if (!body.password || body.password.length < 6) {
    return json({ error: "Password minimal 6 karakter" }, 400);
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: body.password,
  });
  if (error) {
    return json({ error: `Gagal mengubah password: ${error.message}` }, 400);
  }
  return json({ updated: true, userId });
}

async function handleUpdateEmail(userId: string, body: { email: string }) {
  if (!body.email || !body.email.includes("@")) {
    return json({ error: "Email tidak valid" }, 400);
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email: body.email,
    email_confirm: true,
  });
  if (error) {
    if (error.message.includes("already")) {
      return json({ error: "Email sudah digunakan akun lain" }, 400);
    }
    return json({ error: `Gagal mengubah email: ${error.message}` }, 400);
  }
  return json({ updated: true, userId });
}

async function handleCreateAccount(body: {
  email: string;
  password: string;
  full_name: string;
  roles: string[];
  link_table: string;
  link_id: string;
}) {
  const { email, password, full_name, roles, link_table, link_id } = body;

  if (!email || !password || !full_name || !link_table || !link_id) {
    return json({ error: "Email, password, nama, dan data link wajib diisi" }, 400);
  }
  if (password.length < 6) {
    return json({ error: "Password minimal 6 karakter" }, 400);
  }
  if (!["guru_tendik", "siswa"].includes(link_table)) {
    return json({ error: "Tabel link tidak valid" }, 400);
  }

  const validRoles = roles.filter((r) => VALID_ROLES.includes(r as typeof VALID_ROLES[number]));

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    let msg: string;
    if (authError.name === "AuthWeakPasswordError" || authError.message.toLowerCase().includes("weak")) {
      msg = "Password terlalu lemah.";
    } else if (authError.message.includes("already")) {
      msg = "Email/username sudah digunakan akun lain";
    } else {
      msg = authError.message;
    }
    return json({ error: msg }, 400);
  }

  const userId = authData.user.id;
  await supabase.from("profiles").update({ full_name }).eq("id", userId);

  if (validRoles.length > 0) {
    const roleRows = validRoles.map((r) => ({ user_id: userId, role: r }));
    const { error: rolesError } = await supabase.from("user_roles").insert(roleRows);
    if (rolesError) {
      await supabase.auth.admin.deleteUser(userId);
      return json({ error: "Gagal menetapkan role" }, 500);
    }
  }

  const { error: linkError } = await supabase
    .from(link_table)
    .update({ user_id: userId })
    .eq("id", link_id);
  if (linkError) {
    console.error("Link error:", JSON.stringify(linkError));
  }

  return json({ id: userId, email, linked: true }, 201);
}

async function handleToggleBan(userId: string, ban: boolean, callerId: string) {
  if (userId === callerId) {
    return json({ error: "Tidak dapat menonaktifkan akun sendiri" }, 400);
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban: ban ? "true" : "false",
  });

  if (error) {
    return json({ error: `Gagal ${ban ? "menonaktifkan" : "mengaktifkan"} akun: ${error.message}` }, 400);
  }

  return json({ banned: ban, userId });
}

async function handleDeleteUser(userId: string, callerId: string) {
  if (userId === callerId) {
    return json({ error: "Tidak dapat menghapus akun sendiri" }, 400);
  }

  const { data: superAdmins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");

  if (superAdmins && superAdmins.length <= 1 && superAdmins[0]?.user_id === userId) {
    return json({ error: "Tidak dapat menghapus Super Admin terakhir" }, 400);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: "Gagal menghapus pengguna" }, 500);
  }

  return json({ deleted: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ctx = await getCallerContext(req);
    if (!ctx || !ctx.isAdmin) {
      return json({ error: "Tidak memiliki izin. Hanya admin yang dapat mengelola pengguna." }, 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "POST") {
      const body = await req.json();
      if (action === "create-account") {
        return handleCreateAccount(body);
      }
      return handleCreateUser(body);
    }

    if (req.method === "GET") {
      return handleListUsers();
    }

    if (req.method === "PUT") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return json({ error: "Parameter userId wajib diisi" }, 400);
      }
      const body = await req.json();

      if (action === "reset-password") {
        return handleResetPassword(userId);
      }
      if (action === "set-password") {
        return handleSetPassword(userId, body);
      }
      if (action === "update-email") {
        return handleUpdateEmail(userId, body);
      }
      if (action === "ban") {
        return handleToggleBan(userId, true, ctx.userId);
      }
      if (action === "unban") {
        return handleToggleBan(userId, false, ctx.userId);
      }

      return handleUpdateUser(userId, body);
    }

    if (req.method === "DELETE") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return json({ error: "Parameter userId wajib diisi" }, 400);
      }
      return handleDeleteUser(userId, ctx.userId);
    }

    return json({ error: "Metode tidak didukung" }, 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin-users error:", message);
    return json({ error: `Terjadi kesalahan: ${message}` }, 500);
  }
});

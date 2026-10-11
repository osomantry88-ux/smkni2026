import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Search, Mail, AlertCircle, KeyRound, UserCog, Users, Ban, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ALL_ROLES, ROLE_LABELS, type Role, type ManagedUser, type GuruTendik, type Siswa } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

type PickableGuru = GuruTendik & { _username: string; _email: string };
type PickableSiswa = Siswa & { _username: string; _email: string };

export default function PenggunaPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  // Create flow state
  const [pickType, setPickType] = useState<'guru' | 'siswa' | null>(null);
  const [guruList, setGuruList] = useState<PickableGuru[]>([]);
  const [siswaList, setSiswaList] = useState<PickableSiswa[]>([]);
  const [pickedId, setPickedId] = useState('');
  const [pickedRoles, setPickedRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [pickSearch, setPickSearch] = useState('');

  // Edit flow state
  const [editRoles, setEditRoles] = useState<Role[]>([]);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [banTarget, setBanTarget] = useState<ManagedUser | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Existing user IDs (to filter out guru/siswa that already have accounts)
  const [linkedUserIds, setLinkedUserIds] = useState<Set<string>>(new Set());

  const authHeader = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl, { method: 'GET', headers: { Authorization: authHeader } });
      if (!response.ok) { setError('Gagal memuat daftar pengguna.'); setLoading(false); return; }
      const data = await response.json() as ManagedUser[];
      setUsers(data);
      const ids = new Set<string>();
      for (const u of data) { if (u.linked_id) ids.add(u.linked_id); }
      setLinkedUserIds(ids);
    } catch { setError('Gagal terhubung ke server.'); }
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(
    (u) => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  function guruUsername(g: GuruTendik): string {
    return (g.nip || g.nuptk || g.nik || '').trim();
  }
  function siswaUsername(s: Siswa): string {
    return (s.nisn || '').trim();
  }

  async function loadGuruList() {
    const { data } = await supabase.from('guru_tendik').select('*').eq('aktif', true).order('nama_lengkap');
    if (data) {
      const mapped = (data as GuruTendik[]).map((g) => ({ ...g, _username: guruUsername(g), _email: g.email ?? '' }));
      setGuruList(mapped.filter((g) => g._username && !linkedUserIds.has(g.id)));
    }
  }

  async function loadSiswaList() {
    const { data } = await supabase.from('siswa').select('*').eq('aktif', true).order('nama_lengkap');
    if (data) {
      const mapped = (data as Siswa[]).map((s) => ({ ...s, _username: siswaUsername(s), _email: s.email ?? '' }));
      setSiswaList(mapped.filter((s) => s._username && !linkedUserIds.has(s.id)));
    }
  }

  function openCreate() {
    setEditing(null);
    setPickType(null);
    setPickedId('');
    setPickedRoles([]);
    setPickSearch('');
    setError(null);
    setModalOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditing(user);
    setEditRoles(user.roles);
    setError(null);
    setModalOpen(true);
  }

  function toggleCreateRole(role: Role) {
    setPickedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  function toggleEditRole(role: Role) {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!pickType || !pickedId) { setError('Pilih Guru/Tendik atau Siswa terlebih dahulu.'); setSaving(false); return; }
    if (pickedRoles.length === 0) { setError('Pilih minimal satu role.'); setSaving(false); return; }

    const item = pickType === 'guru'
      ? guruList.find((g) => g.id === pickedId)
      : siswaList.find((s) => s.id === pickedId);
    if (!item) { setError('Data tidak ditemukan.'); setSaving(false); return; }

    const username = pickType === 'guru' ? (item as PickableGuru)._username : (item as PickableSiswa)._username;
    const email = item.email?.trim() || `${username}@${pickType === 'guru' ? 'sekolah' : 'siswa'}.sch.id`;

    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          accounts: [{
            email,
            password: username,
            full_name: item.nama_lengkap,
            roles: pickedRoles,
            link_to: { table: pickType === 'guru' ? 'guru_tendik' : 'siswa', id: item.id },
          }],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal membuat akun.');
        setSaving(false);
        return;
      }
    } catch {
      setError('Gagal terhubung ke server.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    fetchUsers();
  }

  async function handleUpdateRoles() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}?userId=${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ roles: editRoles }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal memperbarui role.');
        setSaving(false);
        return;
      }
    } catch {
      setError('Gagal terhubung ke server.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setModalOpen(false);
    fetchUsers();
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch(`${apiUrl}?userId=${resetTarget.id}&action=reset-password`, {
        method: 'PUT',
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal reset password.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
    }
    setActionBusy(false);
    setResetTarget(null);
  }

  async function handleToggleBan() {
    if (!banTarget) return;
    setActionBusy(true);
    const action = banTarget.banned ? 'unban' : 'ban';
    try {
      const res = await fetch(`${apiUrl}?userId=${banTarget.id}&action=${action}`, {
        method: 'PUT',
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal mengubah status akun.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
    }
    setActionBusy(false);
    setBanTarget(null);
    fetchUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${apiUrl}?userId=${deleteTarget.id}`, { method: 'DELETE', headers: { Authorization: authHeader } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal menghapus pengguna.');
        return;
      }
      fetchUsers();
    } catch {
      setError('Gagal terhubung ke server.');
    }
  }

  const filteredGuru = guruList.filter((g) =>
    g.nama_lengkap.toLowerCase().includes(pickSearch.toLowerCase()) ||
    g._username.includes(pickSearch) || (g.email ?? '').toLowerCase().includes(pickSearch.toLowerCase())
  );
  const filteredSiswa = siswaList.filter((s) =>
    s.nama_lengkap.toLowerCase().includes(pickSearch.toLowerCase()) ||
    s._username.includes(pickSearch)
  );

  const pickedItem = pickType === 'guru'
    ? guruList.find((g) => g.id === pickedId)
    : siswaList.find((s) => s.id === pickedId);

  const createRoles: Role[] = pickType === 'guru'
    ? (['guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'pembina', 'kepala_sekolah', 'admin'] as Role[])
    : (['siswa'] as Role[]);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-700" />
              Manajemen Pengguna
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Akun diambil dari Master Guru/Tendik &amp; Siswa. Tidak ada input manual nama/email/password.
            </p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah Akun
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau email..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 hidden md:table-cell">Login Terakhir</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada pengguna</td></tr>
                ) : (
                  filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{user.full_name}</div>
                        {user.linked_type && (
                          <div className="text-xs text-gray-400">{user.linked_type === 'guru_tendik' ? 'Guru/Tendik' : 'Siswa'}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map((r) => (
                              <Badge key={r} variant={r === 'super_admin' ? 'success' : 'info'}>{ROLE_LABELS[r]}</Badge>
                            ))
                          ) : (
                            <Badge variant="neutral">Tanpa Role</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {user.banned ? <Badge variant="error">Nonaktif</Badge> : <Badge variant="success">Aktif</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setResetTarget(user)} className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition" title="Reset Password"><KeyRound className="w-4 h-4" /></button>
                          <button onClick={() => setBanTarget(user)} disabled={user.id === session?.user?.id} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition disabled:opacity-30" title={user.banned ? 'Aktifkan' : 'Nonaktifkan'}>
                            {user.banned ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                          <button onClick={() => openEdit(user)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Edit Role"><Pencil className="w-4 h-4" /></button>
                          {user.id !== session?.user?.id && (
                            <button onClick={() => setDeleteTarget(user)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={modalOpen && !editing} onClose={() => setModalOpen(false)} title="Tambah Akun" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {!pickType ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-3">Pilih jenis data yang akan dibuatkan akun:</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setPickType('guru'); loadGuruList(); }}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 p-6 hover:border-emerald-500 hover:bg-emerald-50 transition">
                  <UserCog className="w-8 h-8 text-emerald-600" />
                  <span className="text-sm font-semibold text-gray-700">Guru / Tendik</span>
                </button>
                <button type="button" onClick={() => { setPickType('siswa'); loadSiswaList(); }}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 p-6 hover:border-emerald-500 hover:bg-emerald-50 transition">
                  <Users className="w-8 h-8 text-emerald-600" />
                  <span className="text-sm font-semibold text-gray-700">Siswa</span>
                </button>
              </div>
            </div>
          ) : !pickedId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { setPickType(null); setPickedId(''); }} className="text-sm text-emerald-700 hover:text-emerald-800">← Kembali</button>
                <p className="text-sm font-medium text-gray-700">{pickType === 'guru' ? 'Pilih Guru/Tendik' : 'Pilih Siswa'}</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Cari nama atau ID..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {pickType === 'guru' ? (
                  filteredGuru.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">Tidak ada Guru/Tendik yang belum memiliki akun.</p>
                  ) : filteredGuru.map((g) => (
                    <button key={g.id} type="button" onClick={() => setPickedId(g.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition text-left">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{g.nama_lengkap.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{g.nama_lengkap}</p>
                        <p className="text-xs text-gray-500">{g.jenis_ptk === 'guru' ? 'Guru' : 'Tendik'} — {g._username}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  filteredSiswa.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">Tidak ada Siswa yang belum memiliki akun.</p>
                  ) : filteredSiswa.map((s) => (
                    <button key={s.id} type="button" onClick={() => setPickedId(s.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition text-left">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{s.nama_lengkap.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-gray-500">NISN: {s._username}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pickedItem && (
                <>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-gray-400">Nama Lengkap</p><p className="font-medium text-gray-800">{pickedItem.nama_lengkap}</p></div>
                      <div><p className="text-xs text-gray-400">Username</p><p className="font-mono text-gray-800">{pickType === 'guru' ? (pickedItem as PickableGuru)._username : (pickedItem as PickableSiswa)._username}</p></div>
                      {pickType === 'guru' && (
                        <>
                          <div><p className="text-xs text-gray-400">NIP</p><p className="font-mono text-gray-600">{(pickedItem as PickableGuru).nip ?? '—'}</p></div>
                          <div><p className="text-xs text-gray-400">NUPTK</p><p className="font-mono text-gray-600">{(pickedItem as PickableGuru).nuptk ?? '—'}</p></div>
                          <div><p className="text-xs text-gray-400">NIK</p><p className="font-mono text-gray-600">{(pickedItem as PickableGuru).nik ?? '—'}</p></div>
                          <div><p className="text-xs text-gray-400">Jenis</p><p className="text-gray-600">{(pickedItem as PickableGuru).jenis_ptk === 'guru' ? 'Guru' : 'Tendik'}</p></div>
                        </>
                      )}
                      <div><p className="text-xs text-gray-400">Email</p><p className="text-gray-600">{pickedItem.email || (pickType === 'guru' ? `${(pickedItem as PickableGuru)._username}@sekolah.sch.id` : `${(pickedItem as PickableSiswa)._username}@siswa.sch.id`)}</p></div>
                      <div><p className="text-xs text-gray-400">No HP</p><p className="text-gray-600">{pickedItem.no_hp ?? '—'}</p></div>
                    </div>
                    {!pickedItem.email && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                        Email belum diisi pada biodata. Email otomatis akan digunakan. Edit biodata {pickType === 'guru' ? 'Guru/Tendik' : 'Siswa'} untuk mengubah.
                      </div>
                    )}
                    <p className="text-xs text-gray-400">Password awal: <span className="font-mono">{pickType === 'guru' ? (pickedItem as PickableGuru)._username : (pickedItem as PickableSiswa)._username}</span> (disimpan dalam bentuk hash)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role * (pilih satu atau lebih)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {createRoles.map((role) => (
                        <label key={role} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${pickedRoles.includes(role) ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={pickedRoles.includes(role)} onChange={() => toggleCreateRole(role)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                          <span className="text-sm text-gray-700">{ROLE_LABELS[role]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setPickedId('')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Kembali</button>
                    <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Buat Akun'}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Edit Modal (roles only) */}
      <Modal open={modalOpen && !!editing} onClose={() => setModalOpen(false)} title="Edit Role Pengguna" size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleUpdateRoles(); }} className="space-y-4">
          {editing && (
            <>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-800">{editing.full_name}</p>
                <p className="text-xs text-gray-500 mt-1">{editing.email}</p>
                <p className="text-xs text-gray-400 mt-1">Login terakhir: {editing.last_login_at ? new Date(editing.last_login_at).toLocaleString('id-ID') : 'belum pernah'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role * (pilih satu atau lebih)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${editRoles.includes(role) ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="checkbox" checked={editRoles.includes(role)} onChange={() => toggleEditRole(role)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm text-gray-700">{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </>
          )}
        </form>
      </Modal>

      <ConfirmDialog open={!!resetTarget} title="Reset Password" message={`Password akan direset sesuai username (${resetTarget?.email}). Lanjutkan?`} onConfirm={handleResetPassword} onClose={() => setResetTarget(null)} confirmLabel={actionBusy ? 'Memproses...' : 'Ya, Reset'} variant="warning" />
      <ConfirmDialog open={!!banTarget} title={banTarget?.banned ? 'Aktifkan Akun' : 'Nonaktifkan Akun'} message={banTarget?.banned ? 'Akun akan diaktifkan kembali. Lanjutkan?' : 'Akun akan dinonaktifkan. Pengguna tidak dapat login. Lanjutkan?'} onConfirm={handleToggleBan} onClose={() => setBanTarget(null)} confirmLabel={actionBusy ? 'Memproses...' : 'Ya'} variant="warning" />
      <ConfirmDialog open={!!deleteTarget} title="Hapus Pengguna" message={`Yakin ingin menghapus akun "${deleteTarget?.full_name}"? Tindakan ini tidak dapat dibatalkan.`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

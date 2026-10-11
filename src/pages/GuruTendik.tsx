import { useEffect, useState, type FormEvent } from 'react';
import { UserCog, Plus, Pencil, Trash2, Search, Filter, QrCode, CreditCard, Clock, Upload, FileSpreadsheet, FileDown, KeyRound, ShieldCheck, Ban, CheckCircle2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { GuruTendik, RfidHistory, ShiftPresensi, ManagedUser } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';
import QRCodeDisplay, { getGuruQrSource } from '@/components/QRCodeDisplay';
import PhotoUpload, { getPhotoUrl } from '@/components/PhotoUpload';
import ImportModal, { type ImportMode } from '@/components/ImportModal';
import { downloadTemplate, exportToExcel } from '@/lib/importUtils';
import { guruImportColumns, validateGuruRows, importGuruRows } from '@/lib/guruImport';

interface FormData {
  nip: string;
  nuptk: string;
  nik: string;
  no_rfid: string;
  nama_lengkap: string;
  gelar_depan: string;
  gelar_belakang: string;
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  agama: string;
  alamat: string;
  no_hp: string;
  email: string;
  jenis_ptk: string;
  status_kepegawaian: string;
  jabatan: string;
  tanggal_masuk: string;
  shift_presensi_id: string;
  presensi_aktif: boolean;
  aktif: boolean;
  foto_url: string | null;
}

const emptyForm: FormData = {
  nip: '', nuptk: '', nik: '', no_rfid: '', nama_lengkap: '', gelar_depan: '', gelar_belakang: '',
  jenis_kelamin: '', tempat_lahir: '', tanggal_lahir: '', agama: '', alamat: '',
  no_hp: '', email: '', jenis_ptk: 'guru', status_kepegawaian: '', jabatan: '',
  tanggal_masuk: '', shift_presensi_id: '', presensi_aktif: true, aktif: true,
  foto_url: null,
};

const statusOptions = ['PNS', 'PPPK', 'Honorer', 'GTY/PTY', 'Jasa Profesi'];

function formatName(g: GuruTendik) {
  return [g.gelar_depan, g.nama_lengkap, g.gelar_belakang].filter(Boolean).join(' ');
}

function autoUsername(g: { nip: string | null; nuptk: string | null; nik: string | null }): string {
  return (g.nip || g.nuptk || g.nik || '').trim();
}

const adminApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

export default function GuruTendikPage() {
  const [items, setItems] = useState<GuruTendik[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GuruTendik | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuruTendik | null>(null);
  const [qrTarget, setQrTarget] = useState<GuruTendik | null>(null);
  const [rfidHistory, setRfidHistory] = useState<RfidHistory[]>([]);
  const [rfidHistoryTarget, setRfidHistoryTarget] = useState<GuruTendik | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [shiftList, setShiftList] = useState<ShiftPresensi[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  // Account state
  const [accountInfo, setAccountInfo] = useState<{ userId: string; email: string; banned: boolean; lastLogin: string | null } | null>(null);
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [banConfirm, setBanConfirm] = useState<{ userId: string; ban: boolean } | null>(null);

  async function fetchData() {
    setLoading(true);
    const [gtRes, shiftRes] = await Promise.all([
      supabase.from('guru_tendik').select('*').order('nama_lengkap'),
      supabase.from('shift_presensi').select('*').eq('aktif', true).order('nama'),
    ]);
    if (gtRes.error) { setError(gtRes.error.message); setLoading(false); return; }
    setItems((gtRes.data ?? []) as GuruTendik[]);
    setShiftList((shiftRes.data ?? []) as ShiftPresensi[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJabatan, setFilterJabatan] = useState('');

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = i.nama_lengkap.toLowerCase().includes(q) ||
      (i.nip ?? '').includes(search) || (i.nuptk ?? '').includes(search) || (i.nik ?? '').includes(search) || (i.jabatan ?? '').toLowerCase().includes(q);
    const matchType = filterType === 'all' || i.jenis_ptk === filterType;
    const matchStatus = filterStatus === 'all' || i.status_kepegawaian === filterStatus;
    const matchJabatan = !filterJabatan || (i.jabatan ?? '').toLowerCase().includes(filterJabatan.toLowerCase());
    return matchSearch && matchType && matchStatus && matchJabatan;
  });

  async function fetchAccountInfo(userId: string) {
    setAccountInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(adminApiUrl, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const list = await res.json() as ManagedUser[];
        const found = list.find((u) => u.id === userId);
        if (found) {
          setAccountInfo({ userId: found.id, email: found.email, banned: found.banned, lastLogin: found.last_login_at });
          setAccountUsername(found.email);
        }
      }
    } catch { /* non-critical */ }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setPhotoPath(null);
    setError(null);
    setAccountInfo(null);
    setAccountUsername('');
    setAccountPassword('');
    setAccountPasswordConfirm('');
    setShowCreateAccount(false);
    setModalOpen(true);
  }

  function openEdit(item: GuruTendik) {
    setEditing(item);
    setForm({
      nip: item.nip ?? '',
      nuptk: item.nuptk ?? '',
      nik: item.nik ?? '',
      no_rfid: item.no_rfid ?? '',
      nama_lengkap: item.nama_lengkap,
      gelar_depan: item.gelar_depan ?? '',
      gelar_belakang: item.gelar_belakang ?? '',
      jenis_kelamin: item.jenis_kelamin ?? '',
      tempat_lahir: item.tempat_lahir ?? '',
      tanggal_lahir: item.tanggal_lahir ?? '',
      agama: item.agama ?? '',
      alamat: item.alamat ?? '',
      no_hp: item.no_hp ?? '',
      email: item.email ?? '',
      jenis_ptk: item.jenis_ptk,
      status_kepegawaian: item.status_kepegawaian ?? '',
      jabatan: item.jabatan ?? '',
      tanggal_masuk: item.tanggal_masuk ?? '',
      shift_presensi_id: item.shift_presensi_id ?? '',
      presensi_aktif: item.presensi_aktif,
      aktif: item.aktif,
      foto_url: item.foto_url ?? null,
    });
    setPhotoPath(item.foto_url ?? null);
    setError(null);
    setAccountInfo(null);
    setAccountUsername('');
    setAccountPassword('');
    setAccountPasswordConfirm('');
    setShowCreateAccount(false);
    setModalOpen(true);
    if (item.user_id) {
      fetchAccountInfo(item.user_id);
    }
  }

  async function handleCreateAccount() {
    if (!editing) return;
    const username = accountUsername.trim() || autoUsername(form);
    if (!username) { setError('Username tidak boleh kosong'); return; }
    if (accountPassword !== accountPasswordConfirm) { setError('Password dan konfirmasi tidak sama'); return; }
    if (accountPassword.length < 6) { setError('Password minimal 6 karakter'); return; }

    const email = `${username}@sekolah.sch.id`;
    setAccountBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${adminApiUrl}?action=create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email,
          password: accountPassword,
          full_name: form.nama_lengkap,
          roles: form.jenis_ptk === 'guru' ? ['guru'] : ['tendik'],
          link_table: 'guru_tendik',
          link_id: editing.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal membuat akun');
        setAccountBusy(false);
        return;
      }
      setShowCreateAccount(false);
      setAccountPassword('');
      setAccountPasswordConfirm('');
      fetchData();
      fetchAccountInfo((await res.json()).id);
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
  }

  async function handleResetPassword() {
    if (!accountInfo?.userId) return;
    setAccountBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${adminApiUrl}?userId=${accountInfo.userId}&action=reset-password`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal reset password');
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
    setResetConfirm(null);
  }

  async function handleToggleBan() {
    if (!accountInfo?.userId || !banConfirm) return;
    setAccountBusy(true);
    setError(null);
    const action = banConfirm.ban ? 'ban' : 'unban';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${adminApiUrl}?userId=${accountInfo.userId}&action=${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal mengubah status akun');
      } else {
        setAccountInfo({ ...accountInfo, banned: banConfirm.ban });
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
    setBanConfirm(null);
  }

  async function handleUpdateEmail() {
    if (!accountInfo?.userId || !accountUsername.trim()) return;
    setAccountBusy(true);
    setError(null);
    const newEmail = `${accountUsername.trim()}@sekolah.sch.id`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${adminApiUrl}?userId=${accountInfo.userId}&action=update-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal mengubah username');
      } else {
        setAccountInfo({ ...accountInfo, email: newEmail });
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
  }

  async function checkDuplicateGuru(field: string, value: string, excludeId: string): Promise<boolean> {
    const { data } = await supabase
      .from('guru_tendik')
      .select('id')
      .eq(field, value)
      .neq('id', excludeId)
      .maybeSingle();
    return !!data;
  }

  async function checkDuplicateRfidGuru(rfid: string, excludeId: string): Promise<boolean> {
    const { data } = await supabase
      .from('guru_tendik')
      .select('id')
      .eq('no_rfid', rfid)
      .neq('id', excludeId)
      .eq('aktif', true)
      .maybeSingle();
    return !!data;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const rfidValue = form.no_rfid.trim() || null;
    const rfidChanged = editing ? (editing.no_rfid ?? '') !== (rfidValue ?? '') : rfidValue !== null;

    // Duplicate validation — exclude current record when editing
    if (editing) {
      const checks: Promise<{ field: string; value: string; dup: boolean }>[] = [];
      if (form.nip.trim()) checks.push(checkDuplicateGuru('nip', form.nip.trim(), editing.id).then((dup) => ({ field: 'nip', value: form.nip.trim(), dup })));
      if (form.nuptk.trim()) checks.push(checkDuplicateGuru('nuptk', form.nuptk.trim(), editing.id).then((dup) => ({ field: 'nuptk', value: form.nuptk.trim(), dup })));
      if (form.nik.trim()) checks.push(checkDuplicateGuru('nik', form.nik.trim(), editing.id).then((dup) => ({ field: 'nik', value: form.nik.trim(), dup })));
      if (rfidValue) checks.push(checkDuplicateRfidGuru(rfidValue, editing.id).then((dup) => ({ field: 'no_rfid', value: rfidValue, dup })));
      const results = await Promise.all(checks);
      const dup = results.find((r) => r.dup);
      if (dup) {
        const labels: Record<string, string> = { nip: 'NIP', nuptk: 'NUPTK', nik: 'NIK', no_rfid: 'RFID' };
        setError(`${labels[dup.field]} sudah digunakan oleh guru/tendik lain.`);
        setSaving(false);
        return;
      }
    } else {
      // New record — check all fields against all records
      const checks: Promise<{ field: string; dup: boolean }>[] = [];
      if (form.nip.trim()) checks.push(checkDuplicateGuru('nip', form.nip.trim(), '00000000-0000-0000-0000-000000000000').then((dup) => ({ field: 'nip', dup })));
      if (form.nuptk.trim()) checks.push(checkDuplicateGuru('nuptk', form.nuptk.trim(), '00000000-0000-0000-0000-000000000000').then((dup) => ({ field: 'nuptk', dup })));
      if (form.nik.trim()) checks.push(checkDuplicateGuru('nik', form.nik.trim(), '00000000-0000-0000-0000-000000000000').then((dup) => ({ field: 'nik', dup })));
      if (rfidValue) checks.push(checkDuplicateRfidGuru(rfidValue, '00000000-0000-0000-0000-000000000000').then((dup) => ({ field: 'no_rfid', dup })));
      const results = await Promise.all(checks);
      const dup = results.find((r) => r.dup);
      if (dup) {
        const labels: Record<string, string> = { nip: 'NIP', nuptk: 'NUPTK', nik: 'NIK', no_rfid: 'RFID' };
        setError(`${labels[dup.field]} sudah digunakan oleh guru/tendik lain.`);
        setSaving(false);
        return;
      }
    }

    const payload = {
      nip: form.nip || null,
      nuptk: form.nuptk || null,
      nik: form.nik || null,
      no_rfid: rfidValue,
      nama_lengkap: form.nama_lengkap,
      gelar_depan: form.gelar_depan || null,
      gelar_belakang: form.gelar_belakang || null,
      jenis_kelamin: form.jenis_kelamin || null,
      tempat_lahir: form.tempat_lahir || null,
      tanggal_lahir: form.tanggal_lahir || null,
      agama: form.agama || null,
      alamat: form.alamat || null,
      no_hp: form.no_hp || null,
      email: form.email || null,
      jenis_ptk: form.jenis_ptk,
      status_kepegawaian: form.status_kepegawaian || null,
      jabatan: form.jabatan || null,
      tanggal_masuk: form.tanggal_masuk || null,
      aktif: form.aktif,
      shift_presensi_id: form.shift_presensi_id || null,
      foto_url: photoPath,
    };

    let savedId: string | null = null;

    if (editing) {
      const { error: err } = await supabase.from('guru_tendik').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
      savedId = editing.id;
    } else {
      const { data, error: err } = await supabase.from('guru_tendik').insert(payload).select('id').single();
      if (err) { setError(err.message); setSaving(false); return; }
      savedId = data.id;
    }

    if (rfidChanged && savedId) {
      if (editing?.no_rfid) {
        await supabase
          .from('rfid_history')
          .update({ status: 'nonaktif', deactivated_at: new Date().toISOString() })
          .eq('person_type', 'guru_tendik')
          .eq('person_id', savedId)
          .eq('status', 'aktif');
      }
      if (rfidValue) {
        await supabase.from('rfid_history').insert({
          person_type: 'guru_tendik',
          person_id: savedId,
          no_rfid: rfidValue,
          status: 'aktif',
        });
      }
    }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('guru_tendik').delete().eq('id', deleteTarget.id);
    if (err) { setError(err.message); return; }
    if (deleteTarget.foto_url) {
      await supabase.storage.from('profile-photos').remove([deleteTarget.foto_url]);
    }
    fetchData();
  }

  async function showRfidHistory(guru: GuruTendik) {
    setRfidHistoryTarget(guru);
    const { data } = await supabase
      .from('rfid_history')
      .select('*')
      .eq('person_type', 'guru_tendik')
      .eq('person_id', guru.id)
      .order('assigned_at', { ascending: false });
    setRfidHistory((data ?? []) as RfidHistory[]);
  }

  async function handleImportValidate(rows: Record<string, string>[]) {
    return validateGuruRows(rows);
  }

  async function handleImportExecute(validRows: Record<string, string>[], mode: ImportMode) {
    const result = await importGuruRows(validRows, mode);
    fetchData();
    return result;
  }

  function handleDownloadTemplate() {
    downloadTemplate(guruImportColumns, 'Guru_Tendik', [
      'Isi data guru/tendik pada sheet DATA_GURU_TENDIK. Baris pertama (CONTOH) dapat dihapus.',
      'Nama Lengkap wajib diisi. Jenis wajib diisi (Guru atau Tendik).',
      'NIP, NUPTK, NIK harus unik. Jika kosong, biarkan kosong (jangan isi dengan tanda -).',
      'Jenis Kelamin: L untuk Laki-laki, P untuk Perempuan.',
      'Tanggal Lahir format: YYYY-MM-DD (contoh: 1990-01-15).',
      'Agama pilihan: Islam, Kristen, Katolik, Hindu, Buddha, Konghucu.',
      'Status Kepegawaian: PNS, PPPK, Honorer, GTY/PTY, atau Jasa Profesi.',
      'RFID: nomor kartu RFID jika tersedia. Harus unik untuk orang aktif.',
      'Jangan masukkan password, user ID, token, atau field rahasia.',
      'Akun login dibuat otomatis: username = NIP > NUPTK > NIK, password awal = username.',
    ]);
  }

  function handleExport() {
    const exportRows = items.map((g) => ({
      'NIP': g.nip ?? '',
      'NUPTK': g.nuptk ?? '',
      'NIK': g.nik ?? '',
      'Nama Lengkap': g.nama_lengkap,
      'Jenis Kelamin': g.jenis_kelamin ?? '',
      'Tempat Lahir': g.tempat_lahir ?? '',
      'Tanggal Lahir': g.tanggal_lahir ?? '',
      'Agama': g.agama ?? '',
      'Alamat': g.alamat ?? '',
      'No HP': g.no_hp ?? '',
      'Email': g.email ?? '',
      'Jenis': g.jenis_ptk === 'guru' ? 'Guru' : 'Tendik',
      'Status': g.status_kepegawaian ?? '',
      'RFID': g.no_rfid ?? '',
    }));
    exportToExcel(exportRows, guruImportColumns, 'Guru_Tendik');
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition";
  const monoInputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition";

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <UserCog className="w-6 h-6 text-emerald-700" />
              Guru &amp; Tenaga Kependidikan
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kelola data pendidik dan tenaga kependidikan</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
              <Plus className="w-4 h-4" /> Tambah
            </button>
            <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition">
              <Upload className="w-4 h-4" /> Import Excel/CSV
            </button>
            <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              <FileSpreadsheet className="w-4 h-4" /> Download Template
            </button>
            <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              <FileDown className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIP, NUPTK, NIK, jabatan..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-gray-300 bg-white pl-10 pr-8 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              <option value="all">Semua Jenis</option>
              <option value="guru">Guru</option>
              <option value="tendik">Tendik</option>
            </select>
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Status</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="text" value={filterJabatan} onChange={(e) => setFilterJabatan(e.target.value)} placeholder="Filter jabatan..." className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition max-w-[150px]" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3 hidden sm:table-cell">NIP</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3 hidden md:table-cell">Jabatan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada data guru/tendik</td></tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {getPhotoUrl('profile-photos', item.foto_url) ? (
                            <img src={getPhotoUrl('profile-photos', item.foto_url)!} alt={formatName(item)} className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {item.nama_lengkap.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-800">{formatName(item)}</div>
                            <div className="text-xs text-gray-500">{item.no_hp ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell font-mono">{item.nip ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.jenis_ptk === 'guru' ? 'info' : 'neutral'}>
                          {item.jenis_ptk === 'guru' ? 'Guru' : 'Tendik'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{item.jabatan ?? '—'}</td>
                      <td className="px-4 py-3">
                        {item.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setQrTarget(item)} disabled={!getGuruQrSource(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition disabled:opacity-30 disabled:cursor-not-allowed" title="QR Code">
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(item)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Guru/Tendik' : 'Tambah Guru/Tendik'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Foto Profil */}
          <div className="flex justify-center pb-2">
            <PhotoUpload
              bucket="profile-photos"
              pathPrefix="guru-tendik"
              existingPath={editing?.foto_url ?? null}
              onPathChange={setPhotoPath}
            />
          </div>

          {/* Section: Data Pribadi */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              Data Pribadi
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap *</label>
                <input type="text" required value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kelamin</label>
                <select value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Gelar Depan</label>
                <input type="text" value={form.gelar_depan} onChange={(e) => setForm({ ...form, gelar_depan: e.target.value })} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Gelar Belakang</label>
                <input type="text" value={form.gelar_belakang} onChange={(e) => setForm({ ...form, gelar_belakang: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Agama</label>
                <select value={form.agama} onChange={(e) => setForm({ ...form, agama: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tempat Lahir</label>
                <input type="text" value={form.tempat_lahir} onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Lahir</label>
                <input type="date" value={form.tanggal_lahir} onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Section: Data Kepegawaian */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              Data Kepegawaian
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIP</label>
                <input type="text" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className={monoInputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NUPTK</label>
                <input type="text" value={form.nuptk} onChange={(e) => setForm({ ...form, nuptk: e.target.value })} className={monoInputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK</label>
                <input type="text" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} className={monoInputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis PTK *</label>
                <select required value={form.jenis_ptk} onChange={(e) => setForm({ ...form, jenis_ptk: e.target.value })} className={inputCls}>
                  <option value="guru">Guru</option>
                  <option value="tendik">Tenaga Kependidikan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status Kepegawaian</label>
                <select value={form.status_kepegawaian} onChange={(e) => setForm({ ...form, status_kepegawaian: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jabatan</label>
                <input type="text" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Masuk</label>
                <input type="date" value={form.tanggal_masuk} onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Section: Kontak */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              Kontak
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP</label>
                <input type="text" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
              <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} rows={2} className={inputCls} />
            </div>
          </div>

          {/* Section: Identitas Presensi */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <CreditCard className="w-4 h-4 text-emerald-600" /> Identitas Presensi
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor RFID</label>
                <input
                  type="text"
                  value={form.no_rfid}
                  onChange={(e) => setForm({ ...form, no_rfid: e.target.value })}
                  placeholder="Nomor kartu RFID (jika ada)"
                  className={monoInputCls}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Scan atau ketik nomor RFID. Jika diganti, RFID lama otomatis dinonaktifkan.
                </p>
              </div>
              <div className="flex items-center">
                {(() => {
                  const qr = getGuruQrSource({ nip: form.nip || null, nuptk: form.nuptk || null, nik: form.nik || null });
                  if (qr) {
                    return (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 w-full">
                        <p className="text-xs text-emerald-700 font-medium">QR Code Presensi</p>
                        <p className="text-sm text-gray-600 mt-1">
                          QR dibuat dari <strong>{qr.source}</strong>: <span className="font-mono text-emerald-700 font-semibold">{qr.value}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Prioritas: NIP &gt; NUPTK &gt; NIK. QR ditampilkan setelah disimpan.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 w-full">
                      <p className="text-sm text-gray-400">Isi NIP, NUPTK, atau NIK untuk membuat QR Code presensi.</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Section: Akun Login */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Akun Login
            </h4>
            {editing ? (
              accountInfo ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Username</label>
                      <div className="flex gap-2">
                        <input type="text" value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)} className={monoInputCls} />
                        <button type="button" onClick={handleUpdateEmail} disabled={accountBusy}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                          Simpan
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">Username = email sebelum @. Format: username@sekolah.sch.id</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Status Akun</label>
                      <div className="flex items-center gap-2">
                        {accountInfo.banned ? <Badge variant="error">Nonaktif</Badge> : <Badge variant="success">Aktif</Badge>}
                        <button type="button"
                          onClick={() => setBanConfirm({ userId: accountInfo.userId, ban: !accountInfo.banned })}
                          disabled={accountBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50">
                          {accountInfo.banned ? (<><CheckCircle2 className="w-3.5 h-3.5" /> Aktifkan</>) : (<><Ban className="w-3.5 h-3.5" /> Nonaktifkan</>)}
                        </button>
                      </div>
                    </div>
                  </div>
                  {accountInfo.lastLogin && (
                    <div>
                      <p className="text-xs text-gray-500">Terakhir Login</p>
                      <p className="text-sm text-gray-700">{new Date(accountInfo.lastLogin).toLocaleString('id-ID')}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setResetConfirm(accountInfo.userId)}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 transition">
                      <KeyRound className="w-4 h-4" /> Reset Password
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Password tersimpan dalam bentuk hash dan tidak dapat ditampilkan.</p>
                </div>
              ) : showCreateAccount ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Username *</label>
                      <input type="text" value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)}
                        placeholder={autoUsername(form) || 'Masukkan username'} className={monoInputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Password *</label>
                      <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)}
                        minLength={6} placeholder="Minimal 6 karakter" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Konfirmasi Password *</label>
                      <input type="password" value={accountPasswordConfirm} onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                        minLength={6} placeholder="Ulangi password" className={inputCls} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Password disimpan dalam bentuk hash. Email otomatis: username@sekolah.sch.id</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCreateAccount} disabled={accountBusy}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">
                      {accountBusy ? 'Memproses...' : 'Buat Akun'}
                    </button>
                    <button type="button" onClick={() => setShowCreateAccount(false)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setAccountUsername(autoUsername(form)); setShowCreateAccount(true); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition">
                    <UserPlus className="w-4 h-4" /> Buat Akun
                  </button>
                  <p className="text-sm text-gray-500">Guru/Tendik ini belum memiliki akun login.</p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Username (otomatis)</label>
                    <input type="text" value={accountUsername || autoUsername(form)} readOnly
                      placeholder="NIP / NUPTK / NIK" className={`${monoInputCls} bg-gray-50 text-gray-500`} />
                    <p className="mt-1 text-xs text-gray-400">Prioritas: NIP &gt; NUPTK &gt; NIK</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Password *</label>
                    <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)}
                      minLength={6} placeholder="Minimal 6 karakter" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Konfirmasi Password *</label>
                    <input type="password" value={accountPasswordConfirm} onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                      minLength={6} placeholder="Ulangi password" className={inputCls} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Akun dibuat otomatis saat data disimpan. Password disimpan dalam bentuk hash.
                  {' '}Jika password dikosongkan, default = username.
                </p>
              </div>
            )}
          </div>

          {/* Section: Pengaturan Presensi */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <Clock className="w-4 h-4 text-emerald-600" /> Pengaturan Presensi
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift Presensi</label>
                <select value={form.shift_presensi_id} onChange={(e) => setForm({ ...form, shift_presensi_id: e.target.value })} className={inputCls}>
                  <option value="">{form.jenis_ptk === 'guru' ? 'Mengikuti Jadwal Mengajar' : '— Pilih Shift —'}</option>
                  {shiftList.map((s) => (
                    <option key={s.id} value={s.id}>{s.nama} ({s.jam_masuk} - {s.jam_pulang})</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {form.jenis_ptk === 'guru'
                    ? 'Guru default mengikuti jadwal mengajar. Pilih shift jika sekolah membutuhkan aturan shift tertentu.'
                    : 'Tendik wajib memilih shift dari Master Shift Presensi.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status Presensi</label>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={form.presensi_aktif} onChange={(e) => setForm({ ...form, presensi_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                  <span className="text-sm text-gray-700">Presensi aktif</span>
                </label>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Guru/Tendik aktif</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!resetConfirm}
        title="Reset Password"
        message="Password akan direset ke username (NIP/NUPTK/NIK). Password lama tidak ditampilkan. Lanjutkan?"
        onConfirm={handleResetPassword}
        onClose={() => setResetConfirm(null)}
        confirmLabel={accountBusy ? 'Memproses...' : 'Ya, Reset'}
        variant="warning"
      />

      <ConfirmDialog
        open={!!banConfirm}
        title={banConfirm?.ban ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
        message={banConfirm?.ban ? 'Akun akan dinonaktifkan. Pengguna tidak dapat login. Lanjutkan?' : 'Akun akan diaktifkan kembali. Lanjutkan?'}
        onConfirm={handleToggleBan}
        onClose={() => setBanConfirm(null)}
        confirmLabel={accountBusy ? 'Memproses...' : 'Ya'}
        variant="warning"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus Data Guru/Tendik"
        message={`Yakin ingin menghapus "${formatName(deleteTarget ?? { nama_lengkap: '' } as GuruTendik)}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* QR Code Modal */}
      <Modal open={!!qrTarget} onClose={() => setQrTarget(null)} title="QR Code Presensi Guru/Tendik" size="sm">
        {qrTarget && (() => {
          const qr = getGuruQrSource(qrTarget);
          if (!qr) return <p className="text-center text-sm text-gray-400 py-4">NIP, NUPTK, dan NIK belum diisi. Isi salah satu untuk membuat QR Code.</p>;
          return (
            <div className="space-y-4">
              {getPhotoUrl('profile-photos', qrTarget.foto_url) && (
                <div className="flex justify-center">
                  <img src={getPhotoUrl('profile-photos', qrTarget.foto_url)!} alt={formatName(qrTarget)} className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100 shadow-sm" />
                </div>
              )}
              <QRCodeDisplay
                value={qr.value}
                label={formatName(qrTarget)}
                sublabel={`Sumber: ${qr.source}`}
              />
              {qrTarget.no_rfid && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-xs text-gray-500">Nomor RFID aktif</p>
                  <p className="font-mono text-sm text-gray-800 mt-0.5">{qrTarget.no_rfid}</p>
                </div>
              )}
              {qrTarget.no_rfid && (
                <button
                  type="button"
                  onClick={() => { showRfidHistory(qrTarget); }}
                  className="w-full text-center text-sm text-emerald-700 hover:text-emerald-800 transition"
                >
                  Lihat Riwayat RFID
                </button>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* RFID History Modal */}
      <Modal open={!!rfidHistoryTarget} onClose={() => setRfidHistoryTarget(null)} title="Riwayat RFID" size="md">
        {rfidHistoryTarget && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{formatName(rfidHistoryTarget)}</span>
            </div>
            {rfidHistory.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">Belum ada riwayat RFID.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">No. RFID</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Ditetapkan</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Dinonaktifkan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rfidHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 font-mono text-gray-800">{h.no_rfid}</td>
                        <td className="px-3 py-2">
                          <Badge variant={h.status === 'aktif' ? 'success' : 'neutral'}>
                            {h.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-500 hidden sm:table-cell text-xs">
                          {new Date(h.assigned_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-2 text-gray-500 hidden sm:table-cell text-xs">
                          {h.deactivated_at ? new Date(h.deactivated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Data Guru & Tendik"
        columns={guruImportColumns}
        sheetName="Guru_Tendik"
        onDownloadTemplate={handleDownloadTemplate}
        onValidate={handleImportValidate}
        onImport={handleImportExecute}
        onExport={handleExport}
      />
    </AppLayout>
  );
}

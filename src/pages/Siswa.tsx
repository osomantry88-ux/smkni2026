import { useEffect, useState, type FormEvent } from 'react';
import { Users, Plus, Pencil, Trash2, Search, Filter, User, Users2, School, QrCode, CreditCard, Upload, FileSpreadsheet, FileDown, KeyRound, ShieldCheck, Ban, CheckCircle2, UserPlus, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Siswa, Kelas, Jurusan, TahunPelajaran, RfidHistory, ManagedUser, PresensiSiswa } from '@/types/database';
import { PRESENSI_STATUS_LABELS, PRESENSI_STATUS_VARIANTS, PRESENSI_METODE_LABELS } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';
import QRCodeDisplay, { getSiswaQrSource } from '@/components/QRCodeDisplay';
import PhotoUpload, { getPhotoUrl } from '@/components/PhotoUpload';
import { supabase as supabaseClient } from '@/lib/supabase';
import ImportModal, { type ImportMode } from '@/components/ImportModal';
import { downloadTemplate, exportToExcel, type ImportRow } from '@/lib/importUtils';
import { siswaImportColumns, validateSiswaRows, importSiswaRows } from '@/lib/siswaImport';

interface FormData {
  nis: string;
  nisn: string;
  nik: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  agama: string;
  alamat: string;
  no_hp: string;
  email: string;
  asal_sekolah: string;
  tanggal_masuk: string;
  kelas_id: string;
  jurusan_id: string;
  tahun_pelajaran_id: string;
  status: string;
  aktif: boolean;
  // Orang Tua / Wali
  nama_ayah: string;
  nama_ibu: string;
  nama_wali: string;
  nik_ayah: string;
  nik_ibu: string;
  nik_wali: string;
  tahun_lahir_ayah: string;
  tahun_lahir_ibu: string;
  pendidikan_ayah: string;
  pendidikan_ibu: string;
  pendidikan_wali: string;
  pekerjaan_ayah: string;
  pekerjaan_ibu: string;
  pekerjaan_wali: string;
  penghasilan_ayah: string;
  penghasilan_ibu: string;
  penghasilan_wali: string;
  no_hp_ayah: string;
  no_hp_ibu: string;
  no_hp_wali: string;
  alamat_ortu: string;
  alamat_ayah: string;
  alamat_ibu: string;
  alamat_wali: string;
  hubungan_wali: string;
  no_rfid: string;
  foto_url: string | null;
}

const emptyForm: FormData = {
  nis: '', nisn: '', nik: '', nama_lengkap: '', jenis_kelamin: '', tempat_lahir: '',
  tanggal_lahir: '', agama: '', alamat: '', no_hp: '', email: '', asal_sekolah: '',
  tanggal_masuk: '', kelas_id: '', jurusan_id: '', tahun_pelajaran_id: '',
  status: 'aktif', aktif: true,
  nama_ayah: '', nama_ibu: '', nama_wali: '',
  nik_ayah: '', nik_ibu: '', nik_wali: '',
  tahun_lahir_ayah: '', tahun_lahir_ibu: '',
  pendidikan_ayah: '', pendidikan_ibu: '', pendidikan_wali: '',
  pekerjaan_ayah: '', pekerjaan_ibu: '', pekerjaan_wali: '',
  penghasilan_ayah: '', penghasilan_ibu: '', penghasilan_wali: '',
  no_hp_ayah: '', no_hp_ibu: '', no_hp_wali: '',
  alamat_ortu: '', alamat_ayah: '', alamat_ibu: '', alamat_wali: '',
  hubungan_wali: '',
  no_rfid: '',
  foto_url: null,
};

const pendidikanOptions = ['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3'];

const statusOptions: { value: Siswa['status']; label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }[] = [
  { value: 'aktif', label: 'Aktif', variant: 'success' },
  { value: 'lulus', label: 'Lulus', variant: 'info' as 'success' },
  { value: 'pindah', label: 'Pindah', variant: 'warning' },
  { value: 'keluar', label: 'Keluar', variant: 'error' },
];

const agamaOptions = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];

export default function SiswaPage() {
  const [items, setItems] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Siswa | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Siswa | null>(null);
  const [qrTarget, setQrTarget] = useState<Siswa | null>(null);
  const [rfidHistory, setRfidHistory] = useState<RfidHistory[]>([]);
  const [rfidHistoryTarget, setRfidHistoryTarget] = useState<Siswa | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editAccountInfo, setEditAccountInfo] = useState<{ userId: string; email: string; banned: boolean; lastLogin: string | null } | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [resetPassTarget, setResetPassTarget] = useState<string | null>(null);
  const [banConfirm, setBanConfirm] = useState<{ userId: string; ban: boolean } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [presensiRiwayatTarget, setPresensiRiwayatTarget] = useState<Siswa | null>(null);
  const [presensiRiwayat, setPresensiRiwayat] = useState<PresensiSiswa[]>([]);
  const [loadingPresensiRiwayat, setLoadingPresensiRiwayat] = useState(false);

  async function fetchData() {
    setLoading(true);
    const [siswaRes, kelasRes, jurusanRes, tpRes] = await Promise.all([
      supabase.from('siswa').select('*, kelas:kelas_id(id, nama), jurusan:jurusan_id(id, kode, nama), tahun_pelajaran:tahun_pelajaran_id(id, nama)').order('nama_lengkap'),
      supabase.from('kelas').select('id, nama').eq('aktif', true).order('nama'),
      supabase.from('jurusan').select('*').eq('aktif', true).order('kode'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
    ]);

    if (siswaRes.error) { setError(siswaRes.error.message); setLoading(false); return; }
    setItems((siswaRes.data ?? []) as unknown as Siswa[]);
    setKelasList((kelasRes.data ?? []) as Kelas[]);
    setJurusanList((jurusanRes.data ?? []) as Jurusan[]);
    setTpList((tpRes.data ?? []) as TahunPelajaran[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJurusan, setFilterJurusan] = useState('all');

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = i.nama_lengkap.toLowerCase().includes(q) ||
      (i.nis ?? '').includes(search) || (i.nisn ?? '').includes(search) || (i.nik ?? '').includes(search);
    const matchKelas = filterKelas === 'all' || i.kelas_id === filterKelas;
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    const matchJurusan = filterJurusan === 'all' || i.jurusan_id === filterJurusan;
    return matchSearch && matchKelas && matchStatus && matchJurusan;
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, tahun_pelajaran_id: tpList.find((t) => t.aktif)?.id ?? '' });
    setPhotoPath(null);
    setError(null);
    setEditAccountInfo(null);
    setEditUsername('');
    setEditPassword('');
    setEditPasswordConfirm('');
    setShowCreateAccount(false);
    setNewPassword('');
    setNewPasswordConfirm('');
    setModalOpen(true);
  }

  function openEdit(item: Siswa) {
    setEditing(item);
    setForm({
      nis: item.nis ?? '',
      nisn: item.nisn ?? '',
      nik: item.nik ?? '',
      nama_lengkap: item.nama_lengkap,
      jenis_kelamin: item.jenis_kelamin ?? '',
      tempat_lahir: item.tempat_lahir ?? '',
      tanggal_lahir: item.tanggal_lahir ?? '',
      agama: item.agama ?? '',
      alamat: item.alamat ?? '',
      no_hp: item.no_hp ?? '',
      email: item.email ?? '',
      asal_sekolah: item.asal_sekolah ?? '',
      tanggal_masuk: item.tanggal_masuk ?? '',
      kelas_id: item.kelas_id ?? '',
      jurusan_id: item.jurusan_id ?? '',
      tahun_pelajaran_id: item.tahun_pelajaran_id ?? '',
      status: item.status,
      aktif: item.aktif,
      nama_ayah: item.nama_ayah ?? '',
      nama_ibu: item.nama_ibu ?? '',
      nama_wali: item.nama_wali ?? '',
      nik_ayah: item.nik_ayah ?? '',
      nik_ibu: item.nik_ibu ?? '',
      nik_wali: item.nik_wali ?? '',
      tahun_lahir_ayah: item.tahun_lahir_ayah ?? '',
      tahun_lahir_ibu: item.tahun_lahir_ibu ?? '',
      pendidikan_ayah: item.pendidikan_ayah ?? '',
      pendidikan_ibu: item.pendidikan_ibu ?? '',
      pendidikan_wali: item.pendidikan_wali ?? '',
      pekerjaan_ayah: item.pekerjaan_ayah ?? '',
      pekerjaan_ibu: item.pekerjaan_ibu ?? '',
      pekerjaan_wali: item.pekerjaan_wali ?? '',
      penghasilan_ayah: item.penghasilan_ayah ?? '',
      penghasilan_ibu: item.penghasilan_ibu ?? '',
      penghasilan_wali: item.penghasilan_wali ?? '',
      no_hp_ayah: item.no_hp_ayah ?? '',
      no_hp_ibu: item.no_hp_ibu ?? '',
      no_hp_wali: item.no_hp_wali ?? '',
      alamat_ortu: item.alamat_ortu ?? '',
      alamat_ayah: item.alamat_ayah ?? '',
      alamat_ibu: item.alamat_ibu ?? '',
      alamat_wali: item.alamat_wali ?? '',
      hubungan_wali: item.hubungan_wali ?? '',
      no_rfid: item.no_rfid ?? '',
      foto_url: item.foto_url ?? null,
    });
    setPhotoPath(item.foto_url ?? null);
    setError(null);
    setEditAccountInfo(null);
    setEditUsername('');
    setEditPassword('');
    setEditPasswordConfirm('');
    setShowCreateAccount(false);
    setNewPassword('');
    setNewPasswordConfirm('');
    setModalOpen(true);
    if (item.user_id) {
      fetchSiswaAccount(item.user_id);
    }
  }

  async function fetchSiswaAccount(userId: string) {
    setEditAccountInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const list = await res.json() as ManagedUser[];
        const found = list.find((u) => u.id === userId);
        if (found) {
          setEditAccountInfo({ userId: found.id, email: found.email, banned: found.banned, lastLogin: found.last_login_at });
          setEditUsername(found.email.replace(/@.*$/, ''));
        }
      }
    } catch { /* non-critical */ }
  }

  async function handleCreateSiswaAccount() {
    if (!editing) return;
    const username = editUsername.trim() || form.nisn.trim();
    if (!username) { setError('Username tidak boleh kosong'); return; }
    if (editPassword !== editPasswordConfirm) { setError('Password dan konfirmasi tidak sama'); return; }
    if (editPassword.length < 6) { setError('Password minimal 6 karakter'); return; }
    setAccountBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = `${username}@siswa.sch.id`;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email, password: editPassword, full_name: form.nama_lengkap, roles: ['siswa'], link_table: 'siswa', link_id: editing.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal membuat akun');
        setAccountBusy(false);
        return;
      }
      setShowCreateAccount(false);
      setEditPassword('');
      setEditPasswordConfirm('');
      fetchData();
      const data = await res.json();
      fetchSiswaAccount(data.id);
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
  }

  async function handleUpdateSiswaUsername() {
    if (!editAccountInfo?.userId || !editUsername.trim()) return;
    setAccountBusy(true);
    setError(null);
    const newEmail = `${editUsername.trim()}@siswa.sch.id`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?userId=${editAccountInfo.userId}&action=update-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal mengubah username');
      } else {
        setEditAccountInfo({ ...editAccountInfo, email: newEmail });
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
  }

  async function handleToggleSiswaBan() {
    if (!editAccountInfo?.userId || !banConfirm) return;
    setAccountBusy(true);
    setError(null);
    const action = banConfirm.ban ? 'ban' : 'unban';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?userId=${editAccountInfo.userId}&action=${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal mengubah status akun');
      } else {
        setEditAccountInfo({ ...editAccountInfo, banned: banConfirm.ban });
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
    setBanConfirm(null);
  }

  async function handleResetSiswaPassword(userId: string) {
    setAccountBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?userId=${userId}&action=reset-password`,
        { method: 'PUT', headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Gagal reset password');
      }
    } catch {
      setError('Gagal terhubung ke server');
    }
    setAccountBusy(false);
    setResetPassTarget(null);
  }

  async function checkDuplicateSiswa(field: string, value: string, excludeId: string): Promise<boolean> {
    const { data } = await supabase
      .from('siswa')
      .select('id')
      .eq(field, value)
      .neq('id', excludeId)
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
    const excludeId = editing?.id ?? '00000000-0000-0000-0000-000000000000';
    const checks: Promise<{ field: string; dup: boolean }>[] = [];
    if (form.nis.trim()) checks.push(checkDuplicateSiswa('nis', form.nis.trim(), excludeId).then((dup) => ({ field: 'nis', dup })));
    if (form.nisn.trim()) checks.push(checkDuplicateSiswa('nisn', form.nisn.trim(), excludeId).then((dup) => ({ field: 'nisn', dup })));
    if (form.nik.trim()) checks.push(checkDuplicateSiswa('nik', form.nik.trim(), excludeId).then((dup) => ({ field: 'nik', dup })));
    if (rfidValue) checks.push(checkDuplicateSiswa('no_rfid', rfidValue, excludeId).then((dup) => ({ field: 'no_rfid', dup })));
    const results = await Promise.all(checks);
    const dup = results.find((r) => r.dup);
    if (dup) {
      const labels: Record<string, string> = { nis: 'NIS', nisn: 'NISN', nik: 'NIK', no_rfid: 'RFID' };
      setError(`${labels[dup.field]} sudah digunakan oleh siswa lain.`);
      setSaving(false);
      return;
    }

    const payload = {
      nis: form.nis || null,
      nisn: form.nisn || null,
      nik: form.nik || null,
      nama_lengkap: form.nama_lengkap,
      jenis_kelamin: form.jenis_kelamin || null,
      tempat_lahir: form.tempat_lahir || null,
      tanggal_lahir: form.tanggal_lahir || null,
      agama: form.agama || null,
      alamat: form.alamat || null,
      no_hp: form.no_hp || null,
      email: form.email || null,
      asal_sekolah: form.asal_sekolah || null,
      tanggal_masuk: form.tanggal_masuk || null,
      kelas_id: form.kelas_id || null,
      jurusan_id: form.jurusan_id || null,
      tahun_pelajaran_id: form.tahun_pelajaran_id || null,
      status: form.status,
      aktif: form.aktif,
      nama_ayah: form.nama_ayah || null,
      nama_ibu: form.nama_ibu || null,
      nama_wali: form.nama_wali || null,
      nik_ayah: form.nik_ayah || null,
      nik_ibu: form.nik_ibu || null,
      nik_wali: form.nik_wali || null,
      tahun_lahir_ayah: form.tahun_lahir_ayah || null,
      tahun_lahir_ibu: form.tahun_lahir_ibu || null,
      pendidikan_ayah: form.pendidikan_ayah || null,
      pendidikan_ibu: form.pendidikan_ibu || null,
      pendidikan_wali: form.pendidikan_wali || null,
      pekerjaan_ayah: form.pekerjaan_ayah || null,
      pekerjaan_ibu: form.pekerjaan_ibu || null,
      pekerjaan_wali: form.pekerjaan_wali || null,
      penghasilan_ayah: form.penghasilan_ayah || null,
      penghasilan_ibu: form.penghasilan_ibu || null,
      penghasilan_wali: form.penghasilan_wali || null,
      no_hp_ayah: form.no_hp_ayah || null,
      no_hp_ibu: form.no_hp_ibu || null,
      no_hp_wali: form.no_hp_wali || null,
      alamat_ortu: form.alamat_ortu || null,
      alamat_ayah: form.alamat_ayah || null,
      alamat_ibu: form.alamat_ibu || null,
      alamat_wali: form.alamat_wali || null,
      hubungan_wali: form.hubungan_wali || null,
      no_rfid: rfidValue,
      foto_url: photoPath,
    };

    let savedId: string | null = null;

    if (editing) {
      const { error: err } = await supabase.from('siswa').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
      savedId = editing.id;
    } else {
      const { data, error: err } = await supabase.from('siswa').insert(payload).select('id').single();
      if (err) { setError(err.message); setSaving(false); return; }
      savedId = data.id;
    }

    // Manage RFID history when RFID is set or changed
    if (rfidChanged && savedId) {
      // If editing and had old RFID, deactivate it in history
      if (editing?.no_rfid) {
        await supabase
          .from('rfid_history')
          .update({ status: 'nonaktif', deactivated_at: new Date().toISOString() })
          .eq('person_type', 'siswa')
          .eq('person_id', savedId)
          .eq('status', 'aktif');
      }
      // Insert new RFID history record if RFID is set
      if (rfidValue) {
        await supabase.from('rfid_history').insert({
          person_type: 'siswa',
          person_id: savedId,
          no_rfid: rfidValue,
          status: 'aktif',
        });
      }
    }

    // Auto-create account when adding a new siswa with NISN
    if (!editing && savedId && form.nisn.trim()) {
      const nisn = form.nisn.trim();
      const username = editUsername.trim() || nisn;
      const email = `${username}@siswa.sch.id`;
      const password = newPassword || nisn;
      if (newPassword && newPassword !== newPasswordConfirm) {
        setError('Password dan konfirmasi password tidak sama');
        setSaving(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=create-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            email,
            password,
            full_name: form.nama_lengkap,
            roles: ['siswa'],
            link_table: 'siswa',
            link_id: savedId,
          }),
        });
      } catch { /* non-critical: account can be created later */ }
    }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('siswa').delete().eq('id', deleteTarget.id);
    if (err) { setError(err.message); return; }
    if (deleteTarget.foto_url) {
      await supabaseClient.storage.from('profile-photos').remove([deleteTarget.foto_url]);
    }
    fetchData();
  }

  async function showPresensiRiwayat(siswa: Siswa) {
    setPresensiRiwayatTarget(siswa);
    setLoadingPresensiRiwayat(true);
    const { data } = await supabase
      .from('presensi_siswa')
      .select('*, kelas:kelas_id(id, nama)')
      .eq('siswa_id', siswa.id)
      .order('tanggal', { ascending: false })
      .limit(30);
    setPresensiRiwayat((data ?? []) as PresensiSiswa[]);
    setLoadingPresensiRiwayat(false);
  }

  async function showRfidHistory(siswa: Siswa) {
    setRfidHistoryTarget(siswa);
    const { data } = await supabase
      .from('rfid_history')
      .select('*')
      .eq('person_type', 'siswa')
      .eq('person_id', siswa.id)
      .order('assigned_at', { ascending: false });
    setRfidHistory((data ?? []) as RfidHistory[]);
  }

  async function handleImportValidate(rows: Record<string, string>[]) {
    return validateSiswaRows(rows, kelasList, tpList);
  }

  async function handleImportExecute(validRows: Record<string, string>[], mode: ImportMode) {
    const result = await importSiswaRows(validRows, mode, kelasList, tpList);
    fetchData();
    return result;
  }

  function handleDownloadTemplate() {
    downloadTemplate(siswaImportColumns, 'Siswa', [
      'Isi data siswa pada sheet DATA_SISWA. Baris pertama (CONTOH) dapat dihapus.',
      'NIS dan NISN wajib diisi dan harus unik.',
      'Nama Lengkap wajib diisi.',
      'Jenis Kelamin: L untuk Laki-laki, P untuk Perempuan.',
      'Tanggal Lahir format: YYYY-MM-DD (contoh: 2008-01-15).',
      'Agama pilihan: Islam, Kristen, Katolik, Hindu, Buddha, Konghucu.',
      'Status Siswa: aktif, lulus, pindah, atau keluar.',
      'RFID: nomor kartu RFID jika tersedia. Harus unik untuk siswa aktif.',
      'Kelas: isi dengan nama kelas yang sudah terdaftar di master Kelas (contoh: X TKJ 1).',
      'Tahun Pelajaran: isi dengan nama tahun pelajaran yang sudah terdaftar (contoh: 2026/2027).',
      'Data orang tua/wali bersifat opsional. Isi yang relevan saja.',
      'Jangan masukkan password, user ID, token, atau field rahasia.',
      'Akun login dibuat otomatis: username = NISN, password awal = NISN.',
    ]);
  }

  function handleExport() {
    const exportRows = items.map((s) => ({
      'NIS': s.nis ?? '',
      'NISN': s.nisn ?? '',
      'NIK': s.nik ?? '',
      'Nama Lengkap': s.nama_lengkap,
      'Jenis Kelamin': s.jenis_kelamin ?? '',
      'Tempat Lahir': s.tempat_lahir ?? '',
      'Tanggal Lahir': s.tanggal_lahir ?? '',
      'Agama': s.agama ?? '',
      'Alamat': s.alamat ?? '',
      'No HP': s.no_hp ?? '',
      'Email': s.email ?? '',
      'Status Siswa': s.status,
      'RFID': s.no_rfid ?? '',
      'Nama Ayah': s.nama_ayah ?? '',
      'NIK Ayah': s.nik_ayah ?? '',
      'Tahun Lahir Ayah': s.tahun_lahir_ayah ?? '',
      'Pendidikan Ayah': s.pendidikan_ayah ?? '',
      'Pekerjaan Ayah': s.pekerjaan_ayah ?? '',
      'Penghasilan Ayah': s.penghasilan_ayah ?? '',
      'No HP/WA Ayah': s.no_hp_ayah ?? '',
      'Alamat Ayah': s.alamat_ayah ?? '',
      'Nama Ibu': s.nama_ibu ?? '',
      'NIK Ibu': s.nik_ibu ?? '',
      'Tahun Lahir Ibu': s.tahun_lahir_ibu ?? '',
      'Pendidikan Ibu': s.pendidikan_ibu ?? '',
      'Pekerjaan Ibu': s.pekerjaan_ibu ?? '',
      'Penghasilan Ibu': s.penghasilan_ibu ?? '',
      'No HP/WA Ibu': s.no_hp_ibu ?? '',
      'Alamat Ibu': s.alamat_ibu ?? '',
      'Nama Wali': s.nama_wali ?? '',
      'NIK Wali': s.nik_wali ?? '',
      'Hubungan Wali': s.hubungan_wali ?? '',
      'Pendidikan Wali': s.pendidikan_wali ?? '',
      'Pekerjaan Wali': s.pekerjaan_wali ?? '',
      'Penghasilan Wali': s.penghasilan_wali ?? '',
      'No HP/WA Wali': s.no_hp_wali ?? '',
      'Alamat Wali': s.alamat_wali ?? '',
    }));
    exportToExcel(exportRows, siswaImportColumns, 'Siswa');
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-700" />
              Data Siswa
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kelola data siswa beserta orang tua/wali</p>
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
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIS, NISN, NIK..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="rounded-lg border border-gray-300 bg-white pl-10 pr-8 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              <option value="all">Semua Kelas</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <select value={filterJurusan} onChange={(e) => setFilterJurusan(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Jurusan</option>
            {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.kode} — {j.nama}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Status</option>
            {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3 hidden sm:table-cell">NIS</th>
                  <th className="px-4 py-3 hidden md:table-cell">NISN</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Kelas</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Jurusan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada data siswa</td></tr>
                ) : (
                  filtered.map((item) => {
                    const stOpt = statusOptions.find((s) => s.value === item.status);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {getPhotoUrl('profile-photos', item.foto_url) ? (
                              <img src={getPhotoUrl('profile-photos', item.foto_url)!} alt={item.nama_lengkap} className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                {item.nama_lengkap.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-800">{item.nama_lengkap}</div>
                              <div className="text-xs text-gray-500">
                                {item.jenis_kelamin === 'L' ? 'Laki-laki' : item.jenis_kelamin === 'P' ? 'Perempuan' : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell font-mono">{item.nis ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-mono">{item.nisn ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{item.kelas?.nama ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">{item.jurusan?.kode ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={stOpt?.variant ?? 'neutral'}>{stOpt?.label ?? item.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => showPresensiRiwayat(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Riwayat Presensi">
                              <ClipboardList className="w-4 h-4" />
                            </button>
                            <button onClick={() => setQrTarget(item)} disabled={!getSiswaQrSource(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition disabled:opacity-30 disabled:cursor-not-allowed" title="QR Code">
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Data Siswa' : 'Tambah Data Siswa'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Data Pribadi */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <User className="w-4 h-4 text-emerald-600" /> Data Pribadi Siswa
            </h4>
            <div className="flex flex-col sm:flex-row gap-6 mb-4">
              <div className="flex-shrink-0">
                <PhotoUpload
                  bucket="profile-photos"
                  pathPrefix="siswa"
                  existingPath={editing?.foto_url ?? null}
                  onPathChange={setPhotoPath}
                />
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap *</label>
                <input type="text" required value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kelamin</label>
                <select value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">—</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIS</label>
                <input type="text" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NISN</label>
                <input type="text" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK</label>
                <input type="text" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Agama</label>
                <select value={form.agama} onChange={(e) => setForm({ ...form, agama: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">—</option>
                  {agamaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tempat Lahir</label>
                <input type="text" value={form.tempat_lahir} onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Lahir</label>
                <input type="date" value={form.tanggal_lahir} onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP</label>
                <input type="text" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
                <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              </div>
            </div>
          </div>

          {/* Section: Akademik */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <School className="w-4 h-4 text-emerald-600" /> Data Akademik
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kelas</label>
                <select value={form.kelas_id} onChange={(e) => setForm({ ...form, kelas_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">— Pilih —</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jurusan</label>
                <select value={form.jurusan_id} onChange={(e) => setForm({ ...form, jurusan_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">— Pilih —</option>
                  {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.kode} — {j.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Pelajaran</label>
                <select value={form.tahun_pelajaran_id} onChange={(e) => setForm({ ...form, tahun_pelajaran_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">— Pilih —</option>
                  {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama}{t.aktif ? ' (Aktif)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status Siswa</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Asal Sekolah</label>
                <input type="text" value={form.asal_sekolah} onChange={(e) => setForm({ ...form, asal_sekolah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Masuk</label>
                <input type="date" value={form.tanggal_masuk} onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
            </div>
          </div>

          {/* Section: Orang Tua / Wali */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <Users2 className="w-4 h-4 text-emerald-600" /> Data Orang Tua / Wali
            </h4>

            {/* Ayah */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data Ayah</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Ayah</label>
                <input type="text" value={form.nama_ayah} onChange={(e) => setForm({ ...form, nama_ayah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK Ayah</label>
                <input type="text" value={form.nik_ayah} onChange={(e) => setForm({ ...form, nik_ayah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Lahir Ayah</label>
                <input type="text" value={form.tahun_lahir_ayah} onChange={(e) => setForm({ ...form, tahun_lahir_ayah: e.target.value })} placeholder="Contoh: 1975" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pendidikan Ayah</label>
                <select value={form.pendidikan_ayah} onChange={(e) => setForm({ ...form, pendidikan_ayah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">—</option>
                  {pendidikanOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pekerjaan Ayah</label>
                <input type="text" value={form.pekerjaan_ayah} onChange={(e) => setForm({ ...form, pekerjaan_ayah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Penghasilan Ayah</label>
                <input type="text" value={form.penghasilan_ayah} onChange={(e) => setForm({ ...form, penghasilan_ayah: e.target.value })} placeholder="Contoh: 3.000.000/bulan" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP Ayah</label>
                <input type="text" value={form.no_hp_ayah} onChange={(e) => setForm({ ...form, no_hp_ayah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Ayah</label>
                <input type="text" value={form.alamat_ayah} onChange={(e) => setForm({ ...form, alamat_ayah: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
            </div>

            {/* Ibu */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data Ibu</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Ibu</label>
                <input type="text" value={form.nama_ibu} onChange={(e) => setForm({ ...form, nama_ibu: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK Ibu</label>
                <input type="text" value={form.nik_ibu} onChange={(e) => setForm({ ...form, nik_ibu: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Lahir Ibu</label>
                <input type="text" value={form.tahun_lahir_ibu} onChange={(e) => setForm({ ...form, tahun_lahir_ibu: e.target.value })} placeholder="Contoh: 1978" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pendidikan Ibu</label>
                <select value={form.pendidikan_ibu} onChange={(e) => setForm({ ...form, pendidikan_ibu: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">—</option>
                  {pendidikanOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pekerjaan Ibu</label>
                <input type="text" value={form.pekerjaan_ibu} onChange={(e) => setForm({ ...form, pekerjaan_ibu: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Penghasilan Ibu</label>
                <input type="text" value={form.penghasilan_ibu} onChange={(e) => setForm({ ...form, penghasilan_ibu: e.target.value })} placeholder="Contoh: 2.500.000/bulan" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP Ibu</label>
                <input type="text" value={form.no_hp_ibu} onChange={(e) => setForm({ ...form, no_hp_ibu: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Ibu</label>
                <input type="text" value={form.alamat_ibu} onChange={(e) => setForm({ ...form, alamat_ibu: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
            </div>

            {/* Wali */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Data Wali</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Wali</label>
                <input type="text" value={form.nama_wali} onChange={(e) => setForm({ ...form, nama_wali: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NIK Wali</label>
                <input type="text" value={form.nik_wali} onChange={(e) => setForm({ ...form, nik_wali: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hubungan Wali</label>
                <input type="text" value={form.hubungan_wali} onChange={(e) => setForm({ ...form, hubungan_wali: e.target.value })} placeholder="Contoh: Paman, Kakak, Kakek" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pendidikan Wali</label>
                <select value={form.pendidikan_wali} onChange={(e) => setForm({ ...form, pendidikan_wali: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                  <option value="">—</option>
                  {pendidikanOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pekerjaan Wali</label>
                <input type="text" value={form.pekerjaan_wali} onChange={(e) => setForm({ ...form, pekerjaan_wali: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Penghasilan Wali</label>
                <input type="text" value={form.penghasilan_wali} onChange={(e) => setForm({ ...form, penghasilan_wali: e.target.value })} placeholder="Contoh: 4.000.000/bulan" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP Wali</label>
                <input type="text" value={form.no_hp_wali} onChange={(e) => setForm({ ...form, no_hp_wali: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Wali</label>
                <input type="text" value={form.alamat_wali} onChange={(e) => setForm({ ...form, alamat_wali: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Orang Tua (umum)</label>
                <textarea value={form.alamat_ortu} onChange={(e) => setForm({ ...form, alamat_ortu: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
            </div>
          </div>

          {/* Section: Presensi (RFID & QR) */}
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Scan atau ketik nomor RFID. Jika diganti, RFID lama otomatis dinonaktifkan.
                </p>
              </div>
              <div className="flex items-center">
                {form.nisn ? (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 w-full">
                    <p className="text-xs text-emerald-700 font-medium">QR Code Presensi</p>
                    <p className="text-sm text-gray-600 mt-1">
                      QR dibuat otomatis dari <strong>NISN</strong>: <span className="font-mono text-emerald-700 font-semibold">{form.nisn}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">QR akan ditampilkan setelah data disimpan.</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 w-full">
                    <p className="text-sm text-gray-400">Isi NISN untuk membuat QR Code presensi otomatis.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Akun Login */}
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Akun Login
            </h4>
            {editing ? (
              editAccountInfo ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Username</label>
                      <div className="flex gap-2">
                        <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                        <button type="button" onClick={handleUpdateSiswaUsername} disabled={accountBusy}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                          Simpan
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">Username = email sebelum @. Format: username@siswa.sch.id</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Status Akun</label>
                      <div className="flex items-center gap-2">
                        {editAccountInfo.banned ? <Badge variant="error">Nonaktif</Badge> : <Badge variant="success">Aktif</Badge>}
                        <button type="button"
                          onClick={() => setBanConfirm({ userId: editAccountInfo.userId, ban: !editAccountInfo.banned })}
                          disabled={accountBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50">
                          {editAccountInfo.banned ? (<><CheckCircle2 className="w-3.5 h-3.5" /> Aktifkan</>) : (<><Ban className="w-3.5 h-3.5" /> Nonaktifkan</>)}
                        </button>
                      </div>
                    </div>
                  </div>
                  {editAccountInfo.lastLogin && (
                    <div>
                      <p className="text-xs text-gray-500">Terakhir Login</p>
                      <p className="text-sm text-gray-700">{new Date(editAccountInfo.lastLogin).toLocaleString('id-ID')}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setResetPassTarget(editAccountInfo.userId)}
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
                      <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)}
                        placeholder={form.nisn || 'Masukkan username'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Password *</label>
                      <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                        minLength={6} placeholder="Minimal 6 karakter" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Konfirmasi Password *</label>
                      <input type="password" value={editPasswordConfirm} onChange={(e) => setEditPasswordConfirm(e.target.value)}
                        minLength={6} placeholder="Ulangi password" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Password disimpan dalam bentuk hash. Email otomatis: username@siswa.sch.id</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleCreateSiswaAccount} disabled={accountBusy}
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
                  <button type="button" onClick={() => { setEditUsername(form.nisn); setShowCreateAccount(true); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition">
                    <UserPlus className="w-4 h-4" /> Buat Akun
                  </button>
                  <p className="text-sm text-gray-500">Siswa ini belum memiliki akun login.</p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Username (otomatis)</label>
                    <input type="text" value={editUsername || form.nisn} readOnly
                      placeholder="NISN" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono bg-gray-50 text-gray-500" />
                    <p className="mt-1 text-xs text-gray-400">Default = NISN</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Password *</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6} placeholder="Minimal 6 karakter" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Konfirmasi Password *</label>
                    <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      minLength={6} placeholder="Ulangi password" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Akun dibuat otomatis saat data disimpan. Password disimpan dalam bentuk hash.
                  {' '}Jika password dikosongkan, default = NISN.
                </p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Siswa aktif</span>
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
        open={!!resetPassTarget}
        title="Reset Password Siswa"
        message={`Password akan direset ke NISN siswa. Siswa perlu login ulang. Lanjutkan?`}
        onConfirm={() => resetPassTarget && handleResetSiswaPassword(resetPassTarget)}
        onClose={() => setResetPassTarget(null)}
        confirmLabel={accountBusy ? 'Memproses...' : 'Ya, Reset'}
      />

      <ConfirmDialog
        open={!!banConfirm}
        title={banConfirm?.ban ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
        message={banConfirm?.ban ? 'Akun akan dinonaktifkan. Siswa tidak dapat login. Lanjutkan?' : 'Akun akan diaktifkan kembali. Lanjutkan?'}
        onConfirm={handleToggleSiswaBan}
        onClose={() => setBanConfirm(null)}
        confirmLabel={accountBusy ? 'Memproses...' : 'Ya'}
        variant="warning"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus Data Siswa"
        message={`Yakin ingin menghapus "${deleteTarget?.nama_lengkap}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* QR Code Modal */}
      <Modal open={!!qrTarget} onClose={() => setQrTarget(null)} title="QR Code Presensi Siswa" size="sm">
        {qrTarget && (() => {
          const qr = getSiswaQrSource(qrTarget);
          if (!qr) return <p className="text-center text-sm text-gray-400 py-4">NISN belum diisi. Isi NISN untuk membuat QR Code.</p>;
          return (
            <div className="space-y-4">
              {getPhotoUrl('profile-photos', qrTarget.foto_url) && (
                <div className="flex justify-center">
                  <img src={getPhotoUrl('profile-photos', qrTarget.foto_url)!} alt={qrTarget.nama_lengkap} className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100 shadow-sm" />
                </div>
              )}
              <QRCodeDisplay
                value={qr.value}
                label={qrTarget.nama_lengkap}
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
              <span className="font-medium">{rfidHistoryTarget.nama_lengkap}</span>
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

      {/* Presensi Riwayat Modal */}
      <Modal open={!!presensiRiwayatTarget} onClose={() => setPresensiRiwayatTarget(null)} title="Riwayat Presensi Siswa" size="lg">
        {presensiRiwayatTarget && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-800">{presensiRiwayatTarget.nama_lengkap}</div>
            {loadingPresensiRiwayat ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : presensiRiwayat.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Belum ada riwayat presensi.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Masuk</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Pulang</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Metode</th>
                      <th className="px-3 py-2 hidden md:table-cell">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {presensiRiwayat.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(r.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{r.jam_masuk ? r.jam_masuk.substring(0, 5) : '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={PRESENSI_STATUS_VARIANTS[r.status_masuk]}>{PRESENSI_STATUS_LABELS[r.status_masuk]}</Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{r.jam_pulang ? r.jam_pulang.substring(0, 5) : '—'}</td>
                        <td className="px-3 py-2 hidden sm:table-cell text-gray-600">{r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '—'}</td>
                        <td className="px-3 py-2 hidden md:table-cell text-gray-500 max-w-[180px] truncate">{r.keterangan ?? '—'}</td>
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
        title="Import Data Siswa"
        columns={siswaImportColumns}
        sheetName="Siswa"
        onDownloadTemplate={handleDownloadTemplate}
        onValidate={handleImportValidate}
        onImport={handleImportExecute}
        onExport={handleExport}
      />
    </AppLayout>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { School, Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Kelas, Jurusan, TahunPelajaran, GuruTendik, Siswa, Ruangan, ShiftPresensi } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

interface FormData {
  nama: string;
  tingkat: string;
  jurusan_id: string;
  tahun_pelajaran_id: string;
  wali_kelas_id: string;
  ruangan_id: string;
  shift_presensi_id: string;
  kapasitas: string;
  aktif: boolean;
}

const emptyForm: FormData = { nama: '', tingkat: '', jurusan_id: '', tahun_pelajaran_id: '', wali_kelas_id: '', ruangan_id: '', shift_presensi_id: '', kapasitas: '', aktif: true };
const PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 8;

const tingkatOptions = [
  { value: '10', label: 'X (10)' },
  { value: '11', label: 'XI (11)' },
  { value: '12', label: 'XII (12)' },
];

export default function KelasPage() {
  const [items, setItems] = useState<Kelas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [guruList, setGuruList] = useState<GuruTendik[]>([]);
  const [ruanganList, setRuanganList] = useState<Ruangan[]>([]);
  const [shiftList, setShiftList] = useState<ShiftPresensi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTingkat, setFilterTingkat] = useState('all');
  const [filterJurusan, setFilterJurusan] = useState('all');
  const [filterTP, setFilterTP] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Kelas | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Kelas | null>(null);
  const [page, setPage] = useState(0);

  // Detail modal state
  const [detailTarget, setDetailTarget] = useState<Kelas | null>(null);
  const [detailSiswa, setDetailSiswa] = useState<Siswa[]>([]);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilterStatus, setDetailFilterStatus] = useState('all');
  const [detailPage, setDetailPage] = useState(0);

  async function fetchData() {
    setLoading(true);
    const [kelasRes, jurusanRes, tpRes, guruRes, ruanganRes, shiftRes] = await Promise.all([
      supabase.from('kelas').select('*, jurusan:jurusan_id(id, kode, nama), tahun_pelajaran:tahun_pelajaran_id(id, nama, semester), wali_kelas:wali_kelas_id(id, nama_lengkap, gelar_depan, gelar_belakang), ruangan_ref:ruangan_id(id, kode, nama, lokasi), shift_presensi:shift_presensi_id(id, nama, jam_masuk, jam_pulang)').order('nama'),
      supabase.from('jurusan').select('*').eq('aktif', true).order('kode'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
      supabase.from('guru_tendik').select('id, nama_lengkap, gelar_depan, gelar_belakang, jenis_ptk').eq('aktif', true).order('nama_lengkap'),
      supabase.from('ruangan').select('*').eq('aktif', true).order('kode'),
      supabase.from('shift_presensi').select('*').eq('aktif', true).order('nama'),
    ]);
    if (kelasRes.error) { setError(kelasRes.error.message); setLoading(false); return; }
    setItems((kelasRes.data ?? []) as unknown as Kelas[]);
    setJurusanList((jurusanRes.data ?? []) as Jurusan[]);
    setTpList((tpRes.data ?? []) as TahunPelajaran[]);
    setGuruList((guruRes.data ?? []) as GuruTendik[]);
    setRuanganList((ruanganRes.data ?? []) as Ruangan[]);
    setShiftList((shiftRes.data ?? []) as ShiftPresensi[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchSearch = i.nama.toLowerCase().includes(search.toLowerCase());
    const matchTingkat = filterTingkat === 'all' || i.tingkat?.toString() === filterTingkat;
    const matchJurusan = filterJurusan === 'all' || i.jurusan_id === filterJurusan;
    const matchTP = filterTP === 'all' || i.tahun_pelajaran_id === filterTP;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    return matchSearch && matchTingkat && matchJurusan && matchTP && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Detail student filtering
  const detailFiltered = detailSiswa.filter((s) => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(detailSearch.toLowerCase()) ||
      (s.nis ?? '').includes(detailSearch) || (s.nisn ?? '').includes(detailSearch);
    const matchStatus = detailFilterStatus === 'all' || s.status === detailFilterStatus;
    return matchSearch && matchStatus;
  });
  const detailTotalPages = Math.max(1, Math.ceil(detailFiltered.length / DETAIL_PAGE_SIZE));
  const detailCurrentPage = Math.min(detailPage, detailTotalPages - 1);
  const detailPaged = detailFiltered.slice(detailCurrentPage * DETAIL_PAGE_SIZE, (detailCurrentPage + 1) * DETAIL_PAGE_SIZE);

  function formatGuruName(g: { gelar_depan: string | null; nama_lengkap: string; gelar_belakang: string | null } | null | undefined) {
    if (!g) return '—';
    return [g.gelar_depan, g.nama_lengkap, g.gelar_belakang].filter(Boolean).join(' ');
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, tahun_pelajaran_id: tpList.find((t) => t.aktif)?.id ?? '' });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: Kelas) {
    setEditing(item);
    setForm({
      nama: item.nama,
      tingkat: item.tingkat?.toString() ?? '',
      jurusan_id: item.jurusan_id ?? '',
      tahun_pelajaran_id: item.tahun_pelajaran_id ?? '',
      wali_kelas_id: item.wali_kelas_id ?? '',
      ruangan_id: item.ruangan_id ?? '',
      shift_presensi_id: item.shift_presensi_id ?? '',
      kapasitas: item.kapasitas?.toString() ?? '',
      aktif: item.aktif,
    });
    setError(null);
    setModalOpen(true);
  }

  async function showDetail(item: Kelas) {
    setDetailTarget(item);
    setDetailSearch('');
    setDetailFilterStatus('all');
    setDetailPage(0);
    const { data } = await supabase
      .from('siswa')
      .select('id, nis, nisn, nama_lengkap, jenis_kelamin, status')
      .eq('kelas_id', item.id)
      .order('nama_lengkap');
    setDetailSiswa((data ?? []) as Siswa[]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      nama: form.nama,
      tingkat: form.tingkat ? parseInt(form.tingkat, 10) : null,
      jurusan_id: form.jurusan_id || null,
      tahun_pelajaran_id: form.tahun_pelajaran_id || null,
      wali_kelas_id: form.wali_kelas_id || null,
      ruangan_id: form.ruangan_id || null,
      shift_presensi_id: form.shift_presensi_id || null,
      kapasitas: form.kapasitas ? parseInt(form.kapasitas, 10) : null,
      aktif: form.aktif,
    };

    // Check duplicate (nama + tahun_pelajaran), excluding current record
    if (form.nama && form.tahun_pelajaran_id) {
      const excludeId = editing?.id ?? '00000000-0000-0000-0000-000000000000';
      const { data: dup } = await supabase
        .from('kelas')
        .select('id')
        .eq('nama', form.nama)
        .eq('tahun_pelajaran_id', form.tahun_pelajaran_id)
        .neq('id', excludeId)
        .maybeSingle();
      if (dup) {
        setError('Nama kelas + tahun pelajaran sudah digunakan oleh kelas lain.');
        setSaving(false);
        return;
      }
    }
    if (editing) {
      const { error: err } = await supabase.from('kelas').update(payload).eq('id', editing.id);
      if (err) {
        setError(err.code === '23505'
          ? 'Wali kelas ini sudah ditugaskan ke kelas aktif lain pada tahun pelajaran yang sama.'
          : err.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from('kelas').insert(payload);
      if (err) {
        setError(err.code === '23505'
          ? 'Wali kelas ini sudah ditugaskan ke kelas aktif lain pada tahun pelajaran yang sama.'
          : err.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('kelas').delete().eq('id', deleteTarget.id);
    if (err) { setError('Tidak dapat menghapus: kelas ini masih memiliki siswa atau riwayat.'); return; }
    fetchData();
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <School className="w-6 h-6 text-emerald-700" />
              Data Kelas
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kelola kelas-kelas sekolah</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari kelas..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterTingkat} onChange={(e) => { setFilterTingkat(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Tingkat</option>
            {tingkatOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterJurusan} onChange={(e) => { setFilterJurusan(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Jurusan</option>
            {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.kode}</option>)}
          </select>
          <select value={filterTP} onChange={(e) => { setFilterTP(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Th. Pel.</option>
            {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Nama Kelas</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Tingkat</th>
                  <th className="px-4 py-3 hidden md:table-cell">Jurusan</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Wali Kelas</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Th. Pel.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada data kelas</td></tr>
                ) : (
                  paged.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{item.nama}</div>
                        {item.ruangan_ref && <div className="text-xs text-gray-500">Ruangan: {item.ruangan_ref.kode} — {item.ruangan_ref.nama}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.tingkat ? tingkatOptions.find((t) => t.value === item.tingkat?.toString())?.label ?? item.tingkat : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{item.jurusan?.kode ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{formatGuruName(item.wali_kelas)}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.tahun_pelajaran?.nama ?? '—'}</td>
                      <td className="px-4 py-3">{item.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => showDetail(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Detail"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteTarget(item)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">Menampilkan {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} dari {filtered.length}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 py-1.5 text-sm text-gray-600">{currentPage + 1} / {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1} className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Kelas' : 'Tambah Kelas'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Kelas *</label>
            <input type="text" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: X TKJ 1" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tingkat</label>
              <select value={form.tingkat} onChange={(e) => setForm({ ...form, tingkat: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="">— Pilih —</option>
                {tingkatOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kapasitas</label>
              <input type="number" min={1} value={form.kapasitas} onChange={(e) => setForm({ ...form, kapasitas: e.target.value })} placeholder="Contoh: 36" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ruangan</label>
            <select value={form.ruangan_id} onChange={(e) => setForm({ ...form, ruangan_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              <option value="">— Pilih —</option>
              {ruanganList.map((r) => (
                <option key={r.id} value={r.id}>{r.kode} — {r.nama}{r.lokasi ? ` (${r.lokasi})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift Presensi</label>
            <select value={form.shift_presensi_id} onChange={(e) => setForm({ ...form, shift_presensi_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              <option value="">— Pilih —</option>
              {shiftList.map((s) => (
                <option key={s.id} value={s.id}>{s.nama} ({s.jam_masuk} - {s.jam_pulang})</option>
              ))}
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
              {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama} — {t.semester === 'ganjil' ? 'Ganjil' : 'Genap'}{t.aktif ? ' (Aktif)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Wali Kelas</label>
            <select value={form.wali_kelas_id} onChange={(e) => setForm({ ...form, wali_kelas_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              <option value="">— Pilih —</option>
              {guruList.filter((g) => g.jenis_ptk === 'guru').map((g) => (
                <option key={g.id} value={g.id}>{[g.gelar_depan, g.nama_lengkap, g.gelar_belakang].filter(Boolean).join(' ')}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Satu wali kelas hanya dapat ditugaskan ke satu kelas aktif per tahun pelajaran.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Kelas aktif</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)} title={`Detail Kelas: ${detailTarget?.nama}`} size="lg">
        {detailTarget && (
          <div className="space-y-4">
            {/* Class info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Tingkat</p>
                <p className="font-medium text-gray-800 mt-0.5">{tingkatOptions.find((t) => t.value === detailTarget.tingkat?.toString())?.label ?? detailTarget.tingkat ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Jurusan</p>
                <p className="font-medium text-gray-800 mt-0.5">{detailTarget.jurusan?.nama ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Tahun Pelajaran</p>
                <p className="font-medium text-gray-800 mt-0.5">{detailTarget.tahun_pelajaran?.nama ?? '—'} — {detailTarget.tahun_pelajaran?.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Wali Kelas</p>
                <p className="font-medium text-gray-800 mt-0.5">{formatGuruName(detailTarget.wali_kelas)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Ruangan</p>
                <p className="font-medium text-gray-800 mt-0.5">{detailTarget.ruangan_ref ? `${detailTarget.ruangan_ref.kode} — ${detailTarget.ruangan_ref.nama}` : '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Shift Presensi</p>
                <p className="font-medium text-gray-800 mt-0.5">{detailTarget.shift_presensi ? `${detailTarget.shift_presensi.nama} (${detailTarget.shift_presensi.jam_masuk} - ${detailTarget.shift_presensi.jam_pulang})` : '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">Kapasitas</p>
                <p className="font-medium text-gray-800 mt-0.5">{detailTarget.kapasitas ?? '—'}</p>
              </div>
            </div>

            {/* Student count summary */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Daftar Siswa</h4>
              <span className={`text-sm font-medium ${detailSiswa.length > 0 && detailTarget.kapasitas != null && detailSiswa.length > detailTarget.kapasitas ? 'text-red-600' : 'text-emerald-700'}`}>
                {detailSiswa.length} siswa{detailTarget.kapasitas ? ` / ${detailTarget.kapasitas} kapasitas` : ''}
              </span>
            </div>

            {/* Student search + filter */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={detailSearch} onChange={(e) => { setDetailSearch(e.target.value); setDetailPage(0); }} placeholder="Cari nama, NIS, NISN..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
              </div>
              <select value={detailFilterStatus} onChange={(e) => { setDetailFilterStatus(e.target.value); setDetailPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="lulus">Lulus</option>
                <option value="pindah">Pindah</option>
                <option value="keluar">Keluar</option>
              </select>
            </div>

            {/* Student table */}
            {detailFiltered.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">{detailSiswa.length === 0 ? 'Belum ada siswa di kelas ini.' : 'Tidak ada siswa yang cocok dengan pencarian.'}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-3 py-2 w-8">No</th>
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2 hidden sm:table-cell">NIS</th>
                        <th className="px-3 py-2 hidden md:table-cell">NISN</th>
                        <th className="px-3 py-2 hidden sm:table-cell">L/P</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailPaged.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition">
                          <td className="px-3 py-2 text-gray-400">{detailCurrentPage * DETAIL_PAGE_SIZE + idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{s.nama_lengkap}</td>
                          <td className="px-3 py-2 text-gray-600 hidden sm:table-cell font-mono">{s.nis ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 hidden md:table-cell font-mono">{s.nisn ?? '—'}</td>
                          <td className="px-3 py-2 hidden sm:table-cell">{s.jenis_kelamin === 'L' ? 'L' : s.jenis_kelamin === 'P' ? 'P' : '—'}</td>
                          <td className="px-3 py-2"><Badge variant={s.status === 'aktif' ? 'success' : 'neutral'}>{s.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detailTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">{detailCurrentPage * DETAIL_PAGE_SIZE + 1}–{Math.min((detailCurrentPage + 1) * DETAIL_PAGE_SIZE, detailFiltered.length)} dari {detailFiltered.length}</p>
                    <div className="flex gap-1">
                      <button onClick={() => setDetailPage(Math.max(0, detailCurrentPage - 1))} disabled={detailCurrentPage === 0} className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="px-2 py-1 text-xs text-gray-600">{detailCurrentPage + 1} / {detailTotalPages}</span>
                      <button onClick={() => setDetailPage(Math.min(detailTotalPages - 1, detailCurrentPage + 1))} disabled={detailCurrentPage >= detailTotalPages - 1} className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Kelas" message={`Yakin ingin menghapus kelas "${deleteTarget?.nama}"? Tindakan ini tidak dapat dibatalkan.`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

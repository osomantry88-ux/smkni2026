import { useEffect, useState, type FormEvent } from 'react';
import { History, Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SiswaKelasRiwayat, Siswa, TahunPelajaran, Kelas, Jurusan } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

interface FormData {
  siswa_id: string;
  tahun_pelajaran_id: string;
  semester: string;
  kelas_id: string;
  jurusan_id: string;
  status: string;
  catatan: string;
}

const emptyForm: FormData = {
  siswa_id: '', tahun_pelajaran_id: '', semester: 'ganjil', kelas_id: '', jurusan_id: '', status: 'aktif', catatan: '',
};

const statusOptions: { value: string; label: string; variant: 'success' | 'info' | 'warning' | 'error' | 'neutral' }[] = [
  { value: 'aktif', label: 'Aktif', variant: 'success' },
  { value: 'naik_kelas', label: 'Naik Kelas', variant: 'info' },
  { value: 'tinggal_kelas', label: 'Tinggal di Kelas', variant: 'warning' },
  { value: 'pindah_kelas', label: 'Pindah Kelas', variant: 'info' },
  { value: 'pindah_jurusan', label: 'Pindah Jurusan', variant: 'info' },
  { value: 'lulus', label: 'Lulus', variant: 'success' },
  { value: 'mutasi', label: 'Mutasi', variant: 'error' },
];

const PAGE_SIZE = 10;

export default function SiswaKelasRiwayatPage() {
  const [items, setItems] = useState<SiswaKelasRiwayat[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTp, setFilterTp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiswaKelasRiwayat | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiswaKelasRiwayat | null>(null);
  const [page, setPage] = useState(0);

  async function fetchData() {
    setLoading(true);
    const [riwayatRes, siswaRes, tpRes, kelasRes, jurusanRes] = await Promise.all([
      supabase.from('siswa_kelas_riwayat').select('*, siswa:siswa_id(id, nama_lengkap, nis, nisn), tahun_pelajaran:tahun_pelajaran_id(id, nama, semester), kelas:kelas_id(id, nama), jurusan:jurusan_id(id, kode, nama)').order('created_at', { ascending: false }),
      supabase.from('siswa').select('id, nama_lengkap, nis, nisn').order('nama_lengkap'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
      supabase.from('kelas').select('id, nama').eq('aktif', true).order('nama'),
      supabase.from('jurusan').select('id, kode, nama').eq('aktif', true).order('kode'),
    ]);
    if (riwayatRes.error) { setError(riwayatRes.error.message); setLoading(false); return; }
    setItems((riwayatRes.data ?? []) as unknown as SiswaKelasRiwayat[]);
    setSiswaList((siswaRes.data ?? []) as Siswa[]);
    setTpList((tpRes.data ?? []) as TahunPelajaran[]);
    setKelasList((kelasRes.data ?? []) as Kelas[]);
    setJurusanList((jurusanRes.data ?? []) as Jurusan[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchSearch = (i.siswa?.nama_lengkap ?? '').toLowerCase().includes(search.toLowerCase()) || (i.siswa?.nis ?? '').includes(search) || (i.siswa?.nisn ?? '').includes(search);
    const matchTp = filterTp === 'all' || i.tahun_pelajaran_id === filterTp;
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    return matchSearch && matchTp && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, tahun_pelajaran_id: tpList.find((t) => t.aktif)?.id ?? '' });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: SiswaKelasRiwayat) {
    setEditing(item);
    setForm({ siswa_id: item.siswa_id, tahun_pelajaran_id: item.tahun_pelajaran_id, semester: item.semester, kelas_id: item.kelas_id ?? '', jurusan_id: item.jurusan_id ?? '', status: item.status, catatan: item.catatan ?? '' });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      siswa_id: form.siswa_id,
      tahun_pelajaran_id: form.tahun_pelajaran_id,
      semester: form.semester,
      kelas_id: form.kelas_id || null,
      jurusan_id: form.jurusan_id || null,
      status: form.status,
      catatan: form.catatan || null,
    };
    if (editing) {
      const { error: err } = await supabase.from('siswa_kelas_riwayat').update(payload).eq('id', editing.id);
      if (err) { setError(err.code === '23505' ? 'Riwayat untuk siswa, tahun pelajaran, dan semester ini sudah ada.' : err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('siswa_kelas_riwayat').insert(payload);
      if (err) { setError(err.code === '23505' ? 'Riwayat untuk siswa, tahun pelajaran, dan semester ini sudah ada.' : err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('siswa_kelas_riwayat').delete().eq('id', deleteTarget.id);
    if (err) { setError(err.message); return; }
    fetchData();
  }

  function getStatusBadge(status: string) {
    const opt = statusOptions.find((s) => s.value === status);
    return <Badge variant={opt?.variant ?? 'neutral'}>{opt?.label ?? status}</Badge>;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <History className="w-6 h-6 text-emerald-700" />
              Riwayat Kelas Siswa
            </h1>
            <p className="mt-1 text-sm text-gray-500">Penempatan dan riwayat kelas siswa per tahun pelajaran</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari nama, NIS, NISN..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterTp} onChange={(e) => { setFilterTp(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Tahun Pelajaran</option>
            {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama} — {t.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Status</option>
            {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Siswa</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Th. Pelajaran</th>
                  <th className="px-4 py-3 hidden md:table-cell">Kelas</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Jurusan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada riwayat penempatan siswa</td></tr>
                ) : (
                  paged.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{item.siswa?.nama_lengkap ?? '—'}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.siswa?.nis ?? item.siswa?.nisn ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {item.tahun_pelajaran?.nama ?? '—'} — {item.semester === 'ganjil' ? 'Ganjil' : 'Genap'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{item.kelas?.nama ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{item.jurusan?.kode ?? '—'}</td>
                      <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Riwayat Kelas' : 'Tambah Riwayat Kelas'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Siswa *</label>
            <select required value={form.siswa_id} onChange={(e) => setForm({ ...form, siswa_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              <option value="">— Pilih Siswa —</option>
              {siswaList.map((s) => <option key={s.id} value={s.id}>{s.nama_lengkap} ({s.nis ?? s.nisn ?? '—'})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Pelajaran *</label>
              <select required value={form.tahun_pelajaran_id} onChange={(e) => setForm({ ...form, tahun_pelajaran_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="">— Pilih —</option>
                {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama} — {t.semester === 'ganjil' ? 'Ganjil' : 'Genap'}{t.aktif ? ' (Aktif)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester *</label>
              <select required value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="ganjil">Ganjil</option>
                <option value="genap">Genap</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status *</label>
            <select required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
              {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} rows={2} placeholder="Catatan tambahan (opsional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Riwayat Kelas" message={`Yakin ingin menghapus riwayat ini? Tindakan ini tidak dapat dibatalkan.`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

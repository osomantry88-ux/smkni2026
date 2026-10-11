import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, Search, Filter, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TahunPelajaran } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

interface FormData {
  nama: string;
  semester: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  aktif: boolean;
}

const emptyForm: FormData = { nama: '', semester: 'ganjil', tanggal_mulai: '', tanggal_selesai: '', aktif: false };
const PAGE_SIZE = 10;

export default function TahunPelajaranPage() {
  const [items, setItems] = useState<TahunPelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSemester, setFilterSemester] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TahunPelajaran | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TahunPelajaran | null>(null);
  const [page, setPage] = useState(0);

  async function fetchData() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('tahun_pelajaran')
      .select('*')
      .order('nama', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setItems((data ?? []) as TahunPelajaran[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchSearch = i.nama.toLowerCase().includes(search.toLowerCase());
    const matchSemester = filterSemester === 'all' || i.semester === filterSemester;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    return matchSearch && matchSemester && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: TahunPelajaran) {
    setEditing(item);
    setForm({
      nama: item.nama,
      semester: item.semester,
      tanggal_mulai: item.tanggal_mulai ?? '',
      tanggal_selesai: item.tanggal_selesai ?? '',
      aktif: item.aktif,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (form.aktif) {
      await supabase.from('tahun_pelajaran').update({ aktif: false }).neq('id', editing?.id ?? '00000000-0000-0000-0000-000000000000');
    }

    const payload = {
      nama: form.nama,
      semester: form.semester,
      tanggal_mulai: form.tanggal_mulai || null,
      tanggal_selesai: form.tanggal_selesai || null,
      aktif: form.aktif,
    };

    if (editing) {
      const { error: err } = await supabase.from('tahun_pelajaran').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('tahun_pelajaran').insert(payload);
      if (err) {
        setError(err.code === '23505'
          ? 'Tahun pelajaran dengan semester ini sudah ada.'
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
    const { error: err } = await supabase.from('tahun_pelajaran').delete().eq('id', deleteTarget.id);
    if (err) {
      setError('Tidak dapat menghapus: data ini masih digunakan oleh kelas atau riwayat siswa.');
      return;
    }
    fetchData();
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-emerald-700" />
              Tahun Pelajaran
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kelola tahun ajaran dan semester sekolah</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari tahun pelajaran..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterSemester} onChange={(e) => { setFilterSemester(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Semester</option>
            <option value="ganjil">Ganjil</option>
            <option value="genap">Genap</option>
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
                  <th className="px-4 py-3">Tahun Pelajaran</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Mulai</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Selesai</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada data tahun pelajaran</td></tr>
                ) : (
                  paged.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.nama}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.semester === 'ganjil' ? 'info' : 'warning'}>
                          {item.semester === 'ganjil' ? 'Ganjil' : 'Genap'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.tanggal_mulai ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.tanggal_selesai ?? '—'}</td>
                      <td className="px-4 py-3">
                        {item.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">Menampilkan {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} dari {filtered.length}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">{currentPage + 1} / {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1} className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">Hanya boleh ada satu Tahun Pelajaran + Semester yang aktif. Mengaktifkan satu akan menonaktifkan yang lain.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Tahun Pelajaran' : 'Tambah Tahun Pelajaran'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Tahun Pelajaran *</label>
              <input type="text" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: 2026/2027" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Mulai</label>
              <input type="date" value={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Selesai</label>
              <input type="date" value={form.tanggal_selesai} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Jadikan tahun pelajaran aktif</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus Tahun Pelajaran"
        message={`Yakin ingin menghapus "${deleteTarget?.nama} - ${deleteTarget?.semester === 'ganjil' ? 'Ganjil' : 'Genap'}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </AppLayout>
  );
}

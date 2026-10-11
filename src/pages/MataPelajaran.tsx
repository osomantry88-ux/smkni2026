import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MataPelajaran, Jurusan } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

interface FormData {
  kode: string;
  nama: string;
  kelompok: string;
  tingkat: string;
  jurusan_id: string;
  deskripsi: string;
  kkm: string;
  aktif: boolean;
}

const emptyForm: FormData = { kode: '', nama: '', kelompok: '', tingkat: '', jurusan_id: '', deskripsi: '', kkm: '', aktif: true };
const PAGE_SIZE = 10;

const kelompokOptions = [
  { value: 'A', label: 'A — Wajib' },
  { value: 'B', label: 'B — Peminatan' },
  { value: 'C', label: 'C — Produktif' },
];

const tingkatOptions = [
  { value: '10', label: 'Kelas 10' },
  { value: '11', label: 'Kelas 11' },
  { value: '12', label: 'Kelas 12' },
];

export default function MataPelajaranPage() {
  const [items, setItems] = useState<(MataPelajaran & { jurusan?: Jurusan | null })[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('all');
  const [filterTingkat, setFilterTingkat] = useState('all');
  const [filterJurusan, setFilterJurusan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MataPelajaran | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MataPelajaran | null>(null);
  const [page, setPage] = useState(0);

  async function fetchData() {
    setLoading(true);
    const [mapelRes, jurusanRes] = await Promise.all([
      supabase.from('mata_pelajaran').select('*, jurusan:jurusan_id(id, kode, nama)').order('kode'),
      supabase.from('jurusan').select('*').order('kode'),
    ]);
    if (mapelRes.error) { setError(mapelRes.error.message); setLoading(false); return; }
    setItems((mapelRes.data ?? []) as unknown as (MataPelajaran & { jurusan?: Jurusan | null })[]);
    setJurusanList((jurusanRes.data ?? []) as Jurusan[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchSearch = i.nama.toLowerCase().includes(search.toLowerCase()) || i.kode.toLowerCase().includes(search.toLowerCase());
    const matchKelompok = filterKelompok === 'all' || i.kelompok === filterKelompok;
    const matchTingkat = filterTingkat === 'all' || i.tingkat?.toString() === filterTingkat;
    const matchJurusan = filterJurusan === 'all' || i.jurusan_id === filterJurusan;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    return matchSearch && matchKelompok && matchTingkat && matchJurusan && matchStatus;
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

  function openEdit(item: MataPelajaran & { jurusan?: Jurusan | null }) {
    setEditing(item);
    setForm({
      kode: item.kode,
      nama: item.nama,
      kelompok: item.kelompok ?? '',
      tingkat: item.tingkat?.toString() ?? '',
      jurusan_id: item.jurusan_id ?? '',
      deskripsi: item.deskripsi ?? '',
      kkm: item.kkm?.toString() ?? '',
      aktif: item.aktif,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const tingkatVal = form.tingkat ? parseInt(form.tingkat, 10) : null;
    const jurusanVal = form.jurusan_id || null;

    // Check duplicate (kode + tingkat + jurusan), excluding current record
    const excludeId = editing?.id ?? '00000000-0000-0000-0000-000000000000';
    let dupQuery = supabase.from('mata_pelajaran').select('id').eq('kode', form.kode).neq('id', excludeId);
    if (tingkatVal !== null) dupQuery = dupQuery.eq('tingkat', tingkatVal); else dupQuery = dupQuery.is('tingkat', null);
    if (jurusanVal) dupQuery = dupQuery.eq('jurusan_id', jurusanVal); else dupQuery = dupQuery.is('jurusan_id', null);
    const { data: dupData } = await dupQuery.maybeSingle();
    if (dupData) {
      setError('Kombinasi kode + tingkat + jurusan sudah digunakan oleh mata pelajaran lain.');
      setSaving(false);
      return;
    }

    const payload = {
      kode: form.kode,
      nama: form.nama,
      kelompok: form.kelompok || null,
      tingkat: tingkatVal,
      jurusan_id: jurusanVal,
      deskripsi: form.deskripsi || null,
      kkm: form.kkm ? parseInt(form.kkm, 10) : null,
      aktif: form.aktif,
    };
    if (editing) {
      const { error: err } = await supabase.from('mata_pelajaran').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('mata_pelajaran').insert(payload);
      if (err) { setError(err.code === '23505' ? 'Kode mata pelajaran sudah ada.' : err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('mata_pelajaran').delete().eq('id', deleteTarget.id);
    if (err) { setError('Tidak dapat menghapus: mata pelajaran ini masih digunakan di data lain.'); return; }
    fetchData();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition";

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-700" />
              Mata Pelajaran
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kelola daftar mata pelajaran sekolah</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari mata pelajaran..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterKelompok} onChange={(e) => { setFilterKelompok(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Kelompok</option>
            {kelompokOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={filterTingkat} onChange={(e) => { setFilterTingkat(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Tingkat</option>
            {tingkatOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={filterJurusan} onChange={(e) => { setFilterJurusan(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Jurusan</option>
            {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.kode} — {j.nama}</option>)}
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
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Kelompok</th>
                  <th className="px-4 py-3 hidden md:table-cell">Tingkat</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Jurusan</th>
                  <th className="px-4 py-3 hidden sm:table-cell">KKM</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada data mata pelajaran</td></tr>
                ) : (
                  paged.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{item.kode}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{item.nama}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.kelompok ? <Badge variant="info">{item.kelompok}</Badge> : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{item.tingkat ? tingkatOptions.find((t) => t.value === item.tingkat?.toString())?.label ?? `Kls ${item.tingkat}` : 'Semua'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{item.jurusan?.kode ?? 'Semua'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.kkm ?? '—'}</td>
                      <td className="px-4 py-3">{item.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Mata Pelajaran *</label>
            <input type="text" required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })} placeholder="Contoh: MAT-10" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Mata Pelajaran *</label>
            <input type="text" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Matematika" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kelompok</label>
              <select value={form.kelompok} onChange={(e) => setForm({ ...form, kelompok: e.target.value })} className={inputCls}>
                <option value="">— Pilih —</option>
                {kelompokOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tingkat</label>
              <select value={form.tingkat} onChange={(e) => setForm({ ...form, tingkat: e.target.value })} className={inputCls}>
                <option value="">— Semua Tingkat —</option>
                {tingkatOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jurusan / Konsentrasi Keahlian</label>
              <select value={form.jurusan_id} onChange={(e) => setForm({ ...form, jurusan_id: e.target.value })} className={inputCls}>
                <option value="">— Semua Jurusan —</option>
                {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.kode} — {j.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">KKM</label>
              <input type="number" min={0} max={100} value={form.kkm} onChange={(e) => setForm({ ...form, kkm: e.target.value })} placeholder="Contoh: 70" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi</label>
            <textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} rows={2} placeholder="Deskripsi singkat" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Mata pelajaran aktif</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Mata Pelajaran" message={`Yakin ingin menghapus "${deleteTarget?.nama}"? Tindakan ini tidak dapat dibatalkan.`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

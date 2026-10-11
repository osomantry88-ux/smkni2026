import { useEffect, useState, type FormEvent } from 'react';
import { Clock, Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { JamPelajaran, Kelas, TahunPelajaran, HariSeminggu } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

const allDays: HariSeminggu[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

interface FormData {
  kode: string;
  nama: string;
  jam_mulai: string;
  jam_selesai: string;
  urutan: number;
  tahun_pelajaran_id: string;
  kelas_id: string;
  hari: string;
  catatan: string;
  aktif: boolean;
}

const emptyForm: FormData = {
  kode: '', nama: '', jam_mulai: '07:00', jam_selesai: '07:45', urutan: 1,
  tahun_pelajaran_id: '', kelas_id: '', hari: 'Senin', catatan: '', aktif: true,
};
const PAGE_SIZE = 10;

export default function JamPelajaranPage() {
  const [items, setItems] = useState<(JamPelajaran & { kelas?: Kelas | null; tahun_pelajaran?: TahunPelajaran | null })[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTP, setFilterTP] = useState('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterHari, setFilterHari] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JamPelajaran | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JamPelajaran | null>(null);
  const [page, setPage] = useState(0);

  async function fetchData() {
    setLoading(true);
    const [jamRes, kelasRes, tpRes] = await Promise.all([
      supabase.from('jam_pelajaran').select('*, kelas:kelas_id(id, nama, tingkat, jurusan_id), tahun_pelajaran:tahun_pelajaran_id(id, nama)').order('hari').order('urutan'),
      supabase.from('kelas').select('*').eq('aktif', true).order('nama'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
    ]);
    if (jamRes.error) { setError(jamRes.error.message); setLoading(false); return; }
    setItems((jamRes.data ?? []) as unknown as (JamPelajaran & { kelas?: Kelas | null; tahun_pelajaran?: TahunPelajaran | null })[]);
    setKelasList((kelasRes.data ?? []) as Kelas[]);
    setTpList((tpRes.data ?? []) as TahunPelajaran[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchSearch = i.nama.toLowerCase().includes(search.toLowerCase()) || i.kode.toLowerCase().includes(search.toLowerCase());
    const matchTP = filterTP === 'all' || i.tahun_pelajaran_id === filterTP;
    const matchKelas = filterKelas === 'all' || i.kelas_id === filterKelas;
    const matchHari = filterHari === 'all' || i.hari === filterHari;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    return matchSearch && matchTP && matchKelas && matchHari && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    const aktifTP = tpList.find((t) => t.aktif);
    setForm({ ...emptyForm, tahun_pelajaran_id: aktifTP?.id ?? '' });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: JamPelajaran & { kelas?: Kelas | null; tahun_pelajaran?: TahunPelajaran | null }) {
    setEditing(item);
    setForm({
      kode: item.kode,
      nama: item.nama,
      jam_mulai: item.jam_mulai,
      jam_selesai: item.jam_selesai,
      urutan: item.urutan,
      tahun_pelajaran_id: item.tahun_pelajaran_id ?? '',
      kelas_id: item.kelas_id ?? '',
      hari: item.hari ?? 'Senin',
      catatan: item.catatan ?? '',
      aktif: item.aktif,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (form.jam_mulai >= form.jam_selesai) {
      setError('Jam selesai harus lebih besar dari jam mulai.');
      setSaving(false);
      return;
    }

    if (!form.kelas_id) {
      setError('Kelas wajib dipilih.');
      setSaving(false);
      return;
    }

    // Check overlap for same kelas + hari
    const excludeId = editing?.id ?? '00000000-0000-0000-0000-000000000000';
    const { data: existing } = await supabase
      .from('jam_pelajaran')
      .select('id, jam_mulai, jam_selesai, nama, urutan')
      .eq('kelas_id', form.kelas_id)
      .eq('hari', form.hari)
      .neq('id', excludeId);

    if (existing) {
      for (const e of existing) {
        if (form.jam_mulai < e.jam_selesai && form.jam_selesai > e.jam_mulai) {
          setError(`Waktu bertabrakan dengan "${e.nama}" (${e.jam_mulai}-${e.jam_selesai}) pada ${form.hari} yang sama.`);
          setSaving(false);
          return;
        }
      }
    }

    // Check duplicate urutan for same kelas + hari
    if (existing) {
      const dupUrutan = existing.find((e) => e.urutan === form.urutan);
      if (dupUrutan) {
        setError(`Urutan ${form.urutan} sudah digunakan oleh "${dupUrutan.nama}" pada ${form.hari} yang sama.`);
        setSaving(false);
        return;
      }
    }

    const payload = {
      kode: form.kode,
      nama: form.nama,
      jam_mulai: form.jam_mulai,
      jam_selesai: form.jam_selesai,
      urutan: form.urutan,
      tahun_pelajaran_id: form.tahun_pelajaran_id || null,
      kelas_id: form.kelas_id || null,
      hari: form.hari,
      catatan: form.catatan || null,
      aktif: form.aktif,
    };

    if (editing) {
      const { error: err } = await supabase.from('jam_pelajaran').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('jam_pelajaran').insert(payload);
      if (err) { setError(err.code === '23505' ? 'Urutan ini sudah ada untuk kelas dan hari yang sama.' : err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('jam_pelajaran').delete().eq('id', deleteTarget.id);
    if (err) { setError('Tidak dapat menghapus: jam pelajaran ini masih digunakan jadwal mengajar.'); return; }
    fetchData();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition";

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-emerald-700" />
              Jam Pelajaran
            </h1>
            <p className="mt-1 text-sm text-gray-500">Master slot waktu per kelas dan hari</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari kode atau nama..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterTP} onChange={(e) => { setFilterTP(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Th. Pel.</option>
            {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
          <select value={filterKelas} onChange={(e) => { setFilterKelas(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Kelas</option>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <select value={filterHari} onChange={(e) => { setFilterHari(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Hari</option>
            {allDays.map((d) => <option key={d} value={d}>{d}</option>)}
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
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Hari</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Kode</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3 hidden md:table-cell">Waktu</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada data jam pelajaran</td></tr>
                ) : (
                  paged.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.kelas?.nama ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{item.hari ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{item.urutan}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700 hidden sm:table-cell">{item.kode}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{item.nama}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-mono">{item.jam_mulai} - {item.jam_selesai}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Jam Pelajaran' : 'Tambah Jam Pelajaran'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Pelajaran</label>
              <select value={form.tahun_pelajaran_id} onChange={(e) => setForm({ ...form, tahun_pelajaran_id: e.target.value })} className={inputCls}>
                <option value="">— Pilih —</option>
                {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama} — {t.semester === 'ganjil' ? 'Ganjil' : 'Genap'}{t.aktif ? ' (Aktif)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kelas *</label>
              <select required value={form.kelas_id} onChange={(e) => setForm({ ...form, kelas_id: e.target.value })} className={inputCls}>
                <option value="">— Pilih —</option>
                {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Hari *</label>
              <select required value={form.hari} onChange={(e) => setForm({ ...form, hari: e.target.value })} className={inputCls}>
                {allDays.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Urutan/Periode *</label>
              <input type="number" min={1} required value={form.urutan} onChange={(e) => setForm({ ...form, urutan: parseInt(e.target.value) || 1 })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode *</label>
              <input type="text" required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })} placeholder="Contoh: JP-01" className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Label Jam *</label>
            <input type="text" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Pelajaran 1" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Mulai *</label>
              <input type="time" required value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Selesai *</label>
              <input type="time" required value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} rows={2} placeholder="Catatan opsional" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Aktif</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Jam Pelajaran" message={`Yakin ingin menghapus "${deleteTarget?.nama}"?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

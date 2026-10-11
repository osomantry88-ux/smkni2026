import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, Search, Grid3x3, List, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { KalenderPendidikan, TahunPelajaran, JenisKalender } from '@/types/database';
import { JENIS_KALENDER_LABELS, JENIS_KALENDER_COLORS } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

interface FormData {
  tahun_pelajaran_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jenis: JenisKalender;
  nama_kegiatan: string;
  keterangan: string;
  hari_efektif: boolean;
  presensi_diperbolehkan: boolean;
  aktif: boolean;
}

const emptyForm: FormData = {
  tahun_pelajaran_id: '', tanggal_mulai: '', tanggal_selesai: '', jenis: 'hari_efektif',
  nama_kegiatan: '', keterangan: '', hari_efektif: true, presensi_diperbolehkan: true, aktif: true,
};

const jenisOptions = Object.entries(JENIS_KALENDER_LABELS).map(([value, label]) => ({ value: value as JenisKalender, label }));

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function KalenderPendidikanPage() {
  const [items, setItems] = useState<KalenderPendidikan[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filterTP, setFilterTP] = useState('all');
  const [filterJenis, setFilterJenis] = useState('all');
  const [filterEfektif, setFilterEfektif] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KalenderPendidikan | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KalenderPendidikan | null>(null);

  async function fetchData() {
    setLoading(true);
    const [kalRes, tpRes] = await Promise.all([
      supabase.from('kalender_pendidikan').select('*, tahun_pelajaran:tahun_pelajaran_id(id, nama, semester)').order('tanggal_mulai'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
    ]);
    if (kalRes.error) { setError(kalRes.error.message); setLoading(false); return; }
    setItems((kalRes.data ?? []) as unknown as KalenderPendidikan[]);
    setTpList((tpRes.data ?? []) as TahunPelajaran[]);
    if (tpRes.data && tpRes.data.length > 0) {
      const aktif = (tpRes.data as TahunPelajaran[]).find((t) => t.aktif);
      if (aktif) setFilterTP(aktif.id);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchTP = filterTP === 'all' || i.tahun_pelajaran_id === filterTP;
    const matchJenis = filterJenis === 'all' || i.jenis === filterJenis;
    const matchEfektif = filterEfektif === 'all' || (filterEfektif === 'efektif' && i.hari_efektif) || (filterEfektif === 'tidak' && !i.hari_efektif);
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    const matchSearch = i.nama_kegiatan.toLowerCase().includes(search.toLowerCase()) || (i.keterangan ?? '').toLowerCase().includes(search.toLowerCase());
    return matchTP && matchJenis && matchEfektif && matchStatus && matchSearch;
  });

  function getEventsForDate(dateStr: string): KalenderPendidikan[] {
    return filtered.filter((i) => {
      const start = i.tanggal_mulai;
      const end = i.tanggal_selesai;
      return dateStr >= start && dateStr <= end;
    });
  }

  function buildCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const weeks: (string | null)[][] = [];
    let week: (string | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) week.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      week.push(dateStr);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  }

  function openCreate() {
    setEditing(null);
    const aktifTP = tpList.find((t) => t.aktif);
    setForm({ ...emptyForm, tahun_pelajaran_id: aktifTP?.id ?? '' });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: KalenderPendidikan) {
    setEditing(item);
    setForm({
      tahun_pelajaran_id: item.tahun_pelajaran_id,
      tanggal_mulai: item.tanggal_mulai,
      tanggal_selesai: item.tanggal_selesai,
      jenis: item.jenis,
      nama_kegiatan: item.nama_kegiatan,
      keterangan: item.keterangan ?? '',
      hari_efektif: item.hari_efektif,
      presensi_diperbolehkan: item.presensi_diperbolehkan,
      aktif: item.aktif,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (form.tanggal_selesai < form.tanggal_mulai) {
      setError('Tanggal selesai harus setelah tanggal mulai');
      setSaving(false);
      return;
    }
    const payload = {
      tahun_pelajaran_id: form.tahun_pelajaran_id,
      tanggal_mulai: form.tanggal_mulai,
      tanggal_selesai: form.tanggal_selesai,
      jenis: form.jenis,
      nama_kegiatan: form.nama_kegiatan,
      keterangan: form.keterangan || null,
      hari_efektif: form.hari_efektif,
      presensi_diperbolehkan: form.presensi_diperbolehkan,
      aktif: form.aktif,
    };
    if (editing) {
      const { error: err } = await supabase.from('kalender_pendidikan').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('kalender_pendidikan').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('kalender_pendidikan').delete().eq('id', deleteTarget.id);
    if (err) { setError(err.message); return; }
    fetchData();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition";
  const calendarWeeks = buildCalendar();

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-emerald-700" />
              Kalender Pendidikan
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kalender sekolah: hari efektif, libur, ujian, kegiatan</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button onClick={() => setView('calendar')} className={`px-3 py-2 text-sm font-medium transition ${view === 'calendar' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><Grid3x3 className="w-4 h-4" /></button>
              <button onClick={() => setView('list')} className={`px-3 py-2 text-sm font-medium transition ${view === 'list' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
            </div>
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kegiatan..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterTP} onChange={(e) => setFilterTP(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Tahun</option>
            {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
          <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Jenis</option>
            {jenisOptions.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
          </select>
          <select value={filterEfektif} onChange={(e) => setFilterEfektif(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Hari</option>
            <option value="efektif">Hari Efektif</option>
            <option value="tidak">Tidak Efektif</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <button onClick={prevMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">←</button>
              <h3 className="text-lg font-semibold text-gray-800">{monthNames[currentMonth]} {currentYear}</h3>
              <button onClick={nextMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">→</button>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
              {dayNames.map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-500">{d}</div>)}
            </div>
            <div>
              {calendarWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
                  {week.map((dateStr, di) => {
                    if (!dateStr) return <div key={di} className="min-h-[100px] bg-gray-50/50" />;
                    const dayNum = parseInt(dateStr.split('-')[2]);
                    const events = getEventsForDate(dateStr);
                    return (
                      <div key={di} className="min-h-[100px] border-r border-gray-100 last:border-0 p-1.5 overflow-hidden">
                        <p className="text-xs font-medium text-gray-600 mb-1">{dayNum}</p>
                        <div className="space-y-1">
                          {events.slice(0, 3).map((ev) => (
                            <div key={ev.id} className={`rounded px-1.5 py-0.5 text-[10px] font-medium border cursor-pointer hover:opacity-80 transition ${JENIS_KALENDER_COLORS[ev.jenis]}`} onClick={() => openEdit(ev)} title={ev.nama_kegiatan}>
                              <span className="truncate block">{ev.nama_kegiatan}</span>
                            </div>
                          ))}
                          {events.length > 3 && <p className="text-[10px] text-gray-400">+{events.length - 3} lainnya</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Kegiatan</th>
                    <th className="px-4 py-3 hidden md:table-cell">Hari Efektif</th>
                    <th className="px-4 py-3 hidden md:table-cell">Presensi</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Belum ada data kalender</td></tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {formatDate(item.tanggal_mulai)}{item.tanggal_selesai !== item.tanggal_mulai && ` — ${formatDate(item.tanggal_selesai)}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${JENIS_KALENDER_COLORS[item.jenis]}`}>
                            {JENIS_KALENDER_LABELS[item.jenis]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{item.nama_kegiatan}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {item.hari_efektif ? <Badge variant="success">Efektif</Badge> : <Badge variant="error">Tidak</Badge>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {item.presensi_diperbolehkan ? <Badge variant="info">Ya</Badge> : <Badge variant="neutral">Tidak</Badge>}
                        </td>
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
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Kalender Pendidikan' : 'Tambah Kalender Pendidikan'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Pelajaran *</label>
            <select required value={form.tahun_pelajaran_id} onChange={(e) => setForm({ ...form, tahun_pelajaran_id: e.target.value })} className={inputCls}>
              <option value="">— Pilih —</option>
              {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama} ({t.semester})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Mulai *</label>
              <input type="date" required value={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Selesai *</label>
              <input type="date" required value={form.tanggal_selesai} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis *</label>
              <select required value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisKalender })} className={inputCls}>
                {jenisOptions.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Kegiatan *</label>
              <input type="text" required value={form.nama_kegiatan} onChange={(e) => setForm({ ...form, nama_kegiatan: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Keterangan</label>
            <textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hari_efektif} onChange={(e) => setForm({ ...form, hari_efektif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
              <span className="text-sm text-gray-700">Hari Efektif</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.presensi_diperbolehkan} onChange={(e) => setForm({ ...form, presensi_diperbolehkan: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
              <span className="text-sm text-gray-700">Presensi Diperbolehkan</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
              <span className="text-sm text-gray-700">Aktif</span>
            </label>
          </div>
          <p className="text-xs text-gray-400">Jika hari tidak efektif / libur, sistem tidak akan menganggap siswa/guru Alfa pada tanggal tersebut.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Kalender" message={`Yakin ingin menghapus "${deleteTarget?.nama_kegiatan}"?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

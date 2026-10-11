import { useEffect, useState, type FormEvent } from 'react';
import { Clock, Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Calendar, Users, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ShiftPresensi, ShiftPresensiDetail } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

interface DaySchedule {
  aktif: boolean;
  jam_masuk: string;
  batas_terlambat: string;
  jam_pulang: string;
}

interface FormData {
  kode: string;
  nama: string;
  berlaku_untuk: 'siswa' | 'tendik' | 'keduanya';
  keterangan: string;
  aktif: boolean;
  days: Record<string, DaySchedule>;
}

const allDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function emptyDaySchedule(aktif = true): DaySchedule {
  return { aktif, jam_masuk: '06:00', batas_terlambat: '07:15', jam_pulang: '15:00' };
}

function emptyFormData(): FormData {
  const days: Record<string, DaySchedule> = {};
  for (const d of allDays) {
    days[d] = d === 'Sabtu' || d === 'Minggu' ? emptyDaySchedule(false) : emptyDaySchedule(true);
  }
  return { kode: '', nama: '', berlaku_untuk: 'keduanya', keterangan: '', aktif: true, days };
}

const PAGE_SIZE = 10;

export default function ShiftPresensiPage() {
  const [items, setItems] = useState<(ShiftPresensi & { detail: ShiftPresensiDetail[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<(ShiftPresensi & { detail: ShiftPresensiDetail[] }) | null>(null);
  const [form, setForm] = useState<FormData>(emptyFormData());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(ShiftPresensi & { detail: ShiftPresensiDetail[] }) | null>(null);
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('shift_presensi')
      .select('*, shift_presensi_detail(*)')
      .order('kode');
    if (err) { setError(err.message); setLoading(false); return; }
    setItems((data ?? []) as unknown as (ShiftPresensi & { detail: ShiftPresensiDetail[] })[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter((i) => {
    const matchSearch = i.nama.toLowerCase().includes(search.toLowerCase()) || i.kode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm(emptyFormData());
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: ShiftPresensi & { detail: ShiftPresensiDetail[] }) {
    setEditing(item);
    const days: Record<string, DaySchedule> = {};
    for (const d of allDays) {
      const det = item.detail?.find((x) => x.hari === d);
      days[d] = det
        ? { aktif: det.aktif, jam_masuk: det.jam_masuk ?? '06:00', batas_terlambat: det.batas_terlambat ?? '07:15', jam_pulang: det.jam_pulang ?? '15:00' }
        : emptyDaySchedule(d !== 'Sabtu' && d !== 'Minggu');
    }
    setForm({ kode: item.kode, nama: item.nama, berlaku_untuk: (item as ShiftPresensi & { detail: ShiftPresensiDetail[] }).berlaku_untuk ?? 'keduanya', keterangan: (item as ShiftPresensi & { detail: ShiftPresensiDetail[] }).keterangan ?? '', aktif: item.aktif, days });
    setError(null);
    setModalOpen(true);
  }

  function updateDay(day: string, field: keyof DaySchedule, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      days: { ...prev.days, [day]: { ...prev.days[day], [field]: value } },
    }));
  }

  function validateTimes(d: DaySchedule): string | null {
    if (!d.aktif) return null;
    if (d.jam_masuk && d.batas_terlambat && d.jam_masuk >= d.batas_terlambat) {
      return 'Jam masuk harus lebih awal dari batas terlambat';
    }
    if (d.batas_terlambat && d.jam_pulang && d.batas_terlambat >= d.jam_pulang) {
      return 'Batas terlambat harus lebih awal dari jam pulang';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    for (const d of allDays) {
      const err = validateTimes(form.days[d]);
      if (err) { setError(`${d}: ${err}`); setSaving(false); return; }
    }

    const shiftPayload = { kode: form.kode, nama: form.nama, berlaku_untuk: form.berlaku_untuk, keterangan: form.keterangan || null, jam_masuk: form.days.Senin.jam_masuk, batas_terlambat: form.days.Senin.batas_terlambat, jam_pulang: form.days.Senin.jam_pulang, hari_aktif: allDays.filter((d) => form.days[d].aktif), aktif: form.aktif };

    let shiftId: string;
    if (editing) {
      const { error: err } = await supabase.from('shift_presensi').update(shiftPayload).eq('id', editing.id);
      if (err) { setError(err.code === '23505' ? 'Kode shift sudah ada.' : err.message); setSaving(false); return; }
      shiftId = editing.id;
      await supabase.from('shift_presensi_detail').delete().eq('shift_presensi_id', shiftId);
    } else {
      const { data, error: err } = await supabase.from('shift_presensi').insert(shiftPayload).select('id').single();
      if (err) { setError(err.code === '23505' ? 'Kode shift sudah ada.' : err.message); setSaving(false); return; }
      shiftId = data.id;
    }

    const detailRows = allDays.map((hari) => ({
      shift_presensi_id: shiftId,
      hari,
      aktif: form.days[hari].aktif,
      jam_masuk: form.days[hari].aktif ? form.days[hari].jam_masuk || null : null,
      batas_terlambat: form.days[hari].aktif ? form.days[hari].batas_terlambat || null : null,
      jam_pulang: form.days[hari].aktif ? form.days[hari].jam_pulang || null : null,
    }));

    const { error: detailErr } = await supabase.from('shift_presensi_detail').insert(detailRows);
    if (detailErr) { setError('Gagal menyimpan detail jadwal: ' + detailErr.message); setSaving(false); return; }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    // Soft-delete: deactivate instead of hard delete to preserve history
    const { error: err } = await supabase.from('shift_presensi').update({ aktif: false, updated_at: new Date().toISOString() }).eq('id', deleteTarget.id);
    if (err) { setError('Tidak dapat menonaktifkan: ' + err.message); return; }
    setDeleteTarget(null);
    fetchData();
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-emerald-700" />
              Shift Presensi
            </h1>
            <p className="mt-1 text-sm text-gray-500">Master data shift kehadiran dengan jadwal per hari</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari shift..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
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
                  <th className="px-4 py-3">Berlaku Untuk</th>
                  <th className="px-4 py-3">Hari Aktif</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada data shift presensi</td></tr>
                ) : (
                  paged.map((item) => {
                    const activeDays = item.detail?.filter((d) => d.aktif) ?? [];
                    const isExpanded = expandedRow === item.id;
                    return (
                      <tbody key={item.id} className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{item.kode}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{item.nama}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              {(item as ShiftPresensi & { detail: ShiftPresensiDetail[] }).berlaku_untuk === 'siswa' || (item as ShiftPresensi & { detail: ShiftPresensiDetail[] }).berlaku_untuk === 'keduanya' ? <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> Siswa</span> : null}
                              {(item as ShiftPresensi & { detail: ShiftPresensiDetail[] }).berlaku_untuk === 'tendik' || (item as ShiftPresensi & { detail: ShiftPresensiDetail[] }).berlaku_untuk === 'keduanya' ? <span className="inline-flex items-center gap-1"><UserCog className="w-3 h-3" /> Tendik</span> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            <button onClick={() => setExpandedRow(isExpanded ? null : item.id)} className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800">
                              <Calendar className="w-3.5 h-3.5" />
                              {activeDays.length} hari aktif
                            </button>
                          </td>
                          <td className="px-4 py-3">{item.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => setDeleteTarget(item)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                {allDays.map((hari) => {
                                  const det = item.detail?.find((d) => d.hari === hari);
                                  if (!det || !det.aktif) {
                                    return (
                                      <div key={hari} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                        <p className="text-xs font-semibold text-gray-400">{hari}</p>
                                        <p className="text-xs text-gray-400 mt-1">Tidak aktif</p>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={hari} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                      <p className="text-xs font-semibold text-emerald-700">{hari}</p>
                                      <p className="text-xs text-gray-600 mt-1 font-mono">{det.jam_masuk} - {det.jam_pulang}</p>
                                      <p className="text-xs text-red-500 font-mono">terlambat: {det.batas_terlambat}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Shift Presensi' : 'Tambah Shift Presensi'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Shift *</label>
              <input type="text" required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value.toUpperCase() })} placeholder="Contoh: SHP-REG" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Shift *</label>
              <input type="text" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Shift Reguler" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Berlaku Untuk *</label>
              <select value={form.berlaku_untuk} onChange={(e) => setForm({ ...form, berlaku_untuk: e.target.value as 'siswa' | 'tendik' | 'keduanya' })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="keduanya">Siswa & Tendik</option>
                <option value="siswa">Siswa saja</option>
                <option value="tendik">Tendik saja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Keterangan</label>
              <input type="text" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Catatan shift (opsional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
            </div>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">
              <Calendar className="w-4 h-4 text-emerald-600" /> Jadwal Per Hari
            </h4>
            <div className="space-y-2">
              {allDays.map((hari) => {
                const d = form.days[hari];
                return (
                  <div key={hari} className={`rounded-lg border p-3 transition ${d.aktif ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={d.aktif} onChange={(e) => updateDay(hari, 'aktif', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                        <span className="text-sm font-medium text-gray-700">{hari}</span>
                      </label>
                    </div>
                    {d.aktif && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Jam Masuk</label>
                          <input type="time" value={d.jam_masuk} onChange={(e) => updateDay(hari, 'jam_masuk', e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Batas Terlambat</label>
                          <input type="time" value={d.batas_terlambat} onChange={(e) => updateDay(hari, 'batas_terlambat', e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono text-red-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Jam Pulang</label>
                          <input type="time" value={d.jam_pulang} onChange={(e) => updateDay(hari, 'jam_pulang', e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-400">Validasi: jam masuk &lt; batas terlambat &lt; jam pulang. Jadwal per hari tidak hard-coded — setiap hari bisa berbeda.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Shift aktif</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Nonaktifkan Shift Presensi" message={`Yakin ingin menonaktifkan shift "${deleteTarget?.nama}"? Shift yang sudah dipakai histori presensi tidak akan dihapus, hanya dinonaktifkan.`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

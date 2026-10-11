import { useEffect, useState, type FormEvent } from 'react';
import { BookMarked, Plus, Pencil, Trash2, Search, Grid3x3, List, Calendar, User, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { JadwalMengajar, JamPelajaran, GuruTendik, MataPelajaran, Kelas, Ruangan, TahunPelajaran, HariSeminggu, Siswa, Jurusan } from '@/types/database';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

const allDays: HariSeminggu[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

interface FormData {
  tahun_pelajaran_id: string;
  semester: 'ganjil' | 'genap';
  hari: HariSeminggu;
  jam_pelajaran_id: string;
  kelas_id: string;
  guru_id: string;
  mata_pelajaran_id: string;
  ruangan_id: string;
  catatan: string;
  aktif: boolean;
}

const emptyForm: FormData = {
  tahun_pelajaran_id: '', semester: 'ganjil', hari: 'Senin', jam_pelajaran_id: '',
  kelas_id: '', guru_id: '', mata_pelajaran_id: '', ruangan_id: '', catatan: '', aktif: true,
};

export default function JadwalMengajarPage() {
  const { profile, roles, hasAnyRole } = useAuth();
  const [items, setItems] = useState<(JadwalMengajar & { jam_pelajaran?: JamPelajaran; guru?: GuruTendik; mata_pelajaran?: MataPelajaran; kelas?: Kelas; ruangan?: Ruangan })[]>([]);
  const [jamList, setJamList] = useState<JamPelajaran[]>([]);
  const [guruList, setGuruList] = useState<GuruTendik[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [ruanganList, setRuanganList] = useState<Ruangan[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'weekly' | 'mine'>('table');
  const [search, setSearch] = useState('');
  const [filterTP, setFilterTP] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterGuru, setFilterGuru] = useState('all');
  const [filterMapel, setFilterMapel] = useState('all');
  const [filterHari, setFilterHari] = useState('all');
  const [filterRuangan, setFilterRuangan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTingkat, setFilterTingkat] = useState('all');
  const [filterJurusan, setFilterJurusan] = useState('all');
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JadwalMengajar | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JadwalMengajar | null>(null);
  const [myGuruId, setMyGuruId] = useState<string | null>(null);
  const [myKelasId, setMyKelasId] = useState<string | null>(null);
  const [filteredMapelList, setFilteredMapelList] = useState<MataPelajaran[]>([]);
  const [filteredJamList, setFilteredJamList] = useState<JamPelajaran[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<Kelas | null>(null);

  const isAdmin = hasAnyRole('super_admin', 'admin');
  const isGuru = roles.includes('guru') || roles.includes('guru_bk') || roles.includes('guru_piket') || roles.includes('wali_kelas');
  const isSiswa = roles.includes('siswa');

  async function fetchData() {
    setLoading(true);
    const [jadwalRes, jamRes, guruRes, mapelRes, kelasRes, ruanganRes, tpRes, jurusanRes] = await Promise.all([
      supabase.from('jadwal_mengajar').select('*, jam_pelajaran:jam_pelajaran_id(*), guru:guru_id(*), mata_pelajaran:mata_pelajaran_id(*), kelas:kelas_id(*), ruangan:ruangan_id(*), tahun_pelajaran:tahun_pelajaran_id(*)').order('hari').order('jam_pelajaran_id'),
      supabase.from('jam_pelajaran').select('*').eq('aktif', true).order('urutan'),
      supabase.from('guru_tendik').select('*').eq('jenis_ptk', 'guru').eq('aktif', true).order('nama_lengkap'),
      supabase.from('mata_pelajaran').select('*').eq('aktif', true).order('nama'),
      supabase.from('kelas').select('*').eq('aktif', true).order('nama'),
      supabase.from('ruangan').select('*').eq('aktif', true).order('nama'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
      supabase.from('jurusan').select('*').order('kode'),
    ]);
    if (jadwalRes.error) { setError(jadwalRes.error.message); setLoading(false); return; }
    setItems((jadwalRes.data ?? []) as unknown as (JadwalMengajar & { jam_pelajaran?: JamPelajaran; guru?: GuruTendik; mata_pelajaran?: MataPelajaran; kelas?: Kelas; ruangan?: Ruangan })[]);
    setJamList((jamRes.data ?? []) as JamPelajaran[]);
    setGuruList((guruRes.data ?? []) as GuruTendik[]);
    setMapelList((mapelRes.data ?? []) as MataPelajaran[]);
    setKelasList((kelasRes.data ?? []) as Kelas[]);
    setRuanganList((ruanganRes.data ?? []) as Ruangan[]);
    setTpList((tpRes.data ?? []) as TahunPelajaran[]);
    setJurusanList((jurusanRes.data ?? []) as Jurusan[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  // Reset to first page when filters or view change
  useEffect(() => { setPage(0); }, [view, search, filterTP, filterSemester, filterKelas, filterGuru, filterMapel, filterHari, filterRuangan, filterStatus, filterTingkat, filterJurusan]);

  // Find current user's guru_id or kelas_id
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      if (isGuru) {
        const { data } = await supabase.from('guru_tendik').select('id').eq('user_id', profile.id).maybeSingle();
        if (data) setMyGuruId(data.id);
      } else if (isSiswa) {
        const { data } = await supabase.from('siswa').select('id, kelas_id').eq('user_id', profile.id).maybeSingle();
        if (data) setMyKelasId((data as Siswa & { kelas_id: string }).kelas_id);
      }
    })();
  }, [profile, isGuru, isSiswa]);

  const filtered = items.filter((i) => {
    const matchTP = filterTP === 'all' || i.tahun_pelajaran_id === filterTP;
    const matchSemester = filterSemester === 'all' || i.semester === filterSemester;
    const matchKelas = filterKelas === 'all' || i.kelas_id === filterKelas;
    const matchGuru = filterGuru === 'all' || i.guru_id === filterGuru;
    const matchMapel = filterMapel === 'all' || i.mata_pelajaran_id === filterMapel;
    const matchHari = filterHari === 'all' || i.hari === filterHari;
    const matchRuangan = filterRuangan === 'all' || i.ruangan_id === filterRuangan;
    const matchTingkat = filterTingkat === 'all' || (i.kelas?.tingkat?.toString() === filterTingkat);
    const matchJurusan = filterJurusan === 'all' || (i.kelas?.jurusan_id === filterJurusan);
    const matchStatus = filterStatus === 'all' || (filterStatus === 'aktif' && i.aktif) || (filterStatus === 'nonaktif' && !i.aktif);
    const matchSearch = (i.guru?.nama_lengkap ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.mata_pelajaran?.nama ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.kelas?.nama ?? '').toLowerCase().includes(search.toLowerCase());
    // View: mine
    if (view === 'mine') {
      if (isGuru && myGuruId) return matchTP && matchSemester && i.guru_id === myGuruId && i.aktif;
      if (isSiswa && myKelasId) return matchTP && matchSemester && i.kelas_id === myKelasId && i.aktif;
      return false;
    }
    return matchTP && matchSemester && matchKelas && matchGuru && matchMapel && matchHari && matchRuangan && matchTingkat && matchJurusan && matchStatus && matchSearch;
  });

  function openCreate() {
    setEditing(null);
    const aktifTP = tpList.find((t) => t.aktif);
    setForm({ ...emptyForm, tahun_pelajaran_id: aktifTP?.id ?? '' });
    setSelectedKelas(null);
    setFilteredMapelList([]);
    setFilteredJamList([]);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: JadwalMengajar) {
    setEditing(item);
    const kelas = kelasList.find((k) => k.id === item.kelas_id) ?? null;
    setSelectedKelas(kelas);
    setFilteredMapelList(filterMapelByKelas(kelas));
    setFilteredJamList(filterJamByKelasHari(kelas, item.hari));
    setForm({
      tahun_pelajaran_id: item.tahun_pelajaran_id,
      semester: item.semester,
      hari: item.hari,
      jam_pelajaran_id: item.jam_pelajaran_id,
      kelas_id: item.kelas_id,
      guru_id: item.guru_id,
      mata_pelajaran_id: item.mata_pelajaran_id,
      ruangan_id: item.ruangan_id ?? '',
      catatan: item.catatan ?? '',
      aktif: item.aktif,
    });
    setError(null);
    setModalOpen(true);
  }

  function filterMapelByKelas(kelas: Kelas | null): MataPelajaran[] {
    if (!kelas) return [];
    const kelasTingkat = kelas.tingkat;
    const kelasJurusanId = kelas.jurusan_id;
    return mapelList.filter((m) => {
      const tingkatMatch = !m.tingkat || m.tingkat === kelasTingkat;
      const jurusanMatch = !m.jurusan_id || m.jurusan_id === kelasJurusanId;
      return tingkatMatch && jurusanMatch;
    });
  }

  function filterJamByKelasHari(kelas: Kelas | null, hari: string): JamPelajaran[] {
    if (!kelas) return jamList;
    return jamList.filter((j) => {
      if (j.kelas_id && j.kelas_id !== kelas.id) return false;
      if (j.hari && j.hari !== hari) return false;
      return true;
    });
  }

  function handleKelasChange(kelasId: string) {
    const kelas = kelasList.find((k) => k.id === kelasId) ?? null;
    setSelectedKelas(kelas);
    setFilteredMapelList(filterMapelByKelas(kelas));
    setFilteredJamList(filterJamByKelasHari(kelas, form.hari));
    setForm({ ...form, kelas_id: kelasId, mata_pelajaran_id: '', jam_pelajaran_id: '' });
  }

  function handleHariChange(hari: HariSeminggu) {
    setFilteredJamList(filterJamByKelasHari(selectedKelas, hari));
    setForm({ ...form, hari, jam_pelajaran_id: '' });
  }

  async function checkConflict(payload: FormData, excludeId?: string): Promise<string | null> {
    const conditions = [
      `tahun_pelajaran_id=eq.${payload.tahun_pelajaran_id}`,
      `semester=eq.${payload.semester}`,
      `hari=eq.${payload.hari}`,
      `jam_pelajaran_id=eq.${payload.jam_pelajaran_id}`,
      `aktif=eq.true`,
    ];
    let query = supabase.from('jadwal_mengajar').select('id, guru_id, kelas_id, ruangan_id').match(Object.fromEntries(conditions.map(c => c.split('='))));
    if (excludeId) query = query.neq('id', excludeId);
    const { data: conflicts } = await query;
    if (conflicts) {
      for (const c of conflicts) {
        if (c.guru_id === payload.guru_id) return 'Guru sudah memiliki jadwal pada hari dan jam pelajaran yang sama.';
        if (c.kelas_id === payload.kelas_id) return 'Kelas sudah memiliki mata pelajaran pada hari dan jam pelajaran yang sama.';
        if (payload.ruangan_id && c.ruangan_id === payload.ruangan_id) return 'Ruangan sudah digunakan jadwal lain pada hari dan jam pelajaran yang sama.';
      }
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const conflict = await checkConflict(form, editing?.id);
    if (conflict) { setError(conflict); setSaving(false); return; }

    const payload = {
      tahun_pelajaran_id: form.tahun_pelajaran_id,
      semester: form.semester,
      hari: form.hari,
      jam_pelajaran_id: form.jam_pelajaran_id,
      kelas_id: form.kelas_id,
      guru_id: form.guru_id,
      mata_pelajaran_id: form.mata_pelajaran_id,
      ruangan_id: form.ruangan_id || null,
      catatan: form.catatan || null,
      aktif: form.aktif,
    };

    if (editing) {
      const { error: err } = await supabase.from('jadwal_mengajar').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('jadwal_mengajar').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error: err } = await supabase.from('jadwal_mengajar').delete().eq('id', deleteTarget.id);
    if (err) { setError(err.message); return; }
    fetchData();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition";

  const JADWAL_PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / JADWAL_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = view === 'table' ? filtered.slice(currentPage * JADWAL_PAGE_SIZE, (currentPage + 1) * JADWAL_PAGE_SIZE) : filtered;

  // Weekly timetable grid
  const teachingDays = allDays.filter(d => d !== 'Minggu');
  const weeklyGrid: Record<string, (JadwalMengajar & { jam_pelajaran?: JamPelajaran; guru?: GuruTendik; mata_pelajaran?: MataPelajaran; kelas?: Kelas; ruangan?: Ruangan })[]> = {};
  for (const d of teachingDays) weeklyGrid[d] = [];
  for (const item of filtered) {
    if (weeklyGrid[item.hari]) weeklyGrid[item.hari].push(item);
  }
  for (const d of teachingDays) weeklyGrid[d].sort((a, b) => (a.jam_pelajaran?.urutan ?? 0) - (b.jam_pelajaran?.urutan ?? 0));

  function guruName(g: GuruTendik) {
    return [g.gelar_depan, g.nama_lengkap, g.gelar_belakang].filter(Boolean).join(' ');
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-emerald-700" />
              Jadwal Mengajar
            </h1>
            <p className="mt-1 text-sm text-gray-500">Jadwal pelajaran guru dan kelas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button onClick={() => setView('table')} className={`px-3 py-2 text-sm font-medium transition ${view === 'table' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="Tabel"><List className="w-4 h-4" /></button>
              <button onClick={() => setView('weekly')} className={`px-3 py-2 text-sm font-medium transition ${view === 'weekly' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="Mingguan"><Grid3x3 className="w-4 h-4" /></button>
              {(isGuru || isSiswa) && (
                <button onClick={() => setView('mine')} className={`px-3 py-2 text-sm font-medium transition ${view === 'mine' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} title="Jadwal Saya"><User className="w-4 h-4" /></button>
              )}
            </div>
            {isAdmin && (
              <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            )}
          </div>
        </div>

        {/* View label */}
        {view === 'mine' && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800">
            {isGuru ? 'Menampilkan jadwal mengajar Anda.' : isSiswa ? 'Menampilkan jadwal kelas Anda.' : 'Tidak ada jadwal personal.'}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari guru, mapel, kelas..." className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition" />
          </div>
          <select value={filterTP} onChange={(e) => setFilterTP(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua TP</option>
            {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
          <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
            <option value="all">Semua Smt</option>
            <option value="ganjil">Ganjil</option>
            <option value="genap">Genap</option>
          </select>
          {view !== 'mine' && (
            <>
              <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Kelas</option>
                {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
              <select value={filterTingkat} onChange={(e) => setFilterTingkat(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Tingkat</option>
                <option value="10">X (10)</option>
                <option value="11">XI (11)</option>
                <option value="12">XII (12)</option>
              </select>
              <select value={filterJurusan} onChange={(e) => setFilterJurusan(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Jurusan</option>
                {jurusanList.map((j) => <option key={j.id} value={j.id}>{j.kode}</option>)}
              </select>
              <select value={filterGuru} onChange={(e) => setFilterGuru(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Guru</option>
                {guruList.map((g) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
              </select>
              <select value={filterMapel} onChange={(e) => setFilterMapel(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Mapel</option>
                {mapelList.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
              <select value={filterHari} onChange={(e) => setFilterHari(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Hari</option>
                {allDays.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterRuangan} onChange={(e) => setFilterRuangan(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Ruang</option>
                {ruanganList.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition">
                <option value="all">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </>
          )}
        </div>

        {/* Table View */}
        {view === 'table' && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Hari</th>
                    <th className="px-4 py-3">Jam</th>
                    <th className="px-4 py-3">Kelas</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Mapel</th>
                    <th className="px-4 py-3 hidden md:table-cell">Guru</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Ruangan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
                  ) : paged.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada jadwal</td></tr>
                  ) : (
                    paged.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">{item.hari}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.jam_pelajaran?.jam_mulai ?? '—'} - {item.jam_pelajaran?.jam_selesai ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{item.kelas?.nama ?? '—'}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-700">{item.mata_pelajaran?.nama ?? '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-700">{item.guru ? guruName(item.guru) : '—'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{item.ruangan?.nama ?? '—'}</td>
                        <td className="px-4 py-3">{item.aktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="neutral">Nonaktif</Badge>}</td>
                        <td className="px-4 py-3">
                          {isAdmin && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => setDeleteTarget(item)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">Menampilkan {currentPage * JADWAL_PAGE_SIZE + 1}–{Math.min((currentPage + 1) * JADWAL_PAGE_SIZE, filtered.length)} dari {filtered.length}</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">{currentPage + 1} / {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1} className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 transition disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}
        {view === 'weekly' && (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid" style={{ gridTemplateColumns: `120px repeat(${teachingDays.length}, 1fr)` }}>
                <div className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Jam</div>
                {teachingDays.map((d) => (
                  <div key={d} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs font-semibold uppercase text-gray-700">{d}</div>
                ))}
                {jamList.map((jp) => (
                  <div key={jp.id} className="contents">
                    <div className="border-b border-r border-gray-100 px-3 py-2 text-xs text-gray-500 font-mono">
                      <div>{jp.jam_mulai}</div>
                      <div>{jp.jam_selesai}</div>
                    </div>
                    {teachingDays.map((d) => {
                      const slot = weeklyGrid[d]?.find((j) => j.jam_pelajaran_id === jp.id);
                      return (
                        <div key={d + jp.id} className="border-b border-r border-gray-100 p-1 min-h-[60px]">
                          {slot && (
                            <div className={`rounded-lg px-2 py-1.5 text-xs cursor-pointer ${slot.aktif ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200 opacity-60'}`} onClick={() => isAdmin && openEdit(slot)}>
                              <p className="font-semibold text-gray-800 truncate">{slot.mata_pelajaran?.nama ?? '—'}</p>
                              <p className="text-gray-500 truncate">{slot.kelas?.nama ?? '—'}</p>
                              <p className="text-emerald-600 truncate text-[10px]">{slot.guru?.nama_lengkap ?? '—'}</p>
                              {slot.ruangan && <p className="text-gray-400 text-[10px]">{slot.ruangan.nama}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {filtered.length === 0 && !loading && (
                <p className="text-center text-sm text-gray-400 py-8">Belum ada jadwal untuk ditampilkan</p>
              )}
            </div>
          </div>
        )}

        {/* Mine View */}
        {view === 'mine' && (
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center text-sm text-gray-400">
                {loading ? 'Memuat...' : 'Belum ada jadwal untuk Anda.'}
              </div>
            ) : (
              <div className="min-w-[700px]">
                <div className="grid" style={{ gridTemplateColumns: `120px repeat(${teachingDays.length}, 1fr)` }}>
                  <div className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-500">Jam</div>
                  {teachingDays.map((d) => (
                    <div key={d} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs font-semibold uppercase text-gray-700">{d}</div>
                  ))}
                  {jamList.map((jp) => (
                    <div key={jp.id} className="contents">
                      <div className="border-b border-r border-gray-100 px-3 py-2 text-xs text-gray-500 font-mono">
                        <div>{jp.jam_mulai}</div>
                        <div>{jp.jam_selesai}</div>
                      </div>
                      {teachingDays.map((d) => {
                        const slot = weeklyGrid[d]?.find((j) => j.jam_pelajaran_id === jp.id);
                        return (
                          <div key={d + jp.id} className="border-b border-r border-gray-100 p-1 min-h-[60px]">
                            {slot && (
                              <div className="rounded-lg px-2 py-1.5 text-xs bg-emerald-50 border border-emerald-200">
                                <p className="font-semibold text-gray-800 truncate">{slot.mata_pelajaran?.nama ?? '—'}</p>
                                {isGuru && <p className="text-gray-500 truncate">{slot.kelas?.nama ?? '—'}</p>}
                                {isSiswa && <p className="text-emerald-600 truncate text-[10px]">{slot.guru?.nama_lengkap ?? '—'}</p>}
                                {slot.ruangan && <p className="text-gray-400 text-[10px]">{slot.ruangan.nama}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Tahun Pelajaran + Semester */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tahun Pelajaran *</label>
              <select required value={form.tahun_pelajaran_id} onChange={(e) => setForm({ ...form, tahun_pelajaran_id: e.target.value })} className={inputCls}>
                <option value="">— Pilih —</option>
                {tpList.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester *</label>
              <select required value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value as 'ganjil' | 'genap' })} className={inputCls}>
                <option value="ganjil">Ganjil</option>
                <option value="genap">Genap</option>
              </select>
            </div>
          </div>
          {/* Step 2: Kelas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kelas *</label>
            <select required value={form.kelas_id} onChange={(e) => handleKelasChange(e.target.value)} className={inputCls}>
              <option value="">— Pilih —</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            {selectedKelas && (
              <p className="mt-1 text-xs text-gray-400">
                Tingkat: {selectedKelas.tingkat ? (selectedKelas.tingkat === 10 ? 'X' : selectedKelas.tingkat === 11 ? 'XI' : selectedKelas.tingkat === 12 ? 'XII' : selectedKelas.tingkat) : '—'} · Jurusan: {jurusanList.find((j) => j.id === selectedKelas.jurusan_id)?.kode ?? '—'}
              </p>
            )}
          </div>
          {/* Step 3: Guru */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Guru Pengampu *</label>
            <select required value={form.guru_id} onChange={(e) => setForm({ ...form, guru_id: e.target.value })} className={inputCls}>
              <option value="">— Pilih —</option>
              {guruList.map((g) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
            </select>
          </div>
          {/* Step 4: Mata Pelajaran (filtered by kelas tingkat+jurusan) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mata Pelajaran *</label>
            <select required value={form.mata_pelajaran_id} onChange={(e) => setForm({ ...form, mata_pelajaran_id: e.target.value })} className={inputCls} disabled={!form.kelas_id}>
              <option value="">— Pilih —</option>
              {filteredMapelList.map((m) => <option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}
            </select>
            {form.kelas_id && filteredMapelList.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Tidak ada mata pelajaran untuk tingkat/jurusan kelas ini. Tambahkan mapel dengan tingkat & jurusan yang sesuai di Master Mata Pelajaran.</p>
            )}
            {form.kelas_id && filteredMapelList.length > 0 && (
              <p className="mt-1 text-xs text-gray-400">Menampilkan {filteredMapelList.length} mapel sesuai tingkat & jurusan kelas.</p>
            )}
          </div>
          {/* Step 5: Hari + Jam Pelajaran (filtered by kelas+hari) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Hari *</label>
              <select required value={form.hari} onChange={(e) => handleHariChange(e.target.value as HariSeminggu)} className={inputCls}>
                {allDays.filter(d => d !== 'Minggu').map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jam Pelajaran *</label>
              <select required value={form.jam_pelajaran_id} onChange={(e) => setForm({ ...form, jam_pelajaran_id: e.target.value })} className={inputCls} disabled={!form.kelas_id}>
                <option value="">— Pilih —</option>
                {filteredJamList.map((j) => <option key={j.id} value={j.id}>{j.nama} ({j.jam_mulai}-{j.jam_selesai})</option>)}
              </select>
              {form.kelas_id && filteredJamList.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">Belum ada jam pelajaran untuk kelas & hari ini. Buat di Master Jam Pelajaran.</p>
              )}
            </div>
          </div>
          {/* Step 6: Ruangan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ruangan</label>
            <select value={form.ruangan_id} onChange={(e) => setForm({ ...form, ruangan_id: e.target.value })} className={inputCls}>
              <option value="">— Pilih —</option>
              {ruanganList.map((r) => <option key={r.id} value={r.id}>{r.kode} — {r.nama}{r.kapasitas ? ` (kap. ${r.kapasitas})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
            <textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} rows={2} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm text-gray-700">Jadwal aktif</span>
          </label>
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
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Jadwal" message="Yakin ingin menghapus jadwal ini?" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}


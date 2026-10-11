import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { exportToExcel } from '@/lib/importUtils';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import PresensiSubNav from '@/components/PresensiSubNav';
import Badge from '@/components/Badge';
import type {
  PresensiSiswa,
  PresensiGuruTendik,
  PresensiStatus,
  PresensiGuruStatus,
  PresensiMetode,
  SchoolSettings,
  TahunPelajaran,
  Kelas,
  Jurusan,
  Siswa,
  GuruTendik,
  PRESENSI_STATUS_LABELS,
  PRESENSI_STATUS_VARIANTS,
} from '@/types/database';
import {
  PRESENSI_STATUS_LABELS as STATUS_LABELS,
  PRESENSI_STATUS_VARIANTS as STATUS_VARIANTS,
  PRESENSI_GURU_STATUS_LABELS,
  PRESENSI_GURU_STATUS_VARIANTS,
  PRESENSI_METODE_LABELS,
} from '@/types/database';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Search,
  X,
  ChevronLeft,
  ArrowLeft,
  GraduationCap,
  Calendar,
  Users,
  UserCog,
  Filter,
  BarChart3,
  Eye,
} from 'lucide-react';

type JenisPresensi = 'siswa' | 'guru' | 'tendik';
type PeriodeMode = 'harian' | 'mingguan' | 'bulanan' | 'semester';

const HARI_LABELS: Record<number, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

const BULAN_LABELS: Record<number, string> = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April', 5: 'Mei', 6: 'Juni',
  7: 'Juli', 8: 'Agustus', 9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
};

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  return `${HARI_LABELS[d.getDay()]}, ${d.getDate()} ${BULAN_LABELS[d.getMonth() + 1]} ${d.getFullYear()}`;
}

function formatTime(t: string | null): string {
  if (!t) return '-';
  return t.substring(0, 5);
}

function getWeekRange(date: string): { start: string; end: string } {
  const d = new Date(date + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 5);
  return {
    start: monday.toISOString().split('T')[0],
    end: friday.toISOString().split('T')[0],
  };
}

function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

interface IndividuDetail {
  presensi: PresensiSiswa[] | PresensiGuruTendik[];
  stats: Record<string, number>;
  total: number;
  persentase: number;
  identitas: Record<string, string>;
}

export default function LaporanPresensi() {
  const { isAdmin, hasAnyRole } = useAuth();
  const canView = isAdmin() || hasAnyRole('kepala_sekolah', 'guru', 'wali_kelas', 'guru_piket');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [tahunList, setTahunList] = useState<TahunPelajaran[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [guruList, setGuruList] = useState<GuruTendik[]>([]);

  // Filter state
  const [jenis, setJenis] = useState<JenisPresensi>('siswa');
  const [periode, setPeriode] = useState<PeriodeMode>('bulanan');
  const [tahunId, setTahunId] = useState<string>('');
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil');
  const [tanggalHarian, setTanggalHarian] = useState(new Date().toISOString().split('T')[0]);
  const [tanggalMingguan, setTanggalMingguan] = useState(new Date().toISOString().split('T')[0]);
  const [bulanSelected, setBulanSelected] = useState(new Date().toISOString().substring(0, 7));
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [kelasFilter, setKelasFilter] = useState('');
  const [jurusanFilter, setJurusanFilter] = useState('');
  const [namaSearch, setNamaSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [metodeFilter, setMetodeFilter] = useState('');

  // Results
  const [siswaData, setSiswaData] = useState<PresensiSiswa[]>([]);
  const [guruData, setGuruData] = useState<PresensiGuruTendik[]>([]);
  const [hasResult, setHasResult] = useState(false);

  // Individu detail modal
  const [individuModal, setIndividuModal] = useState(false);
  const [individuLoading, setIndividuLoading] = useState(false);
  const [individuDetail, setIndividuDetail] = useState<IndividuDetail | null>(null);
  const [individuNama, setIndividuNama] = useState('');

  // Compute date range from periode
  const dateRange = useMemo(() => {
    if (periode === 'harian') {
      return { start: tanggalHarian, end: tanggalHarian };
    }
    if (periode === 'mingguan') {
      return getWeekRange(tanggalMingguan);
    }
    if (periode === 'bulanan') {
      return getMonthRange(bulanSelected);
    }
    // semester or custom
    if (tanggalMulai && tanggalSelesai) {
      return { start: tanggalMulai, end: tanggalSelesai };
    }
    // Default to active tahun pelajaran range
    const tp = tahunList.find((t) => t.id === tahunId);
    if (tp?.tanggal_mulai && tp?.tanggal_selesai) {
      return { start: tp.tanggal_mulai, end: tp.tanggal_selesai };
    }
    return { start: '', end: '' };
  }, [periode, tanggalHarian, tanggalMingguan, bulanSelected, tanggalMulai, tanggalSelesai, tahunId, tahunList]);

  // Fetch initial data
  useEffect(() => {
    (async () => {
      const [ssRes, tpRes, kelasRes, jurusanRes, guruRes] = await Promise.all([
        supabase.from('school_settings').select('*, kepala_sekolah:kepala_sekolah_id(*)').eq('id', 1).maybeSingle(),
        supabase.from('tahun_pelajaran').select('*').order('aktif', { ascending: false }).order('nama', { ascending: false }),
        supabase.from('kelas').select('*').order('nama'),
        supabase.from('jurusan').select('*').order('nama'),
        supabase.from('guru_tendik').select('*').order('nama_lengkap'),
      ]);
      setSchoolSettings(ssRes.data as SchoolSettings | null);
      setTahunList((tpRes.data ?? []) as TahunPelajaran[]);
      setKelasList((kelasRes.data ?? []) as Kelas[]);
      setJurusanList((jurusanRes.data ?? []) as Jurusan[]);
      setGuruList((guruRes.data ?? []) as GuruTendik[]);

      // Set active tahun pelajaran as default
      const activeTp = (tpRes.data ?? []).find((t) => t.aktif);
      if (activeTp) {
        setTahunId(activeTp.id);
        setSemester(activeTp.semester);
      }
    })();
  }, []);

  // Fetch laporan
  const fetchLaporan = useCallback(async () => {
    if (!dateRange.start || !dateRange.end) return;
    setLoading(true);
    setHasResult(false);

    if (jenis === 'siswa') {
      let query = supabase
        .from('presensi_siswa')
        .select(`*, siswa:siswa_id(id, nama_lengkap, nis, nisn, kelas_id, jurusan_id, foto_url), kelas:kelas_id(id, nama, jurusan_id)`)
        .gte('tanggal', dateRange.start)
        .lte('tanggal', dateRange.end)
        .order('tanggal', { ascending: true })
        .order('jam_masuk', { ascending: true, nullsFirst: false })
        .limit(5000);

      if (kelasFilter) query = query.eq('kelas_id', kelasFilter);
      if (statusFilter) query = query.eq('status_masuk', statusFilter);
      if (metodeFilter) query = query.eq('metode_masuk', metodeFilter);

      const { data } = await query;
      let rows = (data ?? []) as PresensiSiswa[];

      // Client-side filters for joined fields
      if (jurusanFilter) {
        rows = rows.filter((r) => r.siswa?.jurusan_id === jurusanFilter || r.kelas?.jurusan_id === jurusanFilter);
      }
      if (namaSearch.trim()) {
        const q = namaSearch.toLowerCase();
        rows = rows.filter((r) => r.siswa?.nama_lengkap?.toLowerCase().includes(q) || r.siswa?.nis?.toLowerCase().includes(q) || r.siswa?.nisn?.toLowerCase().includes(q));
      }

      setSiswaData(rows);
    } else {
      let query = supabase
        .from('presensi_guru_tendik')
        .select(`*, guru_tendik:guru_tendik_id(id, nama_lengkap, nip, nuptk, jenis_ptk, jabatan, user_id, foto_url), jadwal_mengajar:jadwal_mengajar_id(id, hari, kelas_id, mata_pelajaran_id, jam_pelajaran_id, kelas:kelas_id(id, nama), mata_pelajaran:mata_pelajaran_id(id, nama), jam_pelajaran:jam_pelajaran_id(id, jam_mulai, jam_selesai))`)
        .gte('tanggal', dateRange.start)
        .lte('tanggal', dateRange.end)
        .order('tanggal', { ascending: true })
        .order('jam_masuk', { ascending: true, nullsFirst: false })
        .limit(5000);

      if (statusFilter) query = query.eq('status_masuk', statusFilter);
      if (metodeFilter) query = query.eq('metode_masuk', metodeFilter);

      const { data } = await query;
      let rows = (data ?? []) as PresensiGuruTendik[];

      // Filter by jenis_ptk
      rows = rows.filter((r) => r.guru_tendik?.jenis_ptk === jenis);

      if (namaSearch.trim()) {
        const q = namaSearch.toLowerCase();
        rows = rows.filter((r) => r.guru_tendik?.nama_lengkap?.toLowerCase().includes(q) || r.guru_tendik?.nip?.toLowerCase().includes(q));
      }

      setGuruData(rows);
    }

    setLoading(false);
    setHasResult(true);
  }, [dateRange, jenis, kelasFilter, jurusanFilter, namaSearch, statusFilter, metodeFilter]);

  // Compute stats
  const stats = useMemo(() => {
    if (jenis === 'siswa') {
      const s: Record<string, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
      siswaData.forEach((r) => { s[r.status_masuk] = (s[r.status_masuk] ?? 0) + 1; });
      const total = siswaData.length;
      const hadirPersen = total > 0 ? Math.round(((s.hadir + s.terlambat) / total) * 100) : 0;
      return { stats: s, total, hadirPersen };
    } else {
      const s: Record<string, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, tugas_luar: 0, cuti: 0, alfa: 0 };
      guruData.forEach((r) => { s[r.status_masuk] = (s[r.status_masuk] ?? 0) + 1; });
      const total = guruData.length;
      const hadirPersen = total > 0 ? Math.round(((s.hadir + s.terlambat) / total) * 100) : 0;
      return { stats: s, total, hadirPersen };
    }
  }, [jenis, siswaData, guruData]);

  // Get periode label
  const periodeLabel = useMemo(() => {
    if (periode === 'harian') return formatDate(dateRange.start);
    if (periode === 'mingguan') return `${formatDate(dateRange.start)} s/d ${formatDate(dateRange.end)}`;
    if (periode === 'bulanan') {
      const [y, m] = bulanSelected.split('-').map(Number);
      return `${BULAN_LABELS[m]} ${y}`;
    }
    if (tanggalMulai && tanggalSelesai) return `${formatDate(tanggalMulai)} s/d ${formatDate(tanggalSelesai)}`;
    const tp = tahunList.find((t) => t.id === tahunId);
    return `${tp?.nama ?? ''} - Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'}`;
  }, [periode, dateRange, bulanSelected, tanggalMulai, tanggalSelesai, tahunId, semester, tahunList]);

  const tpNama = useMemo(() => {
    const tp = tahunList.find((t) => t.id === tahunId);
    return tp?.nama ?? '';
  }, [tahunId, tahunList]);

  // Individu detail
  async function showIndividu(personId: string, namaLengkap: string, personJenis: JenisPresensi) {
    setIndividuModal(true);
    setIndividuLoading(true);
    setIndividuNama(namaLengkap);

    if (personJenis === 'siswa') {
      const [presensiRes, siswaRes] = await Promise.all([
        supabase
          .from('presensi_siswa')
          .select(`*, kelas:kelas_id(id, nama)`)
          .eq('siswa_id', personId)
          .gte('tanggal', dateRange.start)
          .lte('tanggal', dateRange.end)
          .order('tanggal', { ascending: true }),
        supabase.from('siswa').select('*, kelas:kelas_id(id, nama), jurusan:jurusan_id(id, nama)').eq('id', personId).maybeSingle(),
      ]);

      const presensi = (presensiRes.data ?? []) as PresensiSiswa[];
      const siswa = siswaRes.data as Siswa | null;
      const s: Record<string, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
      presensi.forEach((r) => { s[r.status_masuk] = (s[r.status_masuk] ?? 0) + 1; });
      const total = presensi.length;
      const persentase = total > 0 ? Math.round(((s.hadir + s.terlambat) / total) * 100) : 0;

      setIndividuDetail({
        presensi,
        stats: s,
        total,
        persentase,
        identitas: {
          'Nama': siswa?.nama_lengkap ?? namaLengkap,
          'NIS': siswa?.nis ?? '-',
          'NISN': siswa?.nisn ?? '-',
          'Kelas': siswa?.kelas?.nama ?? '-',
          'Jurusan': siswa?.jurusan?.nama ?? '-',
          'Jenis Kelamin': siswa?.jenis_kelamin === 'L' ? 'Laki-laki' : siswa?.jenis_kelamin === 'P' ? 'Perempuan' : '-',
        },
      });
    } else {
      const [presensiRes, guruRes] = await Promise.all([
        supabase
          .from('presensi_guru_tendik')
          .select(`*`)
          .eq('guru_tendik_id', personId)
          .gte('tanggal', dateRange.start)
          .lte('tanggal', dateRange.end)
          .order('tanggal', { ascending: true }),
        supabase.from('guru_tendik').select('*').eq('id', personId).maybeSingle(),
      ]);

      const presensi = (presensiRes.data ?? []) as PresensiGuruTendik[];
      const guru = guruRes.data as GuruTendik | null;
      const s: Record<string, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, tugas_luar: 0, cuti: 0, alfa: 0 };
      presensi.forEach((r) => { s[r.status_masuk] = (s[r.status_masuk] ?? 0) + 1; });
      const total = presensi.length;
      const persentase = total > 0 ? Math.round(((s.hadir + s.terlambat) / total) * 100) : 0;

      setIndividuDetail({
        presensi,
        stats: s,
        total,
        persentase,
        identitas: {
          'Nama': guru?.nama_lengkap ?? namaLengkap,
          'NIP': guru?.nip ?? '-',
          'NUPTK': guru?.nuptk ?? '-',
          'Jabatan': guru?.jabatan ?? '-',
          'Jenis PTK': guru?.jenis_ptk === 'guru' ? 'Guru' : 'Tendik',
          'Status Kepegawaian': guru?.status_kepegawaian ?? '-',
        },
      });
    }

    setIndividuLoading(false);
  }

  // Export to Excel
  function handleExportExcel() {
    if (jenis === 'siswa') {
      const rows = siswaData.map((r) => ({
        tanggal: r.tanggal,
        hari: HARI_LABELS[new Date(r.tanggal + 'T00:00:00').getDay()],
        nis: r.siswa?.nis ?? '',
        nisn: r.siswa?.nisn ?? '',
        nama: r.siswa?.nama_lengkap ?? '',
        kelas: r.kelas?.nama ?? '',
        jam_masuk: formatTime(r.jam_masuk),
        status: STATUS_LABELS[r.status_masuk],
        metode: r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '-',
        jam_pulang: formatTime(r.jam_pulang),
        keterangan: r.keterangan ?? '',
      }));
      exportToExcel(rows, [
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'hari', label: 'Hari' },
        { key: 'nis', label: 'NIS' },
        { key: 'nisn', label: 'NISN' },
        { key: 'nama', label: 'Nama' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'jam_masuk', label: 'Jam Masuk' },
        { key: 'status', label: 'Status' },
        { key: 'metode', label: 'Metode' },
        { key: 'jam_pulang', label: 'Jam Pulang' },
        { key: 'keterangan', label: 'Keterangan' },
      ], `Laporan_Presensi_Siswa_${periodeLabel.replace(/\s+/g, '_')}`);
    } else {
      const rows = guruData.map((r) => {
        const jm = r.jadwal_mengajar as { kelas?: { nama: string } | null; mata_pelajaran?: { nama: string } | null; jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null } | null;
        return {
          tanggal: r.tanggal,
          hari: HARI_LABELS[new Date(r.tanggal + 'T00:00:00').getDay()],
          nip: r.guru_tendik?.nip ?? '',
          nama: r.guru_tendik?.nama_lengkap ?? '',
          jabatan: r.guru_tendik?.jabatan ?? '',
          mata_pelajaran: jm?.mata_pelajaran?.nama ?? '-',
          kelas_mengajar: jm?.kelas?.nama ?? '-',
          jam_mengajar: jm?.jam_pelajaran ? `${formatTime(jm.jam_pelajaran.jam_mulai)} - ${formatTime(jm.jam_pelajaran.jam_selesai)}` : '-',
          jam_masuk: formatTime(r.jam_masuk),
          status: PRESENSI_GURU_STATUS_LABELS[r.status_masuk],
          metode: r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '-',
          jam_pulang: formatTime(r.jam_pulang),
          keterangan: r.keterangan ?? '',
        };
      });
      exportToExcel(rows, [
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'hari', label: 'Hari' },
        { key: 'nip', label: 'NIP' },
        { key: 'nama', label: 'Nama' },
        { key: 'jabatan', label: 'Jabatan' },
        { key: 'mata_pelajaran', label: 'Mata Pelajaran' },
        { key: 'kelas_mengajar', label: 'Kelas Mengajar' },
        { key: 'jam_mengajar', label: 'Jam Mengajar' },
        { key: 'jam_masuk', label: 'Jam Masuk' },
        { key: 'status', label: 'Status' },
        { key: 'metode', label: 'Metode' },
        { key: 'jam_pulang', label: 'Jam Pulang' },
        { key: 'keterangan', label: 'Keterangan' },
      ], `Laporan_Presensi_${jenis === 'guru' ? 'Guru' : 'Tendik'}_${periodeLabel.replace(/\s+/g, '_')}`);
    }
  }

  function handlePrint() {
    window.print();
  }

  // Status badge helper
  function StatusBadge({ status, isGuru }: { status: PresensiStatus | PresensiGuruStatus; isGuru: boolean }) {
    if (isGuru) {
      const gStatus = status as PresensiGuruStatus;
      return <Badge variant={PRESENSI_GURU_STATUS_VARIANTS[gStatus]}>{PRESENSI_GURU_STATUS_LABELS[gStatus]}</Badge>;
    }
    const sStatus = status as PresensiStatus;
    return <Badge variant={STATUS_VARIANTS[sStatus]}>{STATUS_LABELS[sStatus]}</Badge>;
  }

  // Group data by person for rekap view
  const groupedByPerson = useMemo(() => {
    if (jenis === 'siswa') {
      const map = new Map<string, { personId: string; nama: string; nis: string; kelas: string; records: PresensiSiswa[] }>();
      siswaData.forEach((r) => {
        const pid = r.siswa_id;
        if (!map.has(pid)) {
          map.set(pid, {
            personId: pid,
            nama: r.siswa?.nama_lengkap ?? '-',
            nis: r.siswa?.nis ?? '-',
            kelas: r.kelas?.nama ?? '-',
            records: [],
          });
        }
        map.get(pid)!.records.push(r);
      });
      return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama));
    } else {
      const map = new Map<string, { personId: string; nama: string; nip: string; jabatan: string; records: PresensiGuruTendik[] }>();
      guruData.forEach((r) => {
        const pid = r.guru_tendik_id;
        if (!map.has(pid)) {
          map.set(pid, {
            personId: pid,
            nama: r.guru_tendik?.nama_lengkap ?? '-',
            nip: r.guru_tendik?.nip ?? '-',
            jabatan: r.guru_tendik?.jabatan ?? '-',
            records: [],
          });
        }
        map.get(pid)!.records.push(r);
      });
      return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama));
    }
  }, [jenis, siswaData, guruData]);

  const judulLaporan = useMemo(() => {
    const jenisLabel = jenis === 'siswa' ? 'Siswa' : jenis === 'guru' ? 'Guru' : 'Tenaga Kependidikan';
    const periodeLabelMap: Record<PeriodeMode, string> = {
      harian: 'Harian',
      mingguan: 'Mingguan',
      bulanan: 'Bulanan',
      semester: 'Semester',
    };
    return `Laporan Presensi ${jenisLabel} ${periodeLabelMap[periode]}`;
  }, [jenis, periode]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Screen header (hidden in print) */}
        <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-600" />
              Laporan Presensi
            </h1>
            <p className="text-sm text-gray-500 mt-1">Laporan kehadiran siswa, guru, dan tendik dengan cetak & ekspor profesional.</p>
          </div>
          <button
            onClick={() => navigate('/presensi')}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Presensi
          </button>
        </div>

        {/* Sub-navigation */}
        <div className="print:hidden">
          <PresensiSubNav />
        </div>

      {/* Filter Panel (hidden in print) */}
      <div className="print:hidden bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Jenis Presensi selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Jenis Presensi</label>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'siswa', label: 'Siswa', icon: Users },
              { key: 'guru', label: 'Guru', icon: UserCog },
              { key: 'tendik', label: 'Tendik', icon: UserCog },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setJenis(opt.key); setHasResult(false); }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  jenis === opt.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Periode mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mode Periode</label>
            <select
              value={periode}
              onChange={(e) => { setPeriode(e.target.value as PeriodeMode); setHasResult(false); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
              <option value="semester">Semester / Custom</option>
            </select>
          </div>

          {/* Tahun Pelajaran */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tahun Pelajaran</label>
            <select
              value={tahunId}
              onChange={(e) => setTahunId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              {tahunList.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.nama} {tp.aktif ? '(Aktif)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as 'ganjil' | 'genap')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </div>

          {/* Periode-specific date input */}
          {periode === 'harian' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal</label>
              <input
                type="date"
                value={tanggalHarian}
                onChange={(e) => setTanggalHarian(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}
          {periode === 'mingguan' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal dalam Minggu</label>
              <input
                type="date"
                value={tanggalMingguan}
                onChange={(e) => setTanggalMingguan(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}
          {periode === 'bulanan' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bulan</label>
              <input
                type="month"
                value={bulanSelected}
                onChange={(e) => setBulanSelected(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}
          {periode === 'semester' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal Mulai</label>
                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal Selesai</label>
                <input
                  type="date"
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Additional filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {jenis === 'siswa' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Kelas</label>
                <select
                  value={kelasFilter}
                  onChange={(e) => setKelasFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jurusan</label>
                <select
                  value={jurusanFilter}
                  onChange={(e) => setJurusanFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Semua Jurusan</option>
                  {jurusanList.map((j) => (
                    <option key={j.id} value={j.id}>{j.nama}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Status</option>
              {jenis === 'siswa'
                ? (['hadir', 'terlambat', 'izin', 'sakit', 'alfa'] as PresensiStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))
                : (['hadir', 'terlambat', 'izin', 'sakit', 'tugas_luar', 'cuti', 'alfa'] as PresensiGuruStatus[]).map((s) => (
                    <option key={s} value={s}>{PRESENSI_GURU_STATUS_LABELS[s]}</option>
                  ))
              }
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Metode</label>
            <select
              value={metodeFilter}
              onChange={(e) => setMetodeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Metode</option>
              {(Object.keys(PRESENSI_METODE_LABELS) as PresensiMetode[]).map((m) => (
                <option key={m} value={m}>{PRESENSI_METODE_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cari Nama / NIS / NIP</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={namaSearch}
                onChange={(e) => setNamaSearch(e.target.value)}
                placeholder="Ketik nama..."
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={fetchLaporan}
            disabled={loading || (!dateRange.start || !dateRange.end)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Filter className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
          {hasResult && (
            <>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <Printer className="w-4 h-4" />
                Cetak / PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results area */}
      {hasResult && (
        <>
          {/* Summary cards (screen only) */}
          <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">Total Record</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            {jenis === 'siswa'
              ? (['hadir', 'terlambat', 'izin', 'sakit', 'alfa'] as const).map((s) => (
                  <div key={s} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium">{STATUS_LABELS[s]}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.stats[s] ?? 0}</p>
                  </div>
                ))
              : (['hadir', 'terlambat', 'izin', 'sakit', 'tugas_luar', 'cuti', 'alfa'] as const).map((s) => (
                  <div key={s} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium">{PRESENSI_GURU_STATUS_LABELS[s]}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.stats[s] ?? 0}</p>
                  </div>
                ))
            }
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 shadow-sm">
              <p className="text-xs text-emerald-600 font-medium">% Kehadiran</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.hadirPersen}%</p>
            </div>
          </div>

          {/* Print Header (only visible in print) */}
          <PrintHeader
            schoolSettings={schoolSettings}
            judul={judulLaporan}
            periodeLabel={periodeLabel}
            tpNama={tpNama}
            semester={semester}
          />

          {/* Data table (screen) */}
          <div className="print:hidden bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                {judulLaporan}
              </h2>
              <span className="text-xs text-gray-500">{periodeLabel}</span>
            </div>
            <div className="overflow-x-auto">
              {jenis === 'siswa' ? (
                <SiswaTable data={siswaData} onShowIndividu={showIndividu} />
              ) : (
                <GuruTable data={guruData} onShowIndividu={showIndividu} jenis={jenis} />
              )}
            </div>
          </div>

          {/* Rekap per person (screen) */}
          {groupedByPerson.length > 0 && (
            <div className="print:hidden bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-800">Rekap per {jenis === 'siswa' ? 'Siswa' : 'Guru/Tendik'}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">No</th>
                      {jenis === 'siswa' ? (
                        <>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">Nama</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">NIS</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">Kelas</th>
                        </>
                      ) : (
                        <>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">Nama</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">NIP</th>
                          <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs uppercase">Jabatan</th>
                        </>
                      )}
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Hadir</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Terlambat</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Izin</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Sakit</th>
                      {jenis !== 'siswa' && (
                        <>
                          <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Tugas Luar</th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Cuti</th>
                        </>
                      )}
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Alfa</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">%</th>
                      <th className="text-center px-2 py-2 font-semibold text-gray-600 text-xs uppercase">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedByPerson.map((p, idx) => {
                      const s: Record<string, number> = {};
                      p.records.forEach((r) => {
                        const st = (r as PresensiSiswa).status_masuk;
                        s[st] = (s[st] ?? 0) + 1;
                      });
                      const total = p.records.length;
                      const persen = total > 0 ? Math.round(((s.hadir ?? 0) + (s.terlambat ?? 0)) / total * 100) : 0;
                      return (
                        <tr key={p.personId} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-2 font-medium text-gray-800">{p.nama}</td>
                          {jenis === 'siswa' ? (
                            <>
                              <td className="px-4 py-2 text-gray-600">{(p as { nis: string }).nis}</td>
                              <td className="px-4 py-2 text-gray-600">{(p as { kelas: string }).kelas}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-gray-600">{(p as { nip: string }).nip}</td>
                              <td className="px-4 py-2 text-gray-600">{(p as { jabatan: string }).jabatan}</td>
                            </>
                          )}
                          <td className="px-2 py-2 text-center text-emerald-700 font-medium">{s.hadir ?? 0}</td>
                          <td className="px-2 py-2 text-center text-amber-700 font-medium">{s.terlambat ?? 0}</td>
                          <td className="px-2 py-2 text-center text-blue-700 font-medium">{s.izin ?? 0}</td>
                          <td className="px-2 py-2 text-center text-gray-600 font-medium">{s.sakit ?? 0}</td>
                          {jenis !== 'siswa' && (
                            <>
                              <td className="px-2 py-2 text-center text-blue-700 font-medium">{s.tugas_luar ?? 0}</td>
                              <td className="px-2 py-2 text-center text-gray-600 font-medium">{s.cuti ?? 0}</td>
                            </>
                          )}
                          <td className="px-2 py-2 text-center text-red-700 font-medium">{s.alfa ?? 0}</td>
                          <td className="px-2 py-2 text-center font-bold text-gray-800">{persen}%</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => showIndividu(p.personId, p.nama, jenis)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
                            >
                              <Eye className="w-3.5 h-3.5" /> Lihat
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Print data tables (only visible in print) */}
          <div className="hidden print:block">
            <PrintDataTable
              jenis={jenis}
              siswaData={siswaData}
              guruData={guruData}
              groupedByPerson={groupedByPerson}
            />
          </div>

          {/* Print Footer */}
          <PrintFooter schoolSettings={schoolSettings} />
        </>
      )}

      {!hasResult && !loading && (
        <div className="print:hidden bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Pilih filter dan klik "Tampilkan" untuk melihat laporan.</p>
        </div>
      )}

      {/* Individu Detail Modal */}
      {individuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIndividuModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Rekap Individu</h3>
                  <p className="text-xs text-gray-500">{individuNama}</p>
                </div>
              </div>
              <button onClick={() => setIndividuModal(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {individuLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : individuDetail ? (
                <>
                  {/* Identitas */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Identitas</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(individuDetail.identitas).map(([key, val]) => (
                        <div key={key}>
                          <p className="text-xs text-gray-500">{key}</p>
                          <p className="text-sm font-medium text-gray-800">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {jenis === 'siswa'
                      ? (['hadir', 'terlambat', 'izin', 'sakit', 'alfa'] as const).map((s) => (
                          <div key={s} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">{STATUS_LABELS[s]}</p>
                            <p className="text-xl font-bold text-gray-900">{individuDetail.stats[s] ?? 0}</p>
                          </div>
                        ))
                      : (['hadir', 'terlambat', 'izin', 'sakit', 'tugas_luar', 'cuti', 'alfa'] as const).map((s) => (
                          <div key={s} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">{PRESENSI_GURU_STATUS_LABELS[s]}</p>
                            <p className="text-xl font-bold text-gray-900">{individuDetail.stats[s] ?? 0}</p>
                          </div>
                        ))
                    }
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-emerald-600">% Hadir</p>
                      <p className="text-xl font-bold text-emerald-700">{individuDetail.persentase}%</p>
                    </div>
                  </div>

                  {/* Riwayat presensi */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Riwayat Presensi ({individuDetail.total} hari)</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Tanggal</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Jam Masuk</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Status</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Metode</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Jam Pulang</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {individuDetail.presensi.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-gray-400">Tidak ada data presensi pada periode ini.</td>
                            </tr>
                          ) : (
                            (individuDetail.presensi as (PresensiSiswa | PresensiGuruTendik)[]).map((r) => (
                              <tr key={r.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700">{formatDate(r.tanggal)}</td>
                                <td className="px-3 py-2 text-gray-700">{formatTime(r.jam_masuk)}</td>
                                <td className="px-3 py-2"><StatusBadge status={r.status_masuk} isGuru={jenis !== 'siswa'} /></td>
                                <td className="px-3 py-2 text-gray-600">{r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '-'}</td>
                                <td className="px-3 py-2 text-gray-700">{formatTime(r.jam_pulang)}</td>
                                <td className="px-3 py-2 text-gray-600">{r.keterangan ?? '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
    </AppLayout>
  );
}

// --- Sub Components ---

function SiswaTable({ data, onShowIndividu }: { data: PresensiSiswa[]; onShowIndividu: (id: string, nama: string, jenis: JenisPresensi) => void }) {
  if (data.length === 0) {
    return <div className="px-4 py-12 text-center text-gray-400">Tidak ada data presensi pada periode ini.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Tanggal</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Nama</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">NIS</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Kelas</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Jam Masuk</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Status</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Metode</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Jam Pulang</th>
          <th className="text-center px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Detail</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50 transition">
            <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{formatDate(r.tanggal)}</td>
            <td className="px-4 py-2 font-medium text-gray-800">{r.siswa?.nama_lengkap ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600">{r.siswa?.nis ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600">{r.kelas?.nama ?? '-'}</td>
            <td className="px-4 py-2 text-gray-700">{formatTime(r.jam_masuk)}</td>
            <td className="px-4 py-2"><StatusBadgeInline status={r.status_masuk} isGuru={false} /></td>
            <td className="px-4 py-2 text-gray-600">{r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '-'}</td>
            <td className="px-4 py-2 text-gray-700">{formatTime(r.jam_pulang)}</td>
            <td className="px-4 py-2 text-center">
              <button
                onClick={() => onShowIndividu(r.siswa_id, r.siswa?.nama_lengkap ?? '-', 'siswa')}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
              >
                <Eye className="w-3.5 h-3.5" /> Lihat
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GuruTable({ data, onShowIndividu, jenis }: { data: PresensiGuruTendik[]; onShowIndividu: (id: string, nama: string, jenis: JenisPresensi) => void; jenis: JenisPresensi }) {
  if (data.length === 0) {
    return <div className="px-4 py-12 text-center text-gray-400">Tidak ada data presensi pada periode ini.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Tanggal</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Nama</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">NIP</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Jabatan</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Mata Pelajaran</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Kelas</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Jam Mengajar</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Jam Masuk</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Status</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Metode</th>
          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Jam Pulang</th>
          <th className="text-center px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Detail</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.map((r) => {
          const jm = r.jadwal_mengajar as { kelas?: { nama: string } | null; mata_pelajaran?: { nama: string } | null; jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null } | null;
          return (
          <tr key={r.id} className="hover:bg-gray-50 transition">
            <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{formatDate(r.tanggal)}</td>
            <td className="px-4 py-2 font-medium text-gray-800">{r.guru_tendik?.nama_lengkap ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600">{r.guru_tendik?.nip ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600">{r.guru_tendik?.jabatan ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600">{jm?.mata_pelajaran?.nama ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600">{jm?.kelas?.nama ?? '-'}</td>
            <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{jm?.jam_pelajaran ? `${formatTime(jm.jam_pelajaran.jam_mulai)} - ${formatTime(jm.jam_pelajaran.jam_selesai)}` : '-'}</td>
            <td className="px-4 py-2 text-gray-700">{formatTime(r.jam_masuk)}</td>
            <td className="px-4 py-2"><StatusBadgeInline status={r.status_masuk} isGuru={true} /></td>
            <td className="px-4 py-2 text-gray-600">{r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '-'}</td>
            <td className="px-4 py-2 text-gray-700">{formatTime(r.jam_pulang)}</td>
            <td className="px-4 py-2 text-center">
              <button
                onClick={() => onShowIndividu(r.guru_tendik_id, r.guru_tendik?.nama_lengkap ?? '-', jenis)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
              >
                <Eye className="w-3.5 h-3.5" /> Lihat
              </button>
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatusBadgeInline({ status, isGuru }: { status: PresensiStatus | PresensiGuruStatus; isGuru: boolean }) {
  if (isGuru) {
    const gStatus = status as PresensiGuruStatus;
    return <Badge variant={PRESENSI_GURU_STATUS_VARIANTS[gStatus]}>{PRESENSI_GURU_STATUS_LABELS[gStatus]}</Badge>;
  }
  const sStatus = status as PresensiStatus;
  return <Badge variant={STATUS_VARIANTS[sStatus]}>{STATUS_LABELS[sStatus]}</Badge>;
}

// --- Print Components ---

function PrintHeader({ schoolSettings, judul, periodeLabel, tpNama, semester }: {
  schoolSettings: SchoolSettings | null;
  judul: string;
  periodeLabel: string;
  tpNama: string;
  semester: 'ganjil' | 'genap';
}) {
  return (
    <div className="hidden print:block mb-4 pb-3 border-b-2 border-gray-800">
      <div className="flex items-center gap-4">
        {schoolSettings?.logo_url ? (
          <img src={schoolSettings.logo_url} alt="Logo" className="w-20 h-20 object-contain" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center">
            <GraduationCap className="w-10 h-10 text-gray-400" />
          </div>
        )}
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold uppercase">{schoolSettings?.nama_sekolah ?? 'SMK NUR INSANI'}</h1>
          {schoolSettings?.npsn && <p className="text-sm">NPSN: {schoolSettings.npsn}</p>}
          {schoolSettings?.alamat && <p className="text-xs">{schoolSettings.alamat}</p>}
          {(schoolSettings?.kecamatan || schoolSettings?.kabupaten || schoolSettings?.provinsi) && (
            <p className="text-xs">
              {[schoolSettings?.kecamatan, schoolSettings?.kabupaten, schoolSettings?.provinsi].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="w-20" />
      </div>
      <div className="text-center mt-3">
        <h2 className="text-lg font-bold uppercase">{judul}</h2>
        <p className="text-sm">Periode: {periodeLabel}</p>
        {tpNama && <p className="text-sm">Tahun Pelajaran: {tpNama} - Semester {semester === 'ganjil' ? 'Ganjil' : 'Genap'}</p>}
      </div>
    </div>
  );
}

function PrintFooter({ schoolSettings }: { schoolSettings: SchoolSettings | null }) {
  const kepsek = schoolSettings?.kepala_sekolah;
  const today = new Date();
  const tempat = schoolSettings?.kabupaten ?? '';
  const tanggalCetak = `${tempat ? tempat + ', ' : ''}${today.getDate()} ${BULAN_LABELS[today.getMonth() + 1]} ${today.getFullYear()}`;
  return (
    <div className="hidden print:block mt-8 pt-4">
      <div className="flex justify-end">
        <div className="text-center min-w-[200px]">
          <p className="text-sm">{tanggalCetak}</p>
          <p className="text-sm">Mengetahui,</p>
          <p className="text-sm font-semibold">Kepala {schoolSettings?.nama_sekolah ?? 'SMK NUR INSANI'}</p>
          <div className="h-20" />
          <p className="text-sm font-bold underline">{kepsek?.nama_lengkap ?? '_______________'}</p>
          {kepsek?.nip && <p className="text-sm">NIP: {kepsek.nip}</p>}
          {kepsek?.nuptk && !kepsek?.nip && <p className="text-sm">NUPTK: {kepsek.nuptk}</p>}
        </div>
      </div>
    </div>
  );
}

function PrintDataTable({ jenis, siswaData, guruData, groupedByPerson }: {
  jenis: JenisPresensi;
  siswaData: PresensiSiswa[];
  guruData: PresensiGuruTendik[];
  groupedByPerson: { personId: string; nama: string; records: PresensiSiswa[] | PresensiGuruTendik[] }[];
}) {
  if (jenis === 'siswa') {
    return (
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left border border-gray-400 px-2 py-1">No</th>
            <th className="text-left border border-gray-400 px-2 py-1">Tanggal</th>
            <th className="text-left border border-gray-400 px-2 py-1">Nama</th>
            <th className="text-left border border-gray-400 px-2 py-1">NIS</th>
            <th className="text-left border border-gray-400 px-2 py-1">Kelas</th>
            <th className="text-left border border-gray-400 px-2 py-1">Jam Masuk</th>
            <th className="text-left border border-gray-400 px-2 py-1">Status</th>
            <th className="text-left border border-gray-400 px-2 py-1">Jam Pulang</th>
            <th className="text-left border border-gray-400 px-2 py-1">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {siswaData.map((r, i) => (
            <tr key={r.id}>
              <td className="border border-gray-400 px-2 py-1">{i + 1}</td>
              <td className="border border-gray-400 px-2 py-1">{r.tanggal}</td>
              <td className="border border-gray-400 px-2 py-1">{r.siswa?.nama_lengkap ?? '-'}</td>
              <td className="border border-gray-400 px-2 py-1">{r.siswa?.nis ?? '-'}</td>
              <td className="border border-gray-400 px-2 py-1">{r.kelas?.nama ?? '-'}</td>
              <td className="border border-gray-400 px-2 py-1">{formatTime(r.jam_masuk)}</td>
              <td className="border border-gray-400 px-2 py-1">{STATUS_LABELS[r.status_masuk]}</td>
              <td className="border border-gray-400 px-2 py-1">{formatTime(r.jam_pulang)}</td>
              <td className="border border-gray-400 px-2 py-1">{r.keterangan ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-gray-800">
          <th className="text-left border border-gray-400 px-2 py-1">No</th>
          <th className="text-left border border-gray-400 px-2 py-1">Tanggal</th>
          <th className="text-left border border-gray-400 px-2 py-1">Nama</th>
          <th className="text-left border border-gray-400 px-2 py-1">NIP</th>
          <th className="text-left border border-gray-400 px-2 py-1">Jabatan</th>
          <th className="text-left border border-gray-400 px-2 py-1">Mata Pelajaran</th>
          <th className="text-left border border-gray-400 px-2 py-1">Kelas</th>
          <th className="text-left border border-gray-400 px-2 py-1">Jam Mengajar</th>
          <th className="text-left border border-gray-400 px-2 py-1">Jam Masuk</th>
          <th className="text-left border border-gray-400 px-2 py-1">Status</th>
          <th className="text-left border border-gray-400 px-2 py-1">Jam Pulang</th>
          <th className="text-left border border-gray-400 px-2 py-1">Keterangan</th>
        </tr>
      </thead>
      <tbody>
        {guruData.map((r, i) => {
          const jm = r.jadwal_mengajar as { kelas?: { nama: string } | null; mata_pelajaran?: { nama: string } | null; jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null } | null;
          return (
          <tr key={r.id}>
            <td className="border border-gray-400 px-2 py-1">{i + 1}</td>
            <td className="border border-gray-400 px-2 py-1">{r.tanggal}</td>
            <td className="border border-gray-400 px-2 py-1">{r.guru_tendik?.nama_lengkap ?? '-'}</td>
            <td className="border border-gray-400 px-2 py-1">{r.guru_tendik?.nip ?? '-'}</td>
            <td className="border border-gray-400 px-2 py-1">{r.guru_tendik?.jabatan ?? '-'}</td>
            <td className="border border-gray-400 px-2 py-1">{jm?.mata_pelajaran?.nama ?? '-'}</td>
            <td className="border border-gray-400 px-2 py-1">{jm?.kelas?.nama ?? '-'}</td>
            <td className="border border-gray-400 px-2 py-1">{jm?.jam_pelajaran ? `${formatTime(jm.jam_pelajaran.jam_mulai)}-${formatTime(jm.jam_pelajaran.jam_selesai)}` : '-'}</td>
            <td className="border border-gray-400 px-2 py-1">{formatTime(r.jam_masuk)}</td>
            <td className="border border-gray-400 px-2 py-1">{PRESENSI_GURU_STATUS_LABELS[r.status_masuk]}</td>
            <td className="border border-gray-400 px-2 py-1">{formatTime(r.jam_pulang)}</td>
            <td className="border border-gray-400 px-2 py-1">{r.keterangan ?? '-'}</td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

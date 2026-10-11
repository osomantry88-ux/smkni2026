import { useEffect, useState } from 'react';
import {
  Users, UserCog, School, BookOpen, CalendarDays, Clock,
  TrendingUp, CheckCircle2, ArrowRight, GraduationCap,
  ClipboardList, AlertCircle, XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, type Role, type JadwalMengajar } from '@/types/database';
import Badge from '@/components/Badge';

interface Stats {
  siswa: number;
  guru: number;
  tendik: number;
  kelas: number;
  mapel: number;
  jadwalHariIni: number;
}

interface PresensiSummary {
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
}

interface ActiveTp {
  nama: string;
  semester: 'ganjil' | 'genap';
}

const HARI_MAP: Record<string, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu',
  4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const [stats, setStats] = useState<Stats>({ siswa: 0, guru: 0, tendik: 0, kelas: 0, mapel: 0, jadwalHariIni: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTp, setActiveTp] = useState<ActiveTp | null>(null);
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalMengajar[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; name: string; type: string; time: string }[]>([]);
  const [presensiSummary, setPresensiSummary] = useState<PresensiSummary>({ hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const today = new Date();
    const hariIni = HARI_MAP[today.getDay().toString()];

    const todayDate = today.toISOString().split('T')[0];

    const [s, g, k, m, tp, jadwal, recentSiswa, recentGuru, presensiRes] = await Promise.all([
      supabase.from('siswa').select('id', { count: 'exact', head: true }).eq('aktif', true),
      supabase.from('guru_tendik').select('id, jenis_ptk').eq('aktif', true),
      supabase.from('kelas').select('id', { count: 'exact', head: true }).eq('aktif', true),
      supabase.from('mata_pelajaran').select('id', { count: 'exact', head: true }).eq('aktif', true),
      supabase.from('tahun_pelajaran').select('id, nama, semester, aktif').eq('aktif', true).maybeSingle(),
      supabase
        .from('jadwal_mengajar')
        .select(`
          *,
          jam_pelajaran:jam_pelajaran_id(kode, jam_mulai, jam_selesai),
          kelas:kelas_id(nama),
          guru:guru_id(nama_lengkap),
          mata_pelajaran:mata_pelajaran_id(nama),
          ruangan:ruangan_id(nama)
        `)
        .eq('hari', hariIni)
        .eq('aktif', true)
        .order('jam_pelajaran(jam_mulai)', { ascending: true })
        .limit(10),
      supabase.from('siswa').select('id, nama_lengkap, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('guru_tendik').select('id, nama_lengkap, jenis_ptk, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('presensi_siswa').select('status_masuk').eq('tanggal', todayDate),
    ]);

    const guruCount = (g.data ?? []).filter((r: { jenis_ptk: string }) => r.jenis_ptk === 'guru').length;
    const tendikCount = (g.data ?? []).filter((r: { jenis_ptk: string }) => r.jenis_ptk === 'tendik').length;

    setStats({
      siswa: s.count ?? 0,
      guru: guruCount,
      tendik: tendikCount,
      kelas: k.count ?? 0,
      mapel: m.count ?? 0,
      jadwalHariIni: (jadwal.data ?? []).length,
    });
    setActiveTp(tp.data ? (tp.data as ActiveTp) : null);
    setJadwalHariIni((jadwal.data ?? []) as JadwalMengajar[]);

    const allActivity = [
      ...(recentSiswa.data ?? []).map((s: { id: string; nama_lengkap: string; created_at: string }) => ({
        id: s.id, name: s.nama_lengkap, type: 'Siswa', time: s.created_at,
      })),
      ...(recentGuru.data ?? []).map((g: { id: string; nama_lengkap: string; jenis_ptk: string; created_at: string }) => ({
        id: g.id, name: g.nama_lengkap, type: g.jenis_ptk === 'guru' ? 'Guru' : 'Tendik', time: g.created_at,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
    setRecentActivity(allActivity);

    const presensiData = (presensiRes.data ?? []) as { status_masuk: string }[];
    setPresensiSummary({
      hadir: presensiData.filter((p) => p.status_masuk === 'hadir').length,
      terlambat: presensiData.filter((p) => p.status_masuk === 'terlambat').length,
      izin: presensiData.filter((p) => p.status_masuk === 'izin').length,
      sakit: presensiData.filter((p) => p.status_masuk === 'sakit').length,
      alfa: presensiData.filter((p) => p.status_masuk === 'alfa').length,
    });

    setLoading(false);
  }

  function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Baru saja';
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} hari lalu`;
    return new Date(dateStr).toLocaleDateString('id-ID');
  }

  const statCards = [
    { label: 'Siswa Aktif', value: stats.siswa, icon: Users, to: '/siswa', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Guru', value: stats.guru, icon: UserCog, to: '/guru-tendik', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Tendik', value: stats.tendik, icon: UserCog, to: '/guru-tendik', iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
    { label: 'Kelas Aktif', value: stats.kelas, icon: School, to: '/kelas', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    { label: 'Mata Pelajaran', value: stats.mapel, icon: BookOpen, to: '/mata-pelajaran', iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
    { label: 'Jadwal Hari Ini', value: stats.jadwalHariIni, icon: CalendarDays, to: '/jadwal-mengajar', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-emerald-800 to-emerald-700 p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-white/5 -mr-20 -mt-20" />
        <div className="absolute right-20 bottom-0 w-40 h-40 rounded-full bg-white/5 -mb-10" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Selamat Datang, {profile?.full_name}</h1>
            <p className="mt-2 text-emerald-100 text-sm">Ringkasan data sekolah SMK NUR INSANI</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {roles.length > 0 ? (
                roles.map((r: Role) => (
                  <span key={r} className="inline-flex items-center rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-xs font-medium text-white">
                    {ROLE_LABELS[r]}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
                  Tanpa Role
                </span>
              )}
            </div>
          </div>
          {activeTp && (
            <div className="rounded-xl bg-white/15 backdrop-blur px-5 py-3">
              <p className="text-xs text-emerald-200">Tahun Pelajaran Aktif</p>
              <p className="text-lg font-semibold">{activeTp.nama}</p>
              <p className="text-xs text-emerald-200">Semester {activeTp.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition"
          >
            <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <p className="mt-3 text-2xl font-bold text-gray-800">
              {loading ? <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" /> : card.value}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jadwal Hari Ini — wider */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" />
              Jadwal Hari Ini
            </h2>
            <Link to="/jadwal-mengajar" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition">
              Lihat semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : jadwalHariIni.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarDays className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Tidak ada jadwal mengajar hari ini.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jadwalHariIni.map((j) => (
                  <div key={j.id} className="flex items-center gap-4 rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition">
                    <div className="text-center shrink-0 w-16">
                      <p className="text-sm font-semibold text-gray-800">{j.jam_pelajaran?.jam_mulai ?? '—'}</p>
                      <p className="text-[10px] text-gray-400">{j.jam_pelajaran?.jam_selesai ?? ''}</p>
                    </div>
                    <div className="w-px h-10 bg-gray-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {j.mata_pelajaran?.nama ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {j.guru?.nama_lengkap ?? '—'} · {j.kelas?.nama ?? '—'}
                      </p>
                    </div>
                    {j.ruangan?.nama && (
                      <span className="hidden sm:inline-flex text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded shrink-0">
                        {j.ruangan.nama}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aktivitas Terbaru */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              Aktivitas Terbaru
            </h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Belum ada aktivitas terbaru.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((act) => (
                  <div key={act.id} className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-50 transition">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      act.type === 'Siswa' ? 'bg-blue-50 text-blue-600' :
                      act.type === 'Guru' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-teal-50 text-teal-600'
                    }`}>
                      {act.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{act.name}</p>
                      <p className="text-xs text-gray-500">{act.type} ditambahkan</p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">{formatRelativeTime(act.time)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Presensi Hari Ini */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-700" />
            Presensi Hari Ini
          </h2>
          <Link to="/presensi" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition">
            Detail <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Hadir', value: presensiSummary.hadir, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Terlambat', value: presensiSummary.terlambat, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Izin', value: presensiSummary.izin, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Sakit', value: presensiSummary.sakit, icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
              { label: 'Alfa', value: presensiSummary.alfa, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-100 p-3 text-center">
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mx-auto`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-800">{loading ? '—' : c.value}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Akses Cepat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Siswa', icon: Users, to: '/siswa' },
            { label: 'Guru & Tendik', icon: UserCog, to: '/guru-tendik' },
            { label: 'Kelas', icon: School, to: '/kelas' },
            { label: 'Jadwal Mengajar', icon: CalendarDays, to: '/jadwal-mengajar' },
            { label: 'Presensi', icon: ClipboardList, to: '/presensi' },
            { label: 'Pengaturan Sekolah', icon: GraduationCap, to: '/pengaturan-sekolah' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 hover:border-gray-200 transition"
            >
              <link.icon className="w-6 h-6 text-emerald-600" />
              <span className="text-xs font-medium text-gray-600 text-center">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

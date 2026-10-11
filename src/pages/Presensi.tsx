import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, CalendarDays, Settings, Search, Loader2,
  CheckCircle2, Clock, AlertCircle, XCircle, FileDown, Printer,
  Save, UserCog, MapPin, Nfc, QrCode, Camera, History, ScanLine,
  Users, UserCheck, Briefcase,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import PresensiSubNav from '@/components/PresensiSubNav';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { exportToExcel, type ImportColumn } from '@/lib/importUtils';
import type {
  PresensiSiswa, PresensiSettings, PresensiStatus, PresensiMetode,
  PresensiGuruTendik, PresensiGuruStatus,
  Kelas, Jurusan, TahunPelajaran, Siswa, GuruTendik,
} from '@/types/database';
import {
  PRESENSI_STATUS_LABELS, PRESENSI_STATUS_VARIANTS, PRESENSI_METODE_LABELS,
  PRESENSI_GURU_STATUS_LABELS, PRESENSI_GURU_STATUS_VARIANTS,
} from '@/types/database';
import {
  fetchPresensiSettings, processRfidPresensi, processQrPresensi, processSelfieGpsPresensi,
  type PresensiResult,
} from '@/lib/presensi';
import {
  processRfidPresensiGuru, processQrPresensiGuru, processSelfieGpsPresensiGuru,
  type PresensiGuruResult,
} from '@/lib/presensiGuru';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

const HARI_MAP: Record<string, string> = {
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu',
  4: 'Kamis', 5: 'Jumat', 6: 'Sabtu',
};

function todayStr(): string { return new Date().toISOString().split('T')[0]; }
function formatJam(jam: string | null): string { return jam ? jam.substring(0, 5) : '—'; }

type JenisPresensi = 'siswa' | 'guru' | 'tendik';
type Tab = 'hari_ini' | 'rekap' | 'pengaturan';

export default function PresensiPage() {
  const { isAdmin, hasAnyRole } = useAuth();
  const canEdit = isAdmin();

  const [jenis, setJenis] = useState<JenisPresensi>('siswa');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam === 'rekap' || tabParam === 'pengaturan' ? tabParam : 'hari_ini';
  const setTab = useCallback((t: Tab) => {
    if (t === 'hari_ini') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: t }, { replace: true });
  }, [setSearchParams]);

  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);
  const [tpList, setTpList] = useState<TahunPelajaran[]>([]);
  const [activeTp, setActiveTp] = useState<TahunPelajaran | null>(null);

  // Siswa state
  const [presensiHariIni, setPresensiHariIni] = useState<PresensiSiswa[]>([]);
  const [loadingHariIni, setLoadingHariIni] = useState(true);
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMetode, setFilterMetode] = useState('all');
  const [searchHariIni, setSearchHariIni] = useState('');
  const [tanggalHariIni, setTanggalHariIni] = useState(todayStr());

  // Guru/Tendik state
  const [presensiGuruHariIni, setPresensiGuruHariIni] = useState<PresensiGuruTendik[]>([]);
  const [loadingGuruHariIni, setLoadingGuruHariIni] = useState(true);
  const [filterGuruStatus, setFilterGuruStatus] = useState('all');
  const [filterGuruMetode, setFilterGuruMetode] = useState('all');
  const [searchGuru, setSearchGuru] = useState('');

  // Transaction
  const [txSettings, setTxSettings] = useState<PresensiSettings | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const [txResult, setTxResult] = useState<PresensiResult | null>(null);
  const [txGuruResult, setTxGuruResult] = useState<PresensiGuruResult | null>(null);
  const [rfidInput, setRfidInput] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [selfieOpen, setSelfieOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selfieStatus, setSelfieStatus] = useState('');
  const [selfieNisn, setSelfieNisn] = useState('');
  const [selfieNip, setSelfieNip] = useState('');

  // Rekap
  const [rekapData, setRekapData] = useState<PresensiSiswa[]>([]);
  const [rekapGuruData, setRekapGuruData] = useState<PresensiGuruTendik[]>([]);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [rekapStart, setRekapStart] = useState(todayStr());
  const [rekapEnd, setRekapEnd] = useState(todayStr());
  const [rekapKelas, setRekapKelas] = useState('all');
  const [rekapStatus, setRekapStatus] = useState('all');
  const [rekapMetode, setRekapMetode] = useState('all');
  const [rekapSearch, setRekapSearch] = useState('');

  // Pengaturan
  const [presensiSettings, setPresensiSettings] = useState<PresensiSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Koreksi
  const [koreksiTarget, setKoreksiTarget] = useState<PresensiSiswa | null>(null);
  const [koreksiStatus, setKoreksiStatus] = useState<PresensiStatus>('hadir');
  const [koreksiKeterangan, setKoreksiKeterangan] = useState('');
  const [koreksiAlasan, setKoreksiAlasan] = useState('');
  const [koreksiJamMasuk, setKoreksiJamMasuk] = useState('');
  const [savingKoreksi, setSavingKoreksi] = useState(false);

  // Koreksi guru
  const [koreksiGuruTarget, setKoreksiGuruTarget] = useState<PresensiGuruTendik | null>(null);
  const [koreksiGuruStatus, setKoreksiGuruStatus] = useState<PresensiGuruStatus>('hadir');
  const [koreksiGuruKeterangan, setKoreksiGuruKeterangan] = useState('');
  const [koreksiGuruAlasan, setKoreksiGuruAlasan] = useState('');
  const [savingKoreksiGuru, setSavingKoreksiGuru] = useState(false);

  // Riwayat
  const [riwayatTarget, setRiwayatTarget] = useState<Siswa | null>(null);
  const [riwayatData, setRiwayatData] = useState<PresensiSiswa[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  useEffect(() => { fetchCommonData(); fetchTxSettings(); }, []);

  const fetchCommonData = useCallback(async () => {
    const [k, j, tp] = await Promise.all([
      supabase.from('kelas').select('*').eq('aktif', true).order('nama'),
      supabase.from('jurusan').select('*').eq('aktif', true).order('kode'),
      supabase.from('tahun_pelajaran').select('*').order('nama', { ascending: false }),
    ]);
    setKelasList((k.data ?? []) as Kelas[]);
    setJurusanList((j.data ?? []) as Jurusan[]);
    const tpData = (tp.data ?? []) as TahunPelajaran[];
    setTpList(tpData);
    setActiveTp(tpData.find((t) => t.aktif) ?? null);
  }, []);

  const fetchTxSettings = useCallback(async () => {
    setTxSettings(await fetchPresensiSettings());
  }, []);

  const fetchPresensiHariIni = useCallback(async () => {
    setLoadingHariIni(true);
    const { data } = await supabase
      .from('presensi_siswa')
      .select(`*, siswa:siswa_id(id, nama_lengkap, nis, nisn, kelas_id), kelas:kelas_id(id, nama)`)
      .eq('tanggal', tanggalHariIni)
      .order('jam_masuk', { ascending: false, nullsFirst: false });
    setPresensiHariIni((data ?? []) as PresensiSiswa[]);
    setLoadingHariIni(false);
  }, [tanggalHariIni]);

  const fetchPresensiGuruHariIni = useCallback(async () => {
    setLoadingGuruHariIni(true);
    const { data } = await supabase
      .from('presensi_guru_tendik')
      .select(`*, guru_tendik:guru_tendik_id(id, nama_lengkap, nip, jenis_ptk, jabatan, user_id), jadwal_mengajar:jadwal_mengajar_id(id, hari, kelas_id, mata_pelajaran_id, jam_pelajaran_id, kelas:kelas_id(id, nama), mata_pelajaran:mata_pelajaran_id(id, nama), jam_pelajaran:jam_pelajaran_id(id, jam_mulai, jam_selesai))`)
      .eq('tanggal', tanggalHariIni)
      .order('jam_masuk', { ascending: false, nullsFirst: false });
    setPresensiGuruHariIni((data ?? []) as PresensiGuruTendik[]);
    setLoadingGuruHariIni(false);
  }, [tanggalHariIni]);

  useEffect(() => {
    if (tab === 'hari_ini') {
      if (jenis === 'siswa') fetchPresensiHariIni();
      else fetchPresensiGuruHariIni();
    }
  }, [tab, jenis, fetchPresensiHariIni, fetchPresensiGuruHariIni]);

  const fetchRekap = useCallback(async () => {
    setLoadingRekap(true);
    if (jenis === 'siswa') {
      const { data } = await supabase
        .from('presensi_siswa')
        .select(`*, siswa:siswa_id(id, nama_lengkap, nis, nisn, kelas_id), kelas:kelas_id(id, nama)`)
        .gte('tanggal', rekapStart).lte('tanggal', rekapEnd)
        .order('tanggal', { ascending: false }).order('jam_masuk', { ascending: false, nullsFirst: false })
        .limit(5000);
      setRekapData((data ?? []) as PresensiSiswa[]);
    } else {
      const { data } = await supabase
        .from('presensi_guru_tendik')
        .select(`*, guru_tendik:guru_tendik_id(id, nama_lengkap, nip, jenis_ptk, jabatan, user_id), jadwal_mengajar:jadwal_mengajar_id(id, hari, kelas_id, mata_pelajaran_id, jam_pelajaran_id, kelas:kelas_id(id, nama), mata_pelajaran:mata_pelajaran_id(id, nama), jam_pelajaran:jam_pelajaran_id(id, jam_mulai, jam_selesai))`)
        .gte('tanggal', rekapStart).lte('tanggal', rekapEnd)
        .order('tanggal', { ascending: false }).order('jam_masuk', { ascending: false, nullsFirst: false })
        .limit(5000);
      setRekapGuruData((data ?? []) as PresensiGuruTendik[]);
    }
    setLoadingRekap(false);
  }, [rekapStart, rekapEnd, jenis]);

  useEffect(() => { if (tab === 'rekap') fetchRekap(); }, [tab, fetchRekap]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('presensi_settings').select('*').eq('id', 1).maybeSingle();
    setPresensiSettings(data as PresensiSettings | null);
  }, []);

  useEffect(() => { if (tab === 'pengaturan') fetchSettings(); }, [tab, fetchSettings]);

  // Filter siswa
  const filteredHariIni = presensiHariIni.filter((p) => {
    const matchKelas = filterKelas === 'all' || p.kelas_id === filterKelas;
    const matchStatus = filterStatus === 'all' || p.status_masuk === filterStatus;
    const matchMetode = filterMetode === 'all' || p.metode_masuk === filterMetode;
    const matchSearch = !searchHariIni ||
      (p.siswa?.nama_lengkap ?? '').toLowerCase().includes(searchHariIni.toLowerCase()) ||
      (p.siswa?.nis ?? '').includes(searchHariIni) || (p.siswa?.nisn ?? '').includes(searchHariIni);
    return matchKelas && matchStatus && matchMetode && matchSearch;
  });

  // Filter guru/tendik
  const filteredGuruHariIni = presensiGuruHariIni.filter((p) => {
    const matchJenis = jenis === 'guru' ? p.guru_tendik?.jenis_ptk === 'guru' : p.guru_tendik?.jenis_ptk === 'tendik';
    const matchStatus = filterGuruStatus === 'all' || p.status_masuk === filterGuruStatus;
    const matchMetode = filterGuruMetode === 'all' || p.metode_masuk === filterGuruMetode;
    const matchSearch = !searchGuru ||
      (p.guru_tendik?.nama_lengkap ?? '').toLowerCase().includes(searchGuru.toLowerCase()) ||
      (p.guru_tendik?.nip ?? '').includes(searchGuru);
    return matchJenis && matchStatus && matchMetode && matchSearch;
  });

  const summaryHariIni = {
    hadir: presensiHariIni.filter((p) => p.status_masuk === 'hadir').length,
    terlambat: presensiHariIni.filter((p) => p.status_masuk === 'terlambat').length,
    izin: presensiHariIni.filter((p) => p.status_masuk === 'izin').length,
    sakit: presensiHariIni.filter((p) => p.status_masuk === 'sakit').length,
    alfa: presensiHariIni.filter((p) => p.status_masuk === 'alfa').length,
  };

  const summaryGuru = {
    hadir: filteredGuruHariIni.filter((p) => p.status_masuk === 'hadir').length,
    terlambat: filteredGuruHariIni.filter((p) => p.status_masuk === 'terlambat').length,
    izin: filteredGuruHariIni.filter((p) => p.status_masuk === 'izin').length,
    sakit: filteredGuruHariIni.filter((p) => p.status_masuk === 'sakit').length,
    tugas_luar: filteredGuruHariIni.filter((p) => p.status_masuk === 'tugas_luar').length,
    cuti: filteredGuruHariIni.filter((p) => p.status_masuk === 'cuti').length,
    alfa: filteredGuruHariIni.filter((p) => p.status_masuk === 'alfa').length,
  };

  // Rekap filtering
  const filteredRekap = rekapData.filter((p) => {
    const matchKelas = rekapKelas === 'all' || p.kelas_id === rekapKelas;
    const matchStatus = rekapStatus === 'all' || p.status_masuk === rekapStatus;
    const matchMetode = rekapMetode === 'all' || p.metode_masuk === rekapMetode;
    const matchSearch = !rekapSearch ||
      (p.siswa?.nama_lengkap ?? '').toLowerCase().includes(rekapSearch.toLowerCase()) ||
      (p.siswa?.nis ?? '').includes(rekapSearch) || (p.siswa?.nisn ?? '').includes(rekapSearch);
    return matchKelas && matchStatus && matchMetode && matchSearch;
  });

  const filteredRekapGuru = rekapGuruData.filter((p) => {
    const matchJenis = jenis === 'guru' ? p.guru_tendik?.jenis_ptk === 'guru' : p.guru_tendik?.jenis_ptk === 'tendik';
    const matchStatus = rekapStatus === 'all' || p.status_masuk === rekapStatus;
    const matchMetode = rekapMetode === 'all' || p.metode_masuk === rekapMetode;
    const matchSearch = !rekapSearch ||
      (p.guru_tendik?.nama_lengkap ?? '').toLowerCase().includes(rekapSearch.toLowerCase()) ||
      (p.guru_tendik?.nip ?? '').includes(rekapSearch);
    return matchJenis && matchStatus && matchMetode && matchSearch;
  });

  function openKoreksi(p: PresensiSiswa) {
    setKoreksiTarget(p); setKoreksiStatus(p.status_masuk);
    setKoreksiKeterangan(p.keterangan ?? ''); setKoreksiAlasan('');
    setKoreksiJamMasuk(p.jam_masuk ? p.jam_masuk.substring(0, 5) : '');
  }

  function openKoreksiGuru(p: PresensiGuruTendik) {
    setKoreksiGuruTarget(p); setKoreksiGuruStatus(p.status_masuk);
    setKoreksiGuruKeterangan(p.keterangan ?? ''); setKoreksiGuruAlasan('');
  }

  async function handleSaveKoreksi() {
    if (!koreksiTarget || !koreksiAlasan.trim()) return;
    setSavingKoreksi(true);
    const updatePayload: Record<string, unknown> = {
      status_masuk: koreksiStatus, keterangan: koreksiKeterangan || null,
      dikoreksi_oleh: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    if (koreksiJamMasuk) updatePayload.jam_masuk = koreksiJamMasuk;
    const { error } = await supabase.from('presensi_siswa').update(updatePayload).eq('id', koreksiTarget.id);
    if (error) { setSavingKoreksi(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('presensi_audit_log').insert({
      presensi_id: koreksiTarget.id, siswa_id: koreksiTarget.siswa_id,
      user_id: user?.id ?? '',
      data_sebelum: { status_masuk: koreksiTarget.status_masuk, jam_masuk: koreksiTarget.jam_masuk, keterangan: koreksiTarget.keterangan },
      data_sesudah: { status_masuk: koreksiStatus, jam_masuk: koreksiJamMasuk || null, keterangan: koreksiKeterangan || null },
      alasan: koreksiAlasan,
    });
    setSavingKoreksi(false); setKoreksiTarget(null); fetchPresensiHariIni();
  }

  async function handleSaveKoreksiGuru() {
    if (!koreksiGuruTarget || !koreksiGuruAlasan.trim()) return;
    setSavingKoreksiGuru(true);
    const { error } = await supabase.from('presensi_guru_tendik').update({
      status_masuk: koreksiGuruStatus, keterangan: koreksiGuruKeterangan || null,
      dikoreksi_oleh: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', koreksiGuruTarget.id);
    setSavingKoreksiGuru(false);
    if (!error) { setKoreksiGuruTarget(null); fetchPresensiGuruHariIni(); }
  }

  async function handleSaveSettings() {
    if (!presensiSettings) return;
    setSavingSettings(true);
    const { error } = await supabase.from('presensi_settings').update({
      ...presensiSettings, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSavingSettings(false);
    if (!error) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000); fetchTxSettings(); }
  }

  function handleExportRekap() {
    if (jenis === 'siswa') {
      const cols: ImportColumn[] = [
        { key: 'tanggal', label: 'Tanggal' }, { key: 'nama', label: 'Nama Siswa' },
        { key: 'nis', label: 'NIS' }, { key: 'nisn', label: 'NISN' },
        { key: 'kelas', label: 'Kelas' }, { key: 'jam_masuk', label: 'Jam Masuk' },
        { key: 'status', label: 'Status' }, { key: 'metode', label: 'Metode' },
        { key: 'jam_pulang', label: 'Jam Pulang' }, { key: 'keterangan', label: 'Keterangan' },
      ];
      const rows = filteredRekap.map((p) => ({
        tanggal: p.tanggal, nama: p.siswa?.nama_lengkap ?? '', nis: p.siswa?.nis ?? '',
        nisn: p.siswa?.nisn ?? '', kelas: p.kelas?.nama ?? '', jam_masuk: formatJam(p.jam_masuk),
        status: PRESENSI_STATUS_LABELS[p.status_masuk],
        metode: p.metode_masuk ? PRESENSI_METODE_LABELS[p.metode_masuk] : '',
        jam_pulang: formatJam(p.jam_pulang), keterangan: p.keterangan ?? '',
      }));
      exportToExcel(rows, cols, 'Rekap Presensi Siswa');
    } else {
      const cols: ImportColumn[] = [
        { key: 'tanggal', label: 'Tanggal' }, { key: 'nama', label: 'Nama' },
        { key: 'nip', label: 'NIP' }, { key: 'jenis', label: 'Jenis' },
        { key: 'jabatan', label: 'Jabatan' }, { key: 'mata_pelajaran', label: 'Mata Pelajaran' },
        { key: 'kelas_mengajar', label: 'Kelas Mengajar' }, { key: 'jam_mengajar', label: 'Jam Mengajar' },
        { key: 'jam_masuk', label: 'Jam Masuk' },
        { key: 'status', label: 'Status' }, { key: 'metode', label: 'Metode' },
        { key: 'jam_pulang', label: 'Jam Pulang' }, { key: 'keterangan', label: 'Keterangan' },
      ];
      const rows = filteredRekapGuru.map((p) => {
        const jm = p.jadwal_mengajar as { kelas?: { nama: string } | null; mata_pelajaran?: { nama: string } | null; jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null } | null;
        return {
          tanggal: p.tanggal, nama: p.guru_tendik?.nama_lengkap ?? '', nip: p.guru_tendik?.nip ?? '',
          jenis: p.guru_tendik?.jenis_ptk === 'guru' ? 'Guru' : 'Tendik',
          jabatan: p.guru_tendik?.jabatan ?? '',
          mata_pelajaran: jm?.mata_pelajaran?.nama ?? '',
          kelas_mengajar: jm?.kelas?.nama ?? '',
          jam_mengajar: jm?.jam_pelajaran ? `${formatJam(jm.jam_pelajaran.jam_mulai)} - ${formatJam(jm.jam_pelajaran.jam_selesai)}` : '',
          jam_masuk: formatJam(p.jam_masuk),
          status: PRESENSI_GURU_STATUS_LABELS[p.status_masuk],
          metode: p.metode_masuk ? PRESENSI_METODE_LABELS[p.metode_masuk] : '',
          jam_pulang: formatJam(p.jam_pulang), keterangan: p.keterangan ?? '',
        };
      });
      exportToExcel(rows, cols, `Rekap Presensi ${jenis === 'guru' ? 'Guru' : 'Tendik'}`);
    }
  }

  async function showRiwayatSiswa(siswaId: string, namaLengkap: string) {
    setLoadingRiwayat(true);
    setRiwayatTarget({ id: siswaId, nama_lengkap: namaLengkap } as Siswa);
    const { data } = await supabase
      .from('presensi_siswa').select(`*, kelas:kelas_id(id, nama)`)
      .eq('siswa_id', siswaId).order('tanggal', { ascending: false }).limit(30);
    setRiwayatData((data ?? []) as PresensiSiswa[]);
    setLoadingRiwayat(false);
  }

  // ===== Transaction handlers =====
  async function handleRfidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rfidInput.trim() || !txSettings) return;
    setTxBusy(true); setTxResult(null); setTxGuruResult(null);
    if (jenis === 'siswa') {
      const r = await processRfidPresensi(rfidInput.trim(), txSettings);
      setTxResult(r);
      if (r.success) fetchPresensiHariIni();
    } else {
      const r = await processRfidPresensiGuru(rfidInput.trim(), txSettings);
      setTxGuruResult(r);
      if (r.success) fetchPresensiGuruHariIni();
    }
    setTxBusy(false); setRfidInput('');
  }

  async function handleQrSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qrInput.trim() || !txSettings) return;
    setTxBusy(true); setTxResult(null); setTxGuruResult(null);
    if (jenis === 'siswa') {
      const r = await processQrPresensi(qrInput.trim(), txSettings);
      setTxResult(r);
      if (r.success) fetchPresensiHariIni();
    } else {
      const r = await processQrPresensiGuru(qrInput.trim(), txSettings);
      setTxGuruResult(r);
      if (r.success) fetchPresensiGuruHariIni();
    }
    setTxBusy(false); setQrInput('');
  }

  // ===== Selfie + GPS =====
  async function startCamera() {
    setSelfieStatus('Meminta izin kamera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setSelfieStatus('');
    } catch { setSelfieStatus('Gagal mengakses kamera.'); }
  }

  function stopCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  async function handleSelfieSubmit() {
    if (!txSettings || (!selfieNisn.trim() && !selfieNip.trim())) return;
    setTxBusy(true); setTxResult(null); setTxGuruResult(null);

    let fotoPath: string | null = null;
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current, canvas = canvasRef.current;
      canvas.width = 480; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0, 480, 360);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      if (blob) {
        const fileName = `presensi-selfie/${todayStr()}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('profile-photos').upload(fileName, blob, { contentType: 'image/jpeg' });
        if (!upErr) fotoPath = fileName;
      }
    }

    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
      });
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch {
      setTxResult({ success: false, message: 'Gagal mengambil lokasi GPS.', phase: 'masuk' });
      setTxBusy(false); return;
    }
    if (lat == null || lng == null) { setTxResult({ success: false, message: 'Gagal mengambil GPS.', phase: 'masuk' }); setTxBusy(false); return; }

    if (jenis === 'siswa') {
      const r = await processSelfieGpsPresensi(selfieNisn.trim(), txSettings, lat, lng, fotoPath);
      setTxResult(r);
      if (r.success) fetchPresensiHariIni();
    } else {
      const r = await processSelfieGpsPresensiGuru(selfieNip.trim(), txSettings, lat, lng, fotoPath);
      setTxGuruResult(r);
      if (r.success) fetchPresensiGuruHariIni();
    }
    setTxBusy(false); setSelfieNisn(''); setSelfieNip('');
    stopCamera(); setSelfieOpen(false);
  }

  useEffect(() => { return () => { stopCamera(); }; }, []);

  const jenisButtons: { id: JenisPresensi; label: string; icon: typeof Users }[] = [
    { id: 'siswa', label: 'Siswa', icon: Users },
    { id: 'guru', label: 'Guru', icon: UserCheck },
    { id: 'tendik', label: 'Tendik', icon: Briefcase },
  ];

  const availableMethods: string[] = [];
  if (txSettings?.metode_rfid_aktif) availableMethods.push('rfid');
  if (txSettings?.metode_qr_aktif) availableMethods.push('qr');
  if (txSettings?.metode_selfie_aktif) availableMethods.push('selfie_gps');

  // Combined result display
  const currentResult = jenis === 'siswa' ? txResult : null;
  const currentGuruResult = jenis !== 'siswa' ? txGuruResult : null;

  const siswaSummaryCards = [
    { label: 'Hadir', value: summaryHariIni.hadir, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Terlambat', value: summaryHariIni.terlambat, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Izin', value: summaryHariIni.izin, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Sakit', value: summaryHariIni.sakit, icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: 'Alfa', value: summaryHariIni.alfa, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const guruSummaryCards = [
    { label: 'Hadir', value: summaryGuru.hadir, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Terlambat', value: summaryGuru.terlambat, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Izin', value: summaryGuru.izin, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Sakit', value: summaryGuru.sakit, color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: 'Tugas Luar', value: summaryGuru.tugas_luar, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Cuti', value: summaryGuru.cuti, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Alfa', value: summaryGuru.alfa, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-700" />
            Presensi
          </h1>
          <p className="mt-1 text-sm text-gray-500">Kelola presensi siswa, guru, dan tendik — harian, rekap, dan pengaturan</p>
        </div>

        {/* Jenis Presensi selector */}
        <div className="flex flex-wrap gap-2">
          {jenisButtons.map((jb) => (
            <button key={jb.id} onClick={() => { setJenis(jb.id); setTxResult(null); setTxGuruResult(null); }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                jenis === jb.id ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <jb.icon className="w-4 h-4" /> {jb.label}
            </button>
          ))}
        </div>

        {/* Sub-navigation */}
        <PresensiSubNav />

        {/* =================== TAB: HARI INI =================== */}
        {tab === 'hari_ini' && (
          <div className="space-y-5">
            {/* Transaction Area */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-emerald-700" />
                Transaksi Presensi {jenis === 'siswa' ? 'Siswa' : jenis === 'guru' ? 'Guru' : 'Tendik'}
              </h2>
              {availableMethods.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Semua metode presensi dinonaktifkan. Aktifkan di Pengaturan Presensi.</p>
              ) : (
                <>
                  {/* Method buttons */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {txSettings?.metode_rfid_aktif && (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4">
                        <Nfc className="w-6 h-6 text-emerald-700" /><span className="text-sm font-medium text-gray-700">RFID</span>
                      </div>
                    )}
                    {txSettings?.metode_qr_aktif && (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4">
                        <QrCode className="w-6 h-6 text-emerald-700" /><span className="text-sm font-medium text-gray-700">QR Code</span>
                      </div>
                    )}
                    {txSettings?.metode_selfie_aktif && (
                      <button onClick={() => { setSelfieOpen(true); setTxResult(null); setTxGuruResult(null); startCamera(); }}
                        className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 transition hover:border-emerald-600 hover:bg-emerald-50">
                        <Camera className="w-6 h-6 text-emerald-700" /><span className="text-sm font-medium text-gray-700">Selfie + GPS</span>
                      </button>
                    )}
                  </div>

                  {/* RFID input */}
                  {txSettings?.metode_rfid_aktif && (
                    <form onSubmit={handleRfidSubmit} className="mb-3">
                      <label className={labelCls}>Scan / Input RFID</label>
                      <div className="flex gap-2">
                        <input type="text" value={rfidInput} onChange={(e) => setRfidInput(e.target.value)}
                          placeholder="Tempel kartu RFID atau ketik nomor..." className={`${inputCls} font-mono`} disabled={txBusy} autoFocus />
                        <button type="submit" disabled={txBusy || !rfidInput.trim()}
                          className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60 whitespace-nowrap">
                          {txBusy ? 'Memproses...' : 'Proses'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* QR input */}
                  {txSettings?.metode_qr_aktif && (
                    <form onSubmit={handleQrSubmit} className="mb-3">
                      <label className={labelCls}>{jenis === 'siswa' ? 'Scan / Input NISN (QR Code)' : 'Scan / Input NIP (QR Code)'}</label>
                      <div className="flex gap-2">
                        <input type="text" value={qrInput} onChange={(e) => setQrInput(e.target.value)}
                          placeholder={jenis === 'siswa' ? 'Scan QR atau ketik NISN...' : 'Scan QR atau ketik NIP...'}
                          className={`${inputCls} font-mono`} disabled={txBusy} />
                        <button type="submit" disabled={txBusy || !qrInput.trim()}
                          className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60 whitespace-nowrap">
                          {txBusy ? 'Memproses...' : 'Proses'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Result display — siswa */}
                  {currentResult && (
                    <div className={`rounded-xl border p-4 mt-3 ${currentResult.success ? currentResult.status === 'terlambat' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-start gap-3">
                        {currentResult.success ? (currentResult.status === 'terlambat' ? <Clock className="w-6 h-6 text-amber-600 shrink-0" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />) : <XCircle className="w-6 h-6 text-red-600 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${currentResult.success ? currentResult.status === 'terlambat' ? 'text-amber-800' : 'text-emerald-800' : 'text-red-800'}`}>{currentResult.message}</p>
                          {currentResult.siswa && (
                            <div className="mt-2 text-sm text-gray-700 space-y-0.5">
                              <p><span className="text-gray-500">Nama:</span> <span className="font-medium">{currentResult.siswa.nama_lengkap}</span></p>
                              <p><span className="text-gray-500">Kelas:</span> {currentResult.kelas?.nama ?? '—'}</p>
                              <p><span className="text-gray-500">Jam:</span> <span className="font-mono">{currentResult.jam}</span></p>
                              {currentResult.status && <p><span className="text-gray-500">Status:</span> <span className="font-medium">{PRESENSI_STATUS_LABELS[currentResult.status]}</span></p>}
                              {currentResult.metode && <p><span className="text-gray-500">Metode:</span> {PRESENSI_METODE_LABELS[currentResult.metode]}</p>}
                              <p><span className="text-gray-500">Fase:</span> {currentResult.phase === 'masuk' ? 'Masuk' : 'Pulang'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result display — guru/tendik */}
                  {currentGuruResult && (
                    <div className={`rounded-xl border p-4 mt-3 ${currentGuruResult.success ? currentGuruResult.status === 'terlambat' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-start gap-3">
                        {currentGuruResult.success ? (currentGuruResult.status === 'terlambat' ? <Clock className="w-6 h-6 text-amber-600 shrink-0" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />) : <XCircle className="w-6 h-6 text-red-600 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${currentGuruResult.success ? currentGuruResult.status === 'terlambat' ? 'text-amber-800' : 'text-emerald-800' : 'text-red-800'}`}>{currentGuruResult.message}</p>
                          {currentGuruResult.guru && (
                            <div className="mt-2 text-sm text-gray-700 space-y-0.5">
                              <p><span className="text-gray-500">Nama:</span> <span className="font-medium">{currentGuruResult.guru.nama_lengkap}</span></p>
                              <p><span className="text-gray-500">NIP:</span> {currentGuruResult.guru.nip ?? '—'}</p>
                              <p><span className="text-gray-500">Jam:</span> <span className="font-mono">{currentGuruResult.jam}</span></p>
                              {currentGuruResult.status && <p><span className="text-gray-500">Status:</span> <span className="font-medium">{PRESENSI_GURU_STATUS_LABELS[currentGuruResult.status]}</span></p>}
                              <p><span className="text-gray-500">Fase:</span> {currentGuruResult.phase === 'masuk' ? 'Masuk' : 'Pulang'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Date + TP info */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <input type="date" value={tanggalHariIni} onChange={(e) => setTanggalHariIni(e.target.value)} className={`${inputCls} max-w-[180px]`} />
                <span className="text-sm text-gray-500">{HARI_MAP[new Date(tanggalHariIni + 'T00:00:00').getDay().toString()]}</span>
              </div>
              {activeTp && <div className="text-sm text-gray-500">TP: <span className="font-medium text-gray-700">{activeTp.nama}</span> — {activeTp.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</div>}
            </div>

            {/* Summary cards */}
            {jenis === 'siswa' ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {siswaSummaryCards.map((c) => (
                  <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}><c.icon className={`w-5 h-5 ${c.color}`} /></div>
                    <p className="mt-2 text-2xl font-bold text-gray-800">{loadingHariIni ? '—' : c.value}</p>
                    <p className="text-xs text-gray-500">{c.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
                {guruSummaryCards.map((c) => (
                  <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><CheckCircle2 className={`w-4 h-4 ${c.color}`} /></div>
                    <p className="mt-1.5 text-xl font-bold text-gray-800">{loadingGuruHariIni ? '—' : c.value}</p>
                    <p className="text-[11px] text-gray-500">{c.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            {jenis === 'siswa' ? (
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchHariIni} onChange={(e) => setSearchHariIni(e.target.value)} placeholder="Cari nama, NIS, NISN..." className={`${inputCls} pl-10`} />
                </div>
                <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className={`${inputCls} max-w-[150px]`}>
                  <option value="all">Semua Kelas</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`${inputCls} max-w-[130px]`}>
                  <option value="all">Semua Status</option>
                  <option value="hadir">Hadir</option><option value="terlambat">Terlambat</option>
                  <option value="izin">Izin</option><option value="sakit">Sakit</option><option value="alfa">Alfa</option>
                </select>
                <select value={filterMetode} onChange={(e) => setFilterMetode(e.target.value)} className={`${inputCls} max-w-[140px]`}>
                  <option value="all">Semua Metode</option>
                  <option value="rfid">RFID</option><option value="qr">QR Code</option>
                  <option value="selfie_gps">Selfie + GPS</option><option value="manual">Manual</option>
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchGuru} onChange={(e) => setSearchGuru(e.target.value)} placeholder="Cari nama, NIP..." className={`${inputCls} pl-10`} />
                </div>
                <select value={filterGuruStatus} onChange={(e) => setFilterGuruStatus(e.target.value)} className={`${inputCls} max-w-[150px]`}>
                  <option value="all">Semua Status</option>
                  <option value="hadir">Hadir</option><option value="terlambat">Terlambat</option>
                  <option value="izin">Izin</option><option value="sakit">Sakit</option>
                  <option value="tugas_luar">Tugas Luar</option><option value="cuti">Cuti</option><option value="alfa">Alfa</option>
                </select>
                <select value={filterGuruMetode} onChange={(e) => setFilterGuruMetode(e.target.value)} className={`${inputCls} max-w-[140px]`}>
                  <option value="all">Semua Metode</option>
                  <option value="rfid">RFID</option><option value="qr">QR Code</option>
                  <option value="selfie_gps">Selfie + GPS</option><option value="manual">Manual</option>
                </select>
              </div>
            )}

            {/* Table — siswa */}
            {jenis === 'siswa' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">No</th><th className="px-4 py-3">Nama Siswa</th>
                        <th className="px-4 py-3 hidden sm:table-cell">NIS</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Kelas</th>
                        <th className="px-4 py-3">Jam Masuk</th><th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Metode</th>
                        <th className="px-4 py-3 hidden md:table-cell">Jam Pulang</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingHariIni ? (
                        <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</td></tr>
                      ) : filteredHariIni.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400"><ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />Belum ada data presensi.</td></tr>
                      ) : filteredHariIni.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.siswa?.nama_lengkap ?? '—'}</td>
                          <td className="px-4 py-3 hidden sm:table-cell font-mono text-gray-600">{p.siswa?.nis ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{p.kelas?.nama ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{formatJam(p.jam_masuk)}</td>
                          <td className="px-4 py-3"><Badge variant={PRESENSI_STATUS_VARIANTS[p.status_masuk]}>{PRESENSI_STATUS_LABELS[p.status_masuk]}</Badge></td>
                          <td className="px-4 py-3 hidden xl:table-cell text-gray-600">{p.metode_masuk ? PRESENSI_METODE_LABELS[p.metode_masuk] : '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600 font-mono">{formatJam(p.jam_pulang)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => showRiwayatSiswa(p.siswa_id, p.siswa?.nama_lengkap ?? '')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Riwayat"><History className="w-4 h-4" /></button>
                              {canEdit && <button onClick={() => openKoreksi(p)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Koreksi"><UserCog className="w-4 h-4" /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Table — guru/tendik */}
            {jenis !== 'siswa' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">No</th>
                        <th className="px-4 py-3">Nama</th>
                        <th className="px-4 py-3 hidden sm:table-cell">NIP</th>
                        <th className="px-4 py-3 hidden md:table-cell">Jabatan</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Mata Pelajaran</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Kelas</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Jam Mengajar</th>
                        <th className="px-4 py-3">Jam Masuk</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Metode</th>
                        <th className="px-4 py-3 hidden md:table-cell">Jam Pulang</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingGuruHariIni ? (
                        <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</td></tr>
                      ) : filteredGuruHariIni.length === 0 ? (
                        <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400"><ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />Belum ada data presensi.</td></tr>
                      ) : filteredGuruHariIni.map((p, idx) => {
                        const jm = p.jadwal_mengajar as { kelas?: { nama: string } | null; mata_pelajaran?: { nama: string } | null; jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null } | null;
                        return (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.guru_tendik?.nama_lengkap ?? '—'}</td>
                          <td className="px-4 py-3 hidden sm:table-cell font-mono text-gray-600">{p.guru_tendik?.nip ?? '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600">{p.guru_tendik?.jabatan ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{jm?.mata_pelajaran?.nama ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{jm?.kelas?.nama ?? '—'}</td>
                          <td className="px-4 py-3 hidden xl:table-cell text-gray-600 whitespace-nowrap font-mono">{jm?.jam_pelajaran ? `${formatJam(jm.jam_pelajaran.jam_mulai)} - ${formatJam(jm.jam_pelajaran.jam_selesai)}` : '—'}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{formatJam(p.jam_masuk)}</td>
                          <td className="px-4 py-3"><Badge variant={PRESENSI_GURU_STATUS_VARIANTS[p.status_masuk]}>{PRESENSI_GURU_STATUS_LABELS[p.status_masuk]}</Badge></td>
                          <td className="px-4 py-3 hidden xl:table-cell text-gray-600">{p.metode_masuk ? PRESENSI_METODE_LABELS[p.metode_masuk] : '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600 font-mono">{formatJam(p.jam_pulang)}</td>
                          <td className="px-4 py-3">
                            {canEdit && <button onClick={() => openKoreksiGuru(p)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Koreksi"><UserCog className="w-4 h-4" /></button>}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== TAB: REKAP =================== */}
        {tab === 'rekap' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div><label className={labelCls}>Dari Tanggal</label><input type="date" value={rekapStart} onChange={(e) => setRekapStart(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Sampai Tanggal</label><input type="date" value={rekapEnd} onChange={(e) => setRekapEnd(e.target.value)} className={inputCls} /></div>
              {jenis === 'siswa' && (
                <select value={rekapKelas} onChange={(e) => setRekapKelas(e.target.value)} className={`${inputCls} max-w-[150px]`}>
                  <option value="all">Semua Kelas</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              )}
              <select value={rekapStatus} onChange={(e) => setRekapStatus(e.target.value)} className={`${inputCls} max-w-[140px]`}>
                <option value="all">Semua Status</option>
                {jenis === 'siswa' ? (<>
                  <option value="hadir">Hadir</option><option value="terlambat">Terlambat</option>
                  <option value="izin">Izin</option><option value="sakit">Sakit</option><option value="alfa">Alfa</option>
                </>) : (<>
                  <option value="hadir">Hadir</option><option value="terlambat">Terlambat</option>
                  <option value="izin">Izin</option><option value="sakit">Sakit</option>
                  <option value="tugas_luar">Tugas Luar</option><option value="cuti">Cuti</option><option value="alfa">Alfa</option>
                </>)}
              </select>
              <select value={rekapMetode} onChange={(e) => setRekapMetode(e.target.value)} className={`${inputCls} max-w-[140px]`}>
                <option value="all">Semua Metode</option>
                <option value="rfid">RFID</option><option value="qr">QR Code</option>
                <option value="selfie_gps">Selfie + GPS</option><option value="manual">Manual</option>
              </select>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={rekapSearch} onChange={(e) => setRekapSearch(e.target.value)} placeholder="Cari nama..." className={`${inputCls} pl-10`} />
              </div>
              <button onClick={handleExportRekap} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"><FileDown className="w-4 h-4" /> Export</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"><Printer className="w-4 h-4" /> Cetak</button>
            </div>

            {/* Rekap table — siswa */}
            {jenis === 'siswa' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Nama Siswa</th>
                        <th className="px-4 py-3 hidden sm:table-cell">NIS</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Kelas</th>
                        <th className="px-4 py-3">Jam Masuk</th><th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Metode</th>
                        <th className="px-4 py-3 hidden md:table-cell">Jam Pulang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingRekap ? (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /> Memuat...</td></tr>
                      ) : filteredRekap.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada data.</td></tr>
                      ) : filteredRekap.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(p.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.siswa?.nama_lengkap ?? '—'}</td>
                          <td className="px-4 py-3 hidden sm:table-cell font-mono text-gray-600">{p.siswa?.nis ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{p.kelas?.nama ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{formatJam(p.jam_masuk)}</td>
                          <td className="px-4 py-3"><Badge variant={PRESENSI_STATUS_VARIANTS[p.status_masuk]}>{PRESENSI_STATUS_LABELS[p.status_masuk]}</Badge></td>
                          <td className="px-4 py-3 hidden xl:table-cell text-gray-600">{p.metode_masuk ? PRESENSI_METODE_LABELS[p.metode_masuk] : '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600 font-mono">{formatJam(p.jam_pulang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rekap table — guru/tendik */}
            {jenis !== 'siswa' && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Nama</th>
                        <th className="px-4 py-3 hidden sm:table-cell">NIP</th>
                        <th className="px-4 py-3 hidden md:table-cell">Jabatan</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Mata Pelajaran</th>
                        <th className="px-4 py-3 hidden lg:table-cell">Kelas</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Jam Mengajar</th>
                        <th className="px-4 py-3">Jam Masuk</th><th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Metode</th>
                        <th className="px-4 py-3 hidden md:table-cell">Jam Pulang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingRekap ? (
                        <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /> Memuat...</td></tr>
                      ) : filteredRekapGuru.length === 0 ? (
                        <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Tidak ada data.</td></tr>
                      ) : filteredRekapGuru.map((p) => {
                        const jm = p.jadwal_mengajar as { kelas?: { nama: string } | null; mata_pelajaran?: { nama: string } | null; jam_pelajaran?: { jam_mulai: string; jam_selesai: string } | null } | null;
                        return (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(p.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{p.guru_tendik?.nama_lengkap ?? '—'}</td>
                          <td className="px-4 py-3 hidden sm:table-cell font-mono text-gray-600">{p.guru_tendik?.nip ?? '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600">{p.guru_tendik?.jabatan ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{jm?.mata_pelajaran?.nama ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{jm?.kelas?.nama ?? '—'}</td>
                          <td className="px-4 py-3 hidden xl:table-cell text-gray-600 whitespace-nowrap font-mono">{jm?.jam_pelajaran ? `${formatJam(jm.jam_pelajaran.jam_mulai)} - ${formatJam(jm.jam_pelajaran.jam_selesai)}` : '—'}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{formatJam(p.jam_masuk)}</td>
                          <td className="px-4 py-3"><Badge variant={PRESENSI_GURU_STATUS_VARIANTS[p.status_masuk]}>{PRESENSI_GURU_STATUS_LABELS[p.status_masuk]}</Badge></td>
                          <td className="px-4 py-3 hidden xl:table-cell text-gray-600">{p.metode_masuk ? PRESENSI_METODE_LABELS[p.metode_masuk] : '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600 font-mono">{formatJam(p.jam_pulang)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== TAB: PENGATURAN =================== */}
        {tab === 'pengaturan' && (
          <div className="space-y-5">
            {!canEdit && <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">Hanya Admin/Super Admin yang dapat mengubah pengaturan presensi.</div>}
            {presensiSettings && (
              <>
                {/* Metode Presensi */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Metode Presensi</h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.metode_rfid_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, metode_rfid_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <div className="flex items-center gap-2"><Nfc className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">RFID / IoT</span></div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.metode_qr_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, metode_qr_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <div className="flex items-center gap-2"><QrCode className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">QR Code</span></div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.metode_selfie_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, metode_selfie_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <div className="flex items-center gap-2"><Camera className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-700">Selfie + GPS</span></div>
                    </label>
                  </div>
                </section>

                {/* Jenis Presensi */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Jenis Presensi</h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.presensi_masuk_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, presensi_masuk_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Presensi Siswa Aktif</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.presensi_guru_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, presensi_guru_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Presensi Guru Aktif</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.presensi_tendik_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, presensi_tendik_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Presensi Tendik Aktif</span>
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Waktu presensi siswa & tendik mengikuti Shift Presensi. Guru mengikuti Jadwal Mengajar. Tidak ada pengaturan jam terpisah di sini.</p>
                </section>

                {/* Presensi Masuk & Pulang */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Presensi Masuk & Pulang</h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.presensi_masuk_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, presensi_masuk_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Presensi Masuk Aktif</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.presensi_pulang_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, presensi_pulang_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Presensi Pulang Aktif</span>
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Waktu presensi pulang mengikuti Shift Presensi (siswa/tendik) atau Jadwal Mengajar (guru). Tidak ada pengaturan jam terpisah di sini.</p>
                </section>

                {/* Anti Duplikasi */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Anti Duplikasi</h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.anti_duplikasi_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, anti_duplikasi_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Aktifkan Anti Duplikasi</span>
                    </label>
                    <div className="max-w-[200px]"><label className={labelCls}>Batas Waktu Duplikasi (menit)</label>
                      <input type="number" min={0} value={presensiSettings.batas_duplikasi_menit} disabled={!canEdit || !presensiSettings.anti_duplikasi_aktif} onChange={(e) => setPresensiSettings({ ...presensiSettings, batas_duplikasi_menit: e.target.value ? parseInt(e.target.value, 10) : 1 })} className={inputCls} />
                    </div>
                  </div>
                </section>

                {/* Aturan Alfa */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Aturan Alfa Otomatis</h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={presensiSettings.auto_alfa_aktif} disabled={!canEdit} onChange={(e) => setPresensiSettings({ ...presensiSettings, auto_alfa_aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm font-medium text-gray-700">Tetapkan Alfa otomatis</span>
                    </label>
                    <p className="text-xs text-gray-400">Alfa tidak ditetapkan pada hari libur atau hari tidak efektif (sesuai Kalender Pendidikan).</p>
                    <div className="max-w-[200px]"><label className={labelCls}>Batas Waktu Alfa (menit setelah jam masuk)</label>
                      <input type="number" min={1} value={presensiSettings.batas_alfa_menit} disabled={!canEdit || !presensiSettings.auto_alfa_aktif} onChange={(e) => setPresensiSettings({ ...presensiSettings, batas_alfa_menit: e.target.value ? parseInt(e.target.value, 10) : 30 })} className={inputCls} />
                    </div>
                  </div>
                </section>

                {/* Lokasi Sekolah */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2"><MapPin className="w-5 h-5 text-emerald-600" /> Lokasi Sekolah</h2>
                  <p className="text-sm text-gray-500">Lokasi dan radius presensi sekolah diatur di Pengaturan Sekolah. Pastikan koordinat dan radius telah diatur untuk metode Selfie + GPS.</p>
                </section>

                {canEdit && (
                  <div className="flex justify-end">
                    <button onClick={handleSaveSettings} disabled={savingSettings} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60">
                      {savingSettings ? 'Menyimpan...' : settingsSaved ? (<><CheckCircle2 className="w-4 h-4" /> Tersimpan</>) : (<><Save className="w-4 h-4" /> Simpan Pengaturan</>)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Selfie + GPS Modal */}
        <Modal open={selfieOpen} onClose={() => { setSelfieOpen(false); stopCamera(); }} title="Presensi Selfie + GPS" size="md">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{jenis === 'siswa' ? 'NISN Siswa' : 'NIP Guru/Tendik'}</label>
              <input type="text" value={jenis === 'siswa' ? selfieNisn : selfieNip} onChange={(e) => jenis === 'siswa' ? setSelfieNisn(e.target.value) : setSelfieNip(e.target.value)} placeholder={jenis === 'siswa' ? 'Masukkan NISN...' : 'Masukkan NIP...'} className={`${inputCls} font-mono`} />
            </div>
            <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {selfieStatus && <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-black/50">{selfieStatus}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setSelfieOpen(false); stopCamera(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
              <button type="button" onClick={handleSelfieSubmit} disabled={txBusy || (jenis === 'siswa' ? !selfieNisn.trim() : !selfieNip.trim())} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{txBusy ? 'Memproses...' : 'Ambil Foto & Presensi'}</button>
            </div>
          </div>
        </Modal>

        {/* Koreksi Modal — siswa */}
        <Modal open={!!koreksiTarget} onClose={() => setKoreksiTarget(null)} title="Koreksi Presensi Siswa" size="md">
          {koreksiTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{koreksiTarget.siswa?.nama_lengkap}</p>
                <p className="text-xs text-gray-500">{koreksiTarget.kelas?.nama ?? '—'} · {new Date(koreksiTarget.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Status</label><select value={koreksiStatus} onChange={(e) => setKoreksiStatus(e.target.value as PresensiStatus)} className={inputCls}><option value="hadir">Hadir</option><option value="terlambat">Terlambat</option><option value="izin">Izin</option><option value="sakit">Sakit</option><option value="alfa">Alfa</option></select></div>
                <div><label className={labelCls}>Jam Masuk</label><input type="time" value={koreksiJamMasuk} onChange={(e) => setKoreksiJamMasuk(e.target.value)} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Keterangan</label><textarea value={koreksiKeterangan} onChange={(e) => setKoreksiKeterangan(e.target.value)} rows={2} className={inputCls} /></div>
              <div><label className={labelCls}>Alasan Koreksi *</label><textarea value={koreksiAlasan} onChange={(e) => setKoreksiAlasan(e.target.value)} rows={2} className={inputCls} placeholder="Wajib diisi..." /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setKoreksiTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
                <button type="button" onClick={handleSaveKoreksi} disabled={savingKoreksi || !koreksiAlasan.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{savingKoreksi ? 'Menyimpan...' : 'Simpan Koreksi'}</button>
              </div>
            </div>
          )}
        </Modal>

        {/* Koreksi Modal — guru/tendik */}
        <Modal open={!!koreksiGuruTarget} onClose={() => setKoreksiGuruTarget(null)} title="Koreksi Presensi Guru/Tendik" size="md">
          {koreksiGuruTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{koreksiGuruTarget.guru_tendik?.nama_lengkap}</p>
                <p className="text-xs text-gray-500">{koreksiGuruTarget.guru_tendik?.jabatan ?? '—'} · {new Date(koreksiGuruTarget.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              <div><label className={labelCls}>Status</label><select value={koreksiGuruStatus} onChange={(e) => setKoreksiGuruStatus(e.target.value as PresensiGuruStatus)} className={inputCls}>
                <option value="hadir">Hadir</option><option value="terlambat">Terlambat</option><option value="izin">Izin</option><option value="sakit">Sakit</option><option value="tugas_luar">Tugas Luar</option><option value="cuti">Cuti</option><option value="alfa">Alfa</option>
              </select></div>
              <div><label className={labelCls}>Keterangan</label><textarea value={koreksiGuruKeterangan} onChange={(e) => setKoreksiGuruKeterangan(e.target.value)} rows={2} className={inputCls} /></div>
              <div><label className={labelCls}>Alasan Koreksi *</label><textarea value={koreksiGuruAlasan} onChange={(e) => setKoreksiGuruAlasan(e.target.value)} rows={2} className={inputCls} placeholder="Wajib diisi..." /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setKoreksiGuruTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
                <button type="button" onClick={handleSaveKoreksiGuru} disabled={savingKoreksiGuru || !koreksiGuruAlasan.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">{savingKoreksiGuru ? 'Menyimpan...' : 'Simpan Koreksi'}</button>
              </div>
            </div>
          )}
        </Modal>

        {/* Riwayat Modal */}
        <Modal open={!!riwayatTarget} onClose={() => setRiwayatTarget(null)} title="Riwayat Presensi Siswa" size="lg">
          {riwayatTarget && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-800">{riwayatTarget.nama_lengkap}</div>
              {loadingRiwayat ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-emerald-600 animate-spin" /></div>
              ) : riwayatData.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Belum ada riwayat presensi.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Masuk</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Pulang</th><th className="px-3 py-2 hidden sm:table-cell">Metode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {riwayatData.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(r.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{formatJam(r.jam_masuk)}</td>
                          <td className="px-3 py-2"><Badge variant={PRESENSI_STATUS_VARIANTS[r.status_masuk]}>{PRESENSI_STATUS_LABELS[r.status_masuk]}</Badge></td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{formatJam(r.jam_pulang)}</td>
                          <td className="px-3 py-2 hidden sm:table-cell text-gray-600">{r.metode_masuk ? PRESENSI_METODE_LABELS[r.metode_masuk] : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}

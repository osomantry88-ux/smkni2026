import { useEffect, useState, useCallback, type ChangeEvent } from 'react';
import {
  MessageSquare, Bell, Save, Check, TestTube2, Loader2, Eye, EyeOff,
  Shield, Clock, Calendar, Send, FileText, History, Filter, AlertCircle,
  Pause, Play, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  WhatsAppSettings, NotificationSettings, NotificationTemplate,
  NotificationLog, NotificationTemplateType, WhatsAppProvider,
} from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

const PROVIDER_OPTIONS: { value: WhatsAppProvider; label: string }[] = [
  { value: 'fonnte', label: 'Fonnte' },
  { value: 'onesender', label: 'OneSender' },
  { value: 'wablas', label: 'Wablas' },
  { value: 'custom', label: 'Custom API' },
];

const PROVIDER_DEFAULT_URLS: Record<WhatsAppProvider, string> = {
  fonnte: 'https://api.fonnte.com',
  onesender: 'https://api.onesender.id',
  wablas: 'https://api.wablas.com',
  custom: '',
};

const TEMPLATE_VARIABLES = [
  '{nama_siswa}', '{nis}', '{nisn}', '{kelas}', '{tanggal}', '{jam}',
  '{status}', '{nama_sekolah}', '{nama_orang_tua}', '{keterangan}',
  '{nama_guru}', '{mata_pelajaran}',
];

const PENGINGAT_MENIT_OPTIONS = [5, 10, 15, 30, 60];

const PENERIMA_OPTIONS = [
  { value: 'ayah', label: 'Ayah' },
  { value: 'ibu', label: 'Ibu' },
  { value: 'wali', label: 'Wali' },
  { value: 'semua', label: 'Semua nomor yang tersedia' },
];

const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const TEMPLATE_TYPES: { value: NotificationTemplateType; label: string }[] = [
  { value: 'hadir_siswa', label: 'Hadir Siswa' },
  { value: 'pulang_siswa', label: 'Pulang Siswa' },
  { value: 'terlambat_siswa', label: 'Terlambat Siswa' },
  { value: 'izin_siswa', label: 'Izin Siswa' },
  { value: 'sakit_siswa', label: 'Sakit Siswa' },
  { value: 'alfa_siswa', label: 'Alfa Siswa' },
  { value: 'pengingat_jadwal_guru', label: 'Pengingat Jadwal Guru' },
  { value: 'guru_belum_presensi', label: 'Guru Belum Presensi' },
];

type TabId = 'provider' | 'notifikasi' | 'template' | 'jadwal' | 'riwayat';

export default function WhatsAppNotifikasiPage() {
  const { isAdmin, hasAnyRole, session } = useAuth();
  const canEdit = isAdmin();
  const canView = isAdmin() || hasAnyRole('kepala_sekolah');

  const [waSettings, setWaSettings] = useState<WhatsAppSettings | null>(null);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tokenInput, setTokenInput] = useState('');
  const [tokenChanged, setTokenChanged] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testSendNumber, setTestSendNumber] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Log filters
  const [logFilterTipe, setLogFilterTipe] = useState('');
  const [logFilterChannel, setLogFilterChannel] = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState('');
  const [logFilterDate, setLogFilterDate] = useState('');
  const [logFilterKelas, setLogFilterKelas] = useState('');
  const [logPage, setLogPage] = useState(0);
  const LOG_PER_PAGE = 10;

  const [activeTab, setActiveTab] = useState<TabId>('provider');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [waRes, notifRes, tplRes] = await Promise.all([
      supabase.from('whatsapp_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('notification_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('notification_templates').select('*').order('tipe'),
    ]);

    if (waRes.error) { setError('Gagal memuat pengaturan WhatsApp: ' + waRes.error.message); setLoading(false); return; }
    if (notifRes.error) { setError('Gagal memuat pengaturan notifikasi: ' + notifRes.error.message); setLoading(false); return; }
    if (tplRes.error) { setError('Gagal memuat template: ' + tplRes.error.message); setLoading(false); return; }

    const waData = waRes.data as WhatsAppSettings | null;
    setWaSettings(waData);
    setHasToken(waData?.status_koneksi !== 'untested' || !!waData?.api_token);
    setNotifSettings(notifRes.data as NotificationSettings | null);
    setTemplates((tplRes.data ?? []) as NotificationTemplate[]);
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async () => {
    let query = supabase.from('notification_log').select('*', { count: 'exact' }).order('tanggal_waktu', { ascending: false });
    if (logFilterTipe) query = query.eq('tipe', logFilterTipe);
    if (logFilterChannel) query = query.eq('channel', logFilterChannel);
    if (logFilterStatus) query = query.eq('status', logFilterStatus);
    if (logFilterKelas) query = query.ilike('kelas', `%${logFilterKelas}%`);
    if (logFilterDate) query = query.gte('tanggal_waktu', `${logFilterDate}T00:00:00`).lte('tanggal_waktu', `${logFilterDate}T23:59:59`);
    query = query.range(logPage * LOG_PER_PAGE, (logPage + 1) * LOG_PER_PAGE - 1);
    const { data, error: err, count } = await query;
    if (err) { setError('Gagal memuat riwayat: ' + err.message); return; }
    setLogs((data ?? []) as NotificationLog[]);
    setLogCount(count ?? 0);
  }, [logFilterTipe, logFilterChannel, logFilterStatus, logFilterDate, logFilterKelas, logPage]);

  useEffect(() => {
    if (activeTab === 'riwayat') fetchLogs();
  }, [activeTab, fetchLogs]);

  function updateWa<K extends keyof WhatsAppSettings>(key: K, value: WhatsAppSettings[K]) {
    if (!waSettings) return;
    setWaSettings({ ...waSettings, [key]: value });
  }

  function updateNotif<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    if (!notifSettings) return;
    setNotifSettings({ ...notifSettings, [key]: value });
  }

  function handleProviderChange(provider: WhatsAppProvider) {
    if (!waSettings) return;
    setWaSettings({
      ...waSettings,
      provider,
      api_url: waSettings.api_url || PROVIDER_DEFAULT_URLS[provider],
      nama_provider: provider === 'custom' ? (waSettings.nama_provider ?? '') : PROVIDER_OPTIONS.find(p => p.value === provider)?.label ?? '',
    });
  }

  function handleTokenInput(e: ChangeEvent<HTMLInputElement>) {
    setTokenInput(e.target.value);
    setTokenChanged(true);
  }

  function togglePengingatMenit(menit: number) {
    if (!notifSettings) return;
    const current = notifSettings.pengingat_jadwal_menit ?? [];
    const next = current.includes(menit) ? current.filter((m) => m !== menit) : [...current, menit].sort((a, b) => a - b);
    updateNotif('pengingat_jadwal_menit', next);
  }

  function togglePenerima(value: string) {
    if (!notifSettings) return;
    const current = notifSettings.alfa_penerima ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    updateNotif('alfa_penerima', next);
  }

  function toggleAlfaHari(hari: string) {
    if (!notifSettings) return;
    const current = notifSettings.alfa_hari_berlaku ?? [];
    const next = current.includes(hari) ? current.filter((h) => h !== hari) : [...current, hari];
    updateNotif('alfa_hari_berlaku', next);
  }

  async function handleSave() {
    if (!waSettings || !notifSettings) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: notifErr } = await supabase.from('notification_settings').update({
      ...notifSettings,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (notifErr) { setError('Gagal menyimpan notifikasi: ' + notifErr.message); setSaving(false); return; }

    const waPayload: Record<string, unknown> = {
      aktif: waSettings.aktif,
      provider: waSettings.provider,
      api_url: waSettings.api_url,
      device_id: waSettings.device_id,
      nomor_pengirim: waSettings.nomor_pengirim,
      nama_provider: waSettings.nama_provider,
      timeout: waSettings.timeout,
      retry: waSettings.retry,
      rate_limit_delay: waSettings.rate_limit_delay,
      queue_paused: waSettings.queue_paused,
      catatan: waSettings.catatan,
      updated_at: new Date().toISOString(),
    };
    if (tokenChanged && tokenInput) {
      waPayload.api_token = tokenInput;
    }

    const { error: waErr } = await supabase.from('whatsapp_settings').update(waPayload).eq('id', 1);
    if (waErr) { setError('Gagal menyimpan WhatsApp: ' + waErr.message); setSaving(false); return; }

    for (const tpl of templates) {
      const { error: tplErr } = await supabase.from('notification_templates').update({
        isi: tpl.isi,
        aktif: tpl.aktif,
        updated_at: new Date().toISOString(),
      }).eq('id', tpl.id);
      if (tplErr) { setError('Gagal menyimpan template: ' + tplErr.message); setSaving(false); return; }
    }

    setSaving(false);
    setSaved(true);
    setTokenInput('');
    setTokenChanged(false);
    setShowToken(false);
    setTimeout(() => setSaved(false), 3000);
    fetchAll();
  }

  async function handleTestConnection() {
    if (!waSettings?.api_url) { setError('URL API harus diisi sebelum test koneksi.'); return; }
    if (!hasToken && !tokenChanged) { setError('Token API harus diisi sebelum test koneksi.'); return; }
    if (tokenChanged && tokenInput) {
      const { error: saveErr } = await supabase.from('whatsapp_settings').update({
        api_token: tokenInput,
        api_url: waSettings.api_url,
        provider: waSettings.provider,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (saveErr) { setError('Gagal menyimpan token sebelum test: ' + saveErr.message); return; }
      setTokenChanged(false);
      setTokenInput('');
    }

    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-test`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'test_connection' }),
      });
      const data = await res.json();
      if (!res.ok) { setTestResult({ success: false, message: data.error ?? 'Gagal test koneksi' }); }
      else { setTestResult({ success: data.success, message: data.message }); }
      fetchAll();
    } catch { setTestResult({ success: false, message: 'Gagal terhubung ke server' }); }
    setTesting(false);
  }

  async function handleTestSend() {
    if (!testSendNumber.trim()) { setError('Nomor tujuan harus diisi.'); return; }
    setTestSending(true);
    setTestSendResult(null);
    setError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-test`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'test_send', nomor: testSendNumber.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setTestSendResult({ success: false, message: data.error ?? 'Gagal mengirim pesan test' }); }
      else { setTestSendResult({ success: data.success, message: data.message }); }
    } catch { setTestSendResult({ success: false, message: 'Gagal terhubung ke server' }); }
    setTestSending(false);
  }

  async function toggleQueuePaused() {
    if (!waSettings) return;
    const newVal = !waSettings.queue_paused;
    setWaSettings({ ...waSettings, queue_paused: newVal });
    const { error: err } = await supabase.from('whatsapp_settings').update({ queue_paused: newVal, updated_at: new Date().toISOString() }).eq('id', 1);
    if (err) { setError('Gagal mengubah status antrean: ' + err.message); setWaSettings({ ...waSettings, queue_paused: !newVal }); }
  }

  function updateTemplate(id: string, field: 'isi' | 'aktif', value: string | boolean) {
    setTemplates(templates.map((t) => t.id === id ? { ...t, [field]: value } : t));
  }

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div></AppLayout>;
  }

  if (!canView) {
    return <AppLayout><div className="flex items-center justify-center py-20"><p className="text-red-500">Anda tidak memiliki akses ke halaman ini.</p></div></AppLayout>;
  }

  if (!waSettings || !notifSettings) {
    return <AppLayout><div className="flex items-center justify-center py-20"><p className="text-red-500">Gagal memuat data pengaturan.</p></div></AppLayout>;
  }

  const tabs: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
    { id: 'provider', label: 'Konfigurasi WhatsApp', icon: MessageSquare },
    { id: 'notifikasi', label: 'Notifikasi Presensi', icon: Bell },
    { id: 'template', label: 'Template Pesan', icon: FileText },
    { id: 'jadwal', label: 'Jadwal Notifikasi', icon: Calendar },
    { id: 'riwayat', label: 'Log Pengiriman', icon: History },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-emerald-700" />
              WhatsApp & Notifikasi
            </h1>
            <p className="mt-1 text-sm text-gray-500">Pusat konfigurasi WhatsApp, notifikasi otomatis, template pesan, dan log pengiriman</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Queue pause/resume */}
            {canEdit && (
              <button
                onClick={toggleQueuePaused}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border transition ${
                  waSettings.queue_paused
                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
                title={waSettings.queue_paused ? 'Lanjutkan antrean' : 'Jeda antrean'}
              >
                {waSettings.queue_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {waSettings.queue_paused ? 'Resume Antrean' : 'Jeda Antrean'}
              </button>
            )}
            {canEdit && (
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60">
                {saving ? 'Menyimpan...' : saved ? (<><Check className="w-4 h-4" /> Tersimpan</>) : (<><Save className="w-4 h-4" /> Simpan</>)}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* Security notice */}
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <Shield className="w-4 h-4 shrink-0" />
          <span>API Token disimpan dengan aman di server. Token tidak pernah ditampilkan dalam plaintext setelah disimpan. {canView && !canEdit ? 'Anda hanya dapat melihat konfigurasi tanpa token.' : ''}</span>
        </div>

        {/* Queue status badge */}
        {waSettings.queue_paused && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
            <Pause className="w-4 h-4" /> Antrean pengiriman notifikasi sedang dijeda. Pesan baru akan menumpuk hingga diresume.
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* =================== TAB: PROVIDER =================== */}
        {activeTab === 'provider' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <MessageSquare className="w-5 h-5 text-emerald-600" /> Provider WhatsApp Gateway
              </h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={waSettings.aktif} disabled={!canEdit} onChange={(e) => updateWa('aktif', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                  <span className="text-sm font-medium text-gray-700">WhatsApp Gateway Aktif</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Provider</label>
                    <select value={waSettings.provider} disabled={!canEdit} onChange={(e) => handleProviderChange(e.target.value as WhatsAppProvider)} className={inputCls}>
                      {PROVIDER_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nama Provider</label>
                    <input type="text" value={waSettings.nama_provider ?? ''} disabled={!canEdit || waSettings.provider !== 'custom'} onChange={(e) => updateWa('nama_provider', e.target.value)} className={inputCls} placeholder="Nama untuk Custom API" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>API URL / Endpoint</label>
                  <input type="text" value={waSettings.api_url ?? ''} disabled={!canEdit} onChange={(e) => updateWa('api_url', e.target.value)} className={inputCls} placeholder="https://api.provider.com" />
                </div>

                {/* Token */}
                <div>
                  <label className={labelCls}>API Token</label>
                  <div className="flex gap-2">
                    {hasToken && !tokenChanged ? (
                      <div className="flex-1 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 bg-gray-50">
                        <span className="text-sm text-gray-500 font-mono flex-1">{'\u2022'.repeat(20)}</span>
                        <span className="text-xs text-emerald-600 font-medium">Token tersimpan</span>
                        {canEdit && <button type="button" onClick={() => { setTokenChanged(true); setHasToken(false); }} className="text-xs text-emerald-700 hover:text-emerald-800 font-medium">Ganti Token</button>}
                      </div>
                    ) : (
                      <>
                        <input type={showToken ? 'text' : 'password'} value={tokenInput} disabled={!canEdit} onChange={handleTokenInput} className={inputCls} placeholder={hasToken ? 'Masukkan token baru' : 'Masukkan API Token'} />
                        {canEdit && <button type="button" onClick={() => setShowToken(!showToken)} className="rounded-lg border border-gray-300 px-3 py-2 text-gray-500 hover:bg-gray-50 transition">{showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Token disimpan dengan aman dan tidak ditampilkan setelah disimpan.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Device ID / Account ID (opsional)</label>
                    <input type="text" value={waSettings.device_id ?? ''} disabled={!canEdit} onChange={(e) => updateWa('device_id', e.target.value)} className={inputCls} placeholder="Device ID dari provider" />
                  </div>
                  <div>
                    <label className={labelCls}>Nomor Pengirim (opsional)</label>
                    <input type="text" value={waSettings.nomor_pengirim ?? ''} disabled={!canEdit} onChange={(e) => updateWa('nomor_pengirim', e.target.value)} className={inputCls} placeholder="628123456789" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Timeout (detik)</label>
                    <input type="number" min={5} value={waSettings.timeout ?? 30} disabled={!canEdit} onChange={(e) => updateWa('timeout', e.target.value ? parseInt(e.target.value, 10) : null)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Retry Attempts</label>
                    <input type="number" min={0} value={waSettings.retry ?? 3} disabled={!canEdit} onChange={(e) => updateWa('retry', e.target.value ? parseInt(e.target.value, 10) : null)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Rate Limit (detik/ pesan)</label>
                    <input type="number" min={0} value={waSettings.rate_limit_delay} disabled={!canEdit} onChange={(e) => updateWa('rate_limit_delay', e.target.value ? parseInt(e.target.value, 10) : 2)} className={inputCls} />
                    <p className="mt-1 text-xs text-gray-400">Jeda antar pesan untuk menghindari throttling.</p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Catatan</label>
                  <textarea value={waSettings.catatan ?? ''} disabled={!canEdit} onChange={(e) => updateWa('catatan', e.target.value)} rows={2} className={inputCls} placeholder="Catatan internal tentang provider..." />
                </div>
              </div>
            </section>

            {/* Test Connection + Test Send */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <TestTube2 className="w-5 h-5 text-emerald-600" /> Test Koneksi & Kirim Pesan
              </h2>
              <div className="flex items-center gap-4 flex-wrap mb-4">
                {canEdit && (
                  <button onClick={handleTestConnection} disabled={testing}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-60">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                    {testing ? 'Menguji...' : 'Test Koneksi'}
                  </button>
                )}
                {waSettings.status_koneksi && waSettings.status_koneksi !== 'untested' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${waSettings.status_koneksi === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      <span className={`w-2 h-2 rounded-full ${waSettings.status_koneksi === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {waSettings.status_koneksi === 'connected' ? 'Terhubung' : 'Gagal'}
                    </span>
                    {waSettings.waktu_test_terakhir && <span className="text-xs text-gray-400">Terakhir: {new Date(waSettings.waktu_test_terakhir).toLocaleString('id-ID')}</span>}
                  </div>
                )}
              </div>
              {testResult && (
                <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${testResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  <strong>{testResult.success ? 'Berhasil' : 'Gagal'}:</strong> {testResult.message}
                </div>
              )}

              {/* Test Send */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className={labelCls}>Nomor Tujuan Test</label>
                    <input type="text" value={testSendNumber} disabled={!canEdit} onChange={(e) => setTestSendNumber(e.target.value)} className={inputCls} placeholder="628123456789" />
                  </div>
                  {canEdit && (
                    <button onClick={handleTestSend} disabled={testSending || !testSendNumber.trim()}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-60 whitespace-nowrap">
                      {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {testSending ? 'Mengirim...' : 'Kirim Pesan Test'}
                    </button>
                  )}
                </div>
                {testSendResult && (
                  <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${testSendResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    <strong>{testSendResult.success ? 'Berhasil' : 'Gagal'}:</strong> {testSendResult.message}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* =================== TAB: NOTIFIKASI =================== */}
        {activeTab === 'notifikasi' && (
          <div className="space-y-6">
            {([
              { key: 'hadir' as const, label: 'Hadir', desc: 'Notifikasi ketika siswa tercatat hadir' },
              { key: 'pulang' as const, label: 'Pulang', desc: 'Notifikasi ketika siswa presensi pulang' },
              { key: 'terlambat' as const, label: 'Terlambat', desc: 'Notifikasi ketika siswa tercatat terlambat' },
              { key: 'izin' as const, label: 'Izin', desc: 'Notifikasi ketika siswa izin' },
              { key: 'sakit' as const, label: 'Sakit', desc: 'Notifikasi ketika siswa sakit' },
            ]).map((evt) => (
              <section key={evt.key} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-1">
                  <Bell className="w-5 h-5 text-emerald-600" /> Notifikasi {evt.label}
                </h2>
                <p className="text-sm text-gray-500 mb-4">{evt.desc} — dikirim ke Orang Tua/Wali</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings[`${evt.key}_aktif`]} disabled={!canEdit} onChange={(e) => updateNotif(`${evt.key}_aktif` as keyof NotificationSettings, e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm font-medium text-gray-700">Aktifkan notifikasi {evt.label.toLowerCase()}</span>
                  </label>
                  <div className="pl-7 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={notifSettings[`${evt.key}_wa`]} disabled={!canEdit || !notifSettings[`${evt.key}_aktif`]} onChange={(e) => updateNotif(`${evt.key}_wa` as keyof NotificationSettings, e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm text-gray-700">WhatsApp</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={notifSettings[`${evt.key}_push`]} disabled={!canEdit || !notifSettings[`${evt.key}_aktif`]} onChange={(e) => updateNotif(`${evt.key}_push` as keyof NotificationSettings, e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm text-gray-700">Push Aplikasi</span>
                    </label>
                  </div>
                </div>
              </section>
            ))}

            {/* Alfa */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <AlertCircle className="w-5 h-5 text-emerald-600" /> Notifikasi Alfa Otomatis
              </h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={notifSettings.alfa_aktif} disabled={!canEdit} onChange={(e) => updateNotif('alfa_aktif', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                  <span className="text-sm font-medium text-gray-700">Aktifkan notifikasi alfa otomatis</span>
                </label>
                <div className="pl-7 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings.alfa_wa} disabled={!canEdit || !notifSettings.alfa_aktif} onChange={(e) => updateNotif('alfa_wa', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm text-gray-700">Kirim melalui WhatsApp</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings.alfa_push} disabled={!canEdit || !notifSettings.alfa_aktif} onChange={(e) => updateNotif('alfa_push', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm text-gray-700">Kirim melalui Push Aplikasi</span>
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Penerima</label>
                  <div className="flex flex-wrap gap-2">
                    {PENERIMA_OPTIONS.map((opt) => {
                      const active = (notifSettings.alfa_penerima ?? []).includes(opt.value);
                      return <button key={opt.value} type="button" disabled={!canEdit} onClick={() => togglePenerima(opt.value)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${active ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>{opt.label}</button>;
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Nomor diambil otomatis dari biodata Orang Tua/Wali pada Data Siswa.</p>
                </div>
              </div>
            </section>

            {/* Pengingat Jadwal Guru */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <Calendar className="w-5 h-5 text-emerald-600" /> Pengingat Jadwal Mengajar Guru
              </h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={notifSettings.pengingat_jadwal_aktif} disabled={!canEdit} onChange={(e) => updateNotif('pengingat_jadwal_aktif', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                  <span className="text-sm font-medium text-gray-700">Aktifkan pengingat jadwal guru</span>
                </label>
                <div className="pl-7 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings.pengingat_jadwal_wa} disabled={!canEdit || !notifSettings.pengingat_jadwal_aktif} onChange={(e) => updateNotif('pengingat_jadwal_wa', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm text-gray-700">WhatsApp</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings.pengingat_jadwal_push} disabled={!canEdit || !notifSettings.pengingat_jadwal_aktif} onChange={(e) => updateNotif('pengingat_jadwal_push', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm text-gray-700">Push Aplikasi</span>
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Waktu Pengingat (sebelum jadwal dimulai)</label>
                  <div className="flex flex-wrap gap-2">
                    {PENGINGAT_MENIT_OPTIONS.map((menit) => {
                      const active = (notifSettings.pengingat_jadwal_menit ?? []).includes(menit);
                      return <button key={menit} type="button" disabled={!canEdit} onClick={() => togglePengingatMenit(menit)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${active ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>{menit} menit</button>;
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Pengingat mengambil data dari Jadwal Mengajar. Tidak ada jadwal terpisah.</p>
                </div>
              </div>
            </section>

            {/* Pengingat Guru Belum Presensi */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <Clock className="w-5 h-5 text-emerald-600" /> Pengingat Guru Belum Presensi
              </h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={notifSettings.pengingat_belum_presensi_aktif} disabled={!canEdit} onChange={(e) => updateNotif('pengingat_belum_presensi_aktif', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                  <span className="text-sm font-medium text-gray-700">Aktifkan pengingat guru belum presensi</span>
                </label>
                <div className="pl-7 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings.pengingat_belum_presensi_wa} disabled={!canEdit || !notifSettings.pengingat_belum_presensi_aktif} onChange={(e) => updateNotif('pengingat_belum_presensi_wa', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm text-gray-700">WhatsApp</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings.pengingat_belum_presensi_push} disabled={!canEdit || !notifSettings.pengingat_belum_presensi_aktif} onChange={(e) => updateNotif('pengingat_belum_presensi_push', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                    <span className="text-sm text-gray-700">Push Aplikasi</span>
                  </label>
                </div>
                <div className="max-w-[200px]">
                  <label className={labelCls}>Pengingat (menit setelah jadwal dimulai)</label>
                  <input type="number" min={1} value={notifSettings.pengingat_belum_presensi_menit} disabled={!canEdit} onChange={(e) => updateNotif('pengingat_belum_presensi_menit', e.target.value ? parseInt(e.target.value, 10) : 10)} className={inputCls} />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =================== TAB: TEMPLATE =================== */}
        {activeTab === 'template' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <FileText className="w-5 h-5 text-emerald-600" /> Template Pesan Notifikasi
              </h2>
              <div className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Variabel yang dapat digunakan:</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map((v) => <code key={v} className="rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-mono">{v}</code>)}
                </div>
              </div>
              <div className="space-y-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{tpl.judul}</span>
                        <code className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{tpl.tipe}</code>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={tpl.aktif} disabled={!canEdit} onChange={(e) => updateTemplate(tpl.id, 'aktif', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
                        <span className="text-xs text-gray-500">Aktif</span>
                      </label>
                    </div>
                    <textarea value={tpl.isi} disabled={!canEdit} onChange={(e) => updateTemplate(tpl.id, 'isi', e.target.value)} rows={3} className={inputCls} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* =================== TAB: JADWAL NOTIFIKASI =================== */}
        {activeTab === 'jadwal' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <Calendar className="w-5 h-5 text-emerald-600" /> Jadwal Notifikasi Alfa
              </h2>
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                  Alfa hanya dikirim jika Admin mengaktifkan notifikasi Alfa dan jadwal pengecekan terpenuhi. Hari libur dan kalender pendidikan yang tidak mewajibkan presensi tidak menghasilkan notifikasi Alfa.
                </div>
                <div>
                  <label className={labelCls}>Waktu Pengiriman</label>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="alfa_waktu" value="langsung" checked={notifSettings.alfa_waktu_mode === 'langsung'} disabled={!canEdit} onChange={() => updateNotif('alfa_waktu_mode', 'langsung')} className="text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm text-gray-700">Langsung setelah status Alfa</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="alfa_waktu" value="jam_tertentu" checked={notifSettings.alfa_waktu_mode === 'jam_tertentu'} disabled={!canEdit} onChange={() => updateNotif('alfa_waktu_mode', 'jam_tertentu')} className="text-emerald-600 focus:ring-emerald-200" />
                      <span className="text-sm text-gray-700">Pilih jam tertentu</span>
                    </label>
                  </div>
                  {notifSettings.alfa_waktu_mode === 'jam_tertentu' && (
                    <div className="mt-2 max-w-[200px]">
                      <input type="time" value={notifSettings.alfa_jam_kirim ?? ''} disabled={!canEdit} onChange={(e) => updateNotif('alfa_jam_kirim', e.target.value)} className={inputCls} />
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Jam Pengecekan Alfa</label>
                  <input type="time" value={notifSettings.alfa_jam_cek ?? ''} disabled={!canEdit} onChange={(e) => updateNotif('alfa_jam_cek', e.target.value)} className={`${inputCls} max-w-[200px]`} />
                  <p className="mt-1 text-xs text-gray-400">Sistem menentukan siswa Alfa setelah jam ini. Sebelum jam ini, siswa belum dianggap Alfa.</p>
                </div>
                <div>
                  <label className={labelCls}>Hari Berlaku Pengecekan Alfa</label>
                  <div className="flex flex-wrap gap-2">
                    {HARI_OPTIONS.map((hari) => {
                      const active = (notifSettings.alfa_hari_berlaku ?? []).includes(hari);
                      return <button key={hari} type="button" disabled={!canEdit} onClick={() => toggleAlfaHari(hari)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${active ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>{hari}</button>;
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Hari Sabtu/Minggu biasanya tidak aktif. Hari libur dari Kalender Pendidikan ikut dikecualikan.</p>
                </div>
                <div>
                  <label className={labelCls}>Penerima</label>
                  <div className="flex flex-wrap gap-2">
                    {PENERIMA_OPTIONS.map((opt) => {
                      const active = (notifSettings.alfa_penerima ?? []).includes(opt.value);
                      return <button key={opt.value} type="button" disabled={!canEdit} onClick={() => togglePenerima(opt.value)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${active ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>{opt.label}</button>;
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =================== TAB: RIWAYAT =================== */}
        {activeTab === 'riwayat' && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                <History className="w-5 h-5 text-emerald-600" /> Log Pengiriman Notifikasi
              </h2>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Filter className="w-4 h-4 text-gray-400" />
                <input type="date" value={logFilterDate} onChange={(e) => { setLogFilterDate(e.target.value); setLogPage(0); }} className={`${inputCls} max-w-[160px]`} />
                <input type="text" value={logFilterKelas} onChange={(e) => { setLogFilterKelas(e.target.value); setLogPage(0); }} placeholder="Filter kelas..." className={`${inputCls} max-w-[150px]`} />
                <select value={logFilterTipe} onChange={(e) => { setLogFilterTipe(e.target.value); setLogPage(0); }} className={`${inputCls} max-w-[180px]`}>
                  <option value="">Semua Jenis</option>
                  {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={logFilterChannel} onChange={(e) => { setLogFilterChannel(e.target.value); setLogPage(0); }} className={`${inputCls} max-w-[150px]`}>
                  <option value="">Semua Channel</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="push">Push</option>
                </select>
                <select value={logFilterStatus} onChange={(e) => { setLogFilterStatus(e.target.value); setLogPage(0); }} className={`${inputCls} max-w-[150px]`}>
                  <option value="">Semua Status</option>
                  <option value="menunggu">Menunggu</option>
                  <option value="terkirim">Terkirim</option>
                  <option value="gagal">Gagal</option>
                </select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 font-semibold">Tanggal/Waktu</th>
                      <th className="px-3 py-2 font-semibold">Nama Siswa</th>
                      <th className="px-3 py-2 font-semibold hidden sm:table-cell">Kelas</th>
                      <th className="px-3 py-2 font-semibold">Jenis</th>
                      <th className="px-3 py-2 font-semibold hidden md:table-cell">Nomor Tujuan</th>
                      <th className="px-3 py-2 font-semibold">Channel</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold hidden lg:table-cell">Pesan/Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400"><Send className="w-8 h-8 mx-auto mb-2 text-gray-300" />Belum ada log pengiriman.</td></tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{new Date(log.tanggal_waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{log.nama_siswa ?? log.penerima ?? '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{log.kelas ?? '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{log.tipe}</td>
                          <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell font-mono text-xs">{log.nomor_tujuan ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${log.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{log.channel === 'whatsapp' ? 'WhatsApp' : 'Push'}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${log.status === 'terkirim' ? 'bg-emerald-100 text-emerald-700' : log.status === 'gagal' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{log.status === 'terkirim' ? 'Terkirim' : log.status === 'gagal' ? 'Gagal' : 'Menunggu'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate hidden lg:table-cell" title={log.pesan_error ?? log.pesan ?? ''}>{log.pesan_error ?? log.pesan ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logCount > LOG_PER_PAGE && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-gray-400">Menampilkan {logPage * LOG_PER_PAGE + 1}–{Math.min((logPage + 1) * LOG_PER_PAGE, logCount)} dari {logCount}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setLogPage(Math.max(0, logPage - 1))} disabled={logPage === 0} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Sebelumnya</button>
                    <button onClick={() => setLogPage(logPage + 1)} disabled={(logPage + 1) * LOG_PER_PAGE >= logCount} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">Berikutnya</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Save button at bottom for editable tabs */}
        {canEdit && (activeTab === 'provider' || activeTab === 'notifikasi' || activeTab === 'template' || activeTab === 'jadwal') && (
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60">
              {saving ? 'Menyimpan...' : saved ? (<><Check className="w-4 h-4" /> Tersimpan</>) : (<><Save className="w-4 h-4" /> Simpan Pengaturan</>)}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

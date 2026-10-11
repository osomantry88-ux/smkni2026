import { useEffect, useState, useCallback } from 'react';
import {
  Cpu, Plus, Pencil, Trash2, Loader2, CheckCircle2, XCircle,
  RefreshCw, Copy, Wifi, WifiOff, Save, Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { IotRfidDevice, IotRfidTap } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Badge from '@/components/Badge';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 40; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  return `${Math.floor(hr / 24)} hari lalu`;
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export default function IoTRFIDPage() {
  const { isAdmin } = useAuth();
  const canEdit = isAdmin();

  const [devices, setDevices] = useState<IotRfidDevice[]>([]);
  const [taps, setTaps] = useState<IotRfidTap[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'devices' | 'taps'>('devices');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IotRfidDevice | null>(null);
  const [form, setForm] = useState({ sn: '', nama_mesin: '', lokasi: '', api_token: '', aktif: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IotRfidDevice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    const { data } = await supabase.from('iot_rfid_devices').select('*').order('created_at', { ascending: false });
    setDevices((data ?? []) as IotRfidDevice[]);
  }, []);

  const fetchTaps = useCallback(async () => {
    const { data } = await supabase.from('iot_rfid_taps').select('*').order('timestamp', { ascending: false }).limit(50);
    setTaps((data ?? []) as IotRfidTap[]);
  }, []);

  useEffect(() => {
    Promise.all([fetchDevices(), fetchTaps()]).then(() => setLoading(false));
  }, [fetchDevices, fetchTaps]);

  function openCreate() {
    setEditing(null);
    setForm({ sn: '', nama_mesin: '', lokasi: '', api_token: generateToken(), aktif: true });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(d: IotRfidDevice) {
    setEditing(d);
    setForm({ sn: d.sn, nama_mesin: d.nama_mesin, lokasi: d.lokasi ?? '', api_token: '', aktif: d.aktif });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const payload = {
      sn: form.sn,
      nama_mesin: form.nama_mesin,
      lokasi: form.lokasi || null,
      aktif: form.aktif,
      updated_at: new Date().toISOString(),
    };
    if (form.api_token) (payload as Record<string, unknown>).api_token = form.api_token;

    if (editing) {
      const { error: err } = await supabase.from('iot_rfid_devices').update(payload).eq('id', editing.id);
      if (err) { setError(err.code === '23505' ? 'SN sudah ada.' : err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('iot_rfid_devices').insert(payload);
      if (err) { setError(err.code === '23505' ? 'SN sudah ada.' : err.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchDevices();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('iot_rfid_devices').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    fetchDevices();
  }

  async function regenerateToken(d: IotRfidDevice) {
    const newToken = generateToken();
    await supabase.from('iot_rfid_devices').update({ api_token: newToken, updated_at: new Date().toISOString() }).eq('id', d.id);
    fetchDevices();
  }

  function copyEndpoint() {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/api/iot/tap`);
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const endpointUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/iot/tap`;
  const heartbeatUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/iot/heartbeat`;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-emerald-700" />
              IoT RFID Integration
            </h1>
            <p className="mt-1 text-sm text-gray-500">Kelola perangkat mesin RFID dan endpoint integrasi presensi</p>
          </div>
          {canEdit && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition">
              <Plus className="w-4 h-4" /> Tambah Perangkat
            </button>
          )}
        </div>

        {/* API Endpoints */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" /> API Endpoint
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm font-mono text-gray-700">{endpointUrl}</code>
              <button onClick={copyEndpoint} className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 transition" title="Copy">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm font-mono text-gray-700">{heartbeatUrl}</code>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-1">Contoh request:</p>
            <pre className="text-xs font-mono text-gray-700">{`POST /api/iot/tap
X-Device-Token: <device_token>
{
  "sn": "RFID-01",
  "rfid": "25170174191",
  "timestamp": "2026-10-11 06:45:12"
}`}</pre>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          <button onClick={() => setTab('devices')} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'devices' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Cpu className="w-4 h-4" /> Perangkat
          </button>
          <button onClick={() => setTab('taps')} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'taps' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Activity className="w-4 h-4" /> Log Tap
          </button>
        </div>

        {/* Devices tab */}
        {tab === 'devices' && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">SN</th>
                    <th className="px-4 py-3">Nama Mesin</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Lokasi</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Last Seen</th>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /> Memuat...</td></tr>
                  ) : devices.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400"><Cpu className="w-8 h-8 mx-auto mb-2 text-gray-300" /> Belum ada perangkat terdaftar.</td></tr>
                  ) : (
                    devices.map((d) => {
                      const online = isOnline(d.last_seen);
                      return (
                        <tr key={d.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{d.sn}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{d.nama_mesin}</td>
                          <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{d.lokasi ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">{timeAgo(d.last_seen)}</td>
                          <td className="px-4 py-3">
                            {d.api_token ? (
                              <button onClick={() => copyToken(d.api_token!)} className="text-xs font-mono text-emerald-700 hover:text-emerald-800 transition">
                                {copiedId === d.api_token ? 'Copied!' : '••••••••'}
                              </button>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {canEdit && (
                                <>
                                  <button onClick={() => regenerateToken(d)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Regenerate Token">
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => openEdit(d)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition" title="Edit">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setDeleteTarget(d)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 transition" title="Hapus">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Taps log tab */}
        {tab === 'taps' && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">RFID</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Tipe</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Phase</th>
                    <th className="px-4 py-3 hidden md:table-cell">Jam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {taps.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400"><Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" /> Belum ada log tap.</td></tr>
                  ) : (
                    taps.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{new Date(t.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{t.rfid}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{t.person_name ?? '—'}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{t.person_type ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={t.status === 'hadir' ? 'success' : t.status === 'terlambat' ? 'warning' : t.status === 'unknown' || t.status === 'error' ? 'error' : 'neutral'}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-600">{t.phase ?? '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-600 font-mono">{t.jam ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Perangkat RFID' : 'Tambah Perangkat RFID'} size="md">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Serial Number (SN) *</label>
            <input type="text" required value={form.sn} onChange={(e) => setForm({ ...form, sn: e.target.value.toUpperCase() })} placeholder="Contoh: RFID-01" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className={labelCls}>Nama Mesin *</label>
            <input type="text" required value={form.nama_mesin} onChange={(e) => setForm({ ...form, nama_mesin: e.target.value })} placeholder="Contoh: Mesin Gerbang Depan" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Lokasi</label>
            <input type="text" value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} placeholder="Contoh: Gerbang Utama" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>API Token</label>
            <div className="flex gap-2">
              <input type="text" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} placeholder={editing ? 'Kosongkan jika tidak diganti' : 'Token otomatis'} className={`${inputCls} font-mono`} />
              <button type="button" onClick={() => setForm({ ...form, api_token: generateToken() })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Token digunakan untuk autentikasi mesin. Simpan dengan aman.</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200" />
            <span className="text-sm font-medium text-gray-700">Perangkat aktif</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="button" onClick={handleSubmit} disabled={saving || !form.sn || !form.nama_mesin} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Hapus Perangkat" message={`Yakin ingin menghapus perangkat "${deleteTarget?.nama_mesin}" (SN: ${deleteTarget?.sn})?`} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </AppLayout>
  );
}

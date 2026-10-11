import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Settings, School, MapPin, Clock, Bell, UserCog, Save, MapPinOff,
  Upload, Trash2, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SchoolSettings, GuruTendik, TahunPelajaran } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import LeafletMap from '@/components/LeafletMap';
import { getPhotoUrl } from '@/components/PhotoUpload';

const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function PengaturanSekolahPage() {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [guruList, setGuruList] = useState<GuruTendik[]>([]);
  const [tahunAktif, setTahunAktif] = useState<TahunPelajaran | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    const [settingsRes, guruRes, tpRes] = await Promise.all([
      supabase.from('school_settings').select('*, kepala_sekolah:kepala_sekolah_id(*)').eq('id', 1).maybeSingle(),
      supabase.from('guru_tendik').select('*').order('nama_lengkap'),
      supabase.from('tahun_pelajaran').select('*').eq('aktif', true).maybeSingle(),
    ]);

    if (settingsRes.error) {
      setError('Gagal memuat pengaturan: ' + settingsRes.error.message);
      setLoading(false);
      return;
    }

    if (settingsRes.data) {
      const s = settingsRes.data as SchoolSettings;
      setSettings(s);
      setLogoPath(s.logo_url);
      setSignaturePath(s.tanda_tangan_kepsek_url);
      if (s.logo_url) {
        const { data } = supabase.storage.from('school-logos').getPublicUrl(s.logo_url);
        setLogoPreview(data.publicUrl);
      }
      if (s.tanda_tangan_kepsek_url) {
        const { data } = supabase.storage.from('school-signatures').getPublicUrl(s.tanda_tangan_kepsek_url);
        setSigPreview(data.publicUrl);
      }
    }

    setGuruList((guruRes.data ?? []) as GuruTendik[]);
    setTahunAktif((tpRes.data ?? null) as TahunPelajaran | null);
    setLoading(false);
  }

  function update<K extends keyof SchoolSettings>(key: K, value: SchoolSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function toggleHari(hari: string) {
    if (!settings) return;
    const current = settings.hari_aktif ?? [];
    const next = current.includes(hari) ? current.filter((h) => h !== hari) : [...current, hari];
    update('hari_aktif', next);
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    const fileName = `logo-${Date.now()}.webp`;
    const { error: upErr } = await supabase.storage.from('school-logos').upload(fileName, file, { upsert: false });
    if (upErr) {
      setError('Gagal mengunggah logo: ' + upErr.message);
      setUploadingLogo(false);
      return;
    }
    if (logoPath) {
      await supabase.storage.from('school-logos').remove([logoPath]);
    }
    const { data } = supabase.storage.from('school-logos').getPublicUrl(fileName);
    setLogoPreview(data.publicUrl);
    setLogoPath(fileName);
    setUploadingLogo(false);
  }

  async function handleSignatureUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSig(true);
    setError(null);
    const fileName = `signature-${Date.now()}.webp`;
    const { error: upErr } = await supabase.storage.from('school-signatures').upload(fileName, file, { upsert: false });
    if (upErr) {
      setError('Gagal mengunggah tanda tangan: ' + upErr.message);
      setUploadingSig(false);
      return;
    }
    if (signaturePath) {
      await supabase.storage.from('school-signatures').remove([signaturePath]);
    }
    const { data } = supabase.storage.from('school-signatures').getPublicUrl(fileName);
    setSigPreview(data.publicUrl);
    setSignaturePath(fileName);
    setUploadingSig(false);
  }

  async function handleRemoveLogo() {
    if (logoPath) {
      await supabase.storage.from('school-logos').remove([logoPath]);
    }
    setLogoPreview(null);
    setLogoPath(null);
  }

  async function handleRemoveSignature() {
    if (signaturePath) {
      await supabase.storage.from('school-signatures').remove([signaturePath]);
    }
    setSigPreview(null);
    setSignaturePath(null);
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolokasi.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update('latitude', pos.coords.latitude);
        update('longitude', pos.coords.longitude);
        setError(null);
      },
      () => {
        setError('Tidak dapat mengakses lokasi. Periksa izin browser.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSave() {
    if (!settings) return;

    if (settings.latitude !== null && (settings.latitude < -90 || settings.latitude > 90)) {
      setError('Latitude harus antara -90 sampai 90.');
      return;
    }
    if (settings.longitude !== null && (settings.longitude < -180 || settings.longitude > 180)) {
      setError('Longitude harus antara -180 sampai 180.');
      return;
    }
    if (settings.radius_presensi !== null && settings.radius_presensi <= 0) {
      setError('Radius presensi harus lebih besar dari 0.');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = {
      nama_sekolah: settings.nama_sekolah,
      npsn: settings.npsn,
      nss: settings.nss,
      alamat: settings.alamat,
      kecamatan: settings.kecamatan,
      kabupaten: settings.kabupaten,
      provinsi: settings.provinsi,
      kode_pos: settings.kode_pos,
      no_telepon: settings.no_telepon,
      email: settings.email,
      website: settings.website,
      logo_url: logoPath,
      latitude: settings.latitude,
      longitude: settings.longitude,
      radius_presensi: settings.radius_presensi,
      hari_aktif: settings.hari_aktif,
      jam_mulai: settings.jam_mulai,
      jam_batas_terlambat: settings.jam_batas_terlambat,
      jam_selesai: settings.jam_selesai,
      kepala_sekolah_id: settings.kepala_sekolah_id,
      tanda_tangan_kepsek_url: signaturePath,
      notifikasi_jadwal_aktif: settings.notifikasi_jadwal_aktif,
      notifikasi_wa: settings.notifikasi_wa,
      notifikasi_push: settings.notifikasi_push,
      updated_at: new Date().toISOString(),
    };

    const { error: err } = await supabase.from('school_settings').update(payload).eq('id', 1);
    if (err) {
      setError('Gagal menyimpan: ' + err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    fetchData();
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400">Memuat pengaturan...</p>
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-red-500">Gagal memuat data pengaturan.</p>
        </div>
      </AppLayout>
    );
  }

  const canEdit = isAdmin();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-700" />
              Pengaturan Sekolah
            </h1>
            <p className="mt-1 text-sm text-gray-500">Konfigurasi pusat identitas, lokasi, jam kerja, dan notifikasi sekolah</p>
          </div>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : saved ? (<><Check className="w-4 h-4" /> Tersimpan</>) : (<><Save className="w-4 h-4" /> Simpan</>)}
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* 1. Identitas Sekolah */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            <School className="w-5 h-5 text-emerald-600" /> Identitas Sekolah
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className={labelCls}>Nama Sekolah</label>
              <input type="text" value={settings.nama_sekolah} disabled={!canEdit} onChange={(e) => update('nama_sekolah', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NPSN</label>
              <input type="text" value={settings.npsn ?? ''} disabled={!canEdit} onChange={(e) => update('npsn', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NSS / NIS</label>
              <input type="text" value={settings.nss ?? ''} disabled={!canEdit} onChange={(e) => update('nss', e.target.value)} className={inputCls} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelCls}>Alamat</label>
              <textarea value={settings.alamat ?? ''} disabled={!canEdit} onChange={(e) => update('alamat', e.target.value)} rows={2} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kecamatan</label>
              <input type="text" value={settings.kecamatan ?? ''} disabled={!canEdit} onChange={(e) => update('kecamatan', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kabupaten / Kota</label>
              <input type="text" value={settings.kabupaten ?? ''} disabled={!canEdit} onChange={(e) => update('kabupaten', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provinsi</label>
              <input type="text" value={settings.provinsi ?? ''} disabled={!canEdit} onChange={(e) => update('provinsi', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kode Pos</label>
              <input type="text" value={settings.kode_pos ?? ''} disabled={!canEdit} onChange={(e) => update('kode_pos', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nomor Telepon</label>
              <input type="text" value={settings.no_telepon ?? ''} disabled={!canEdit} onChange={(e) => update('no_telepon', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={settings.email ?? ''} disabled={!canEdit} onChange={(e) => update('email', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input type="text" value={settings.website ?? ''} disabled={!canEdit} onChange={(e) => update('website', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Logo upload */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className={labelCls}>Logo Sekolah</label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo Sekolah" className="w-20 h-20 rounded-lg object-contain border border-gray-200 bg-white" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <School className="w-8 h-8 text-gray-300" />
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                    <Upload className="w-4 h-4" /> {uploadingLogo ? 'Mengunggah...' : 'Unggah Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                  {logoPreview && (
                    <button type="button" onClick={handleRemoveLogo} className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600 font-medium">
                      <Trash2 className="w-4 h-4" /> Hapus
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 2. Tahun Pelajaran Aktif */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            <School className="w-5 h-5 text-emerald-600" /> Tahun Pelajaran Aktif
          </h2>
          {tahunAktif ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold">TP</span>
              <div>
                <p className="text-sm font-semibold text-emerald-800">{tahunAktif.nama}</p>
                <p className="text-xs text-emerald-600">Semester {tahunAktif.semester === 'ganjil' ? 'Ganjil' : 'Genap'}</p>
              </div>
              <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded">Aktif</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Belum ada tahun pelajaran aktif. Atur di menu Tahun Pelajaran.</p>
          )}
          <p className="mt-2 text-xs text-gray-400">Tahun pelajaran dikelola melalui master Tahun Pelajaran, bukan di sini.</p>
        </section>

        {/* 3. Kepala Sekolah */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            <UserCog className="w-5 h-5 text-emerald-600" /> Kepala Sekolah
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Pilih Kepala Sekolah (dari data Guru/Tendik)</label>
              <select value={settings.kepala_sekolah_id ?? ''} disabled={!canEdit} onChange={(e) => update('kepala_sekolah_id', e.target.value || null)} className={inputCls}>
                <option value="">— Pilih —</option>
                {[...guruList].sort((a, b) => {
                  const aK = (a.jabatan ?? '').toLowerCase().includes('kepala') ? 0 : 1;
                  const bK = (b.jabatan ?? '').toLowerCase().includes('kepala') ? 0 : 1;
                  return aK - bK;
                }).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama_lengkap}{g.jabatan ? ` (${g.jabatan})` : ''}{g.nip ? ` — NIP: ${g.nip}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Guru dengan jabatan "Kepala Sekolah" ditampilkan lebih dahulu.</p>
            </div>
          </div>
          {settings.kepala_sekolah && (() => {
            const kepsekPhoto = getPhotoUrl('profile-photos', settings.kepala_sekolah.foto_url);
            return (
              <div className="mt-4 flex items-start gap-4 rounded-lg bg-gray-50 p-4">
                {kepsekPhoto ? (
                  <img src={kepsekPhoto} alt={settings.kepala_sekolah.nama_lengkap} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-100 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-semibold shrink-0">
                    {settings.kepala_sekolah.nama_lengkap.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                  <div>
                    <p className="text-xs text-gray-500">Nama</p>
                    <p className="text-sm font-medium text-gray-800">{settings.kepala_sekolah.nama_lengkap}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">NIP</p>
                    <p className="text-sm text-gray-700 font-mono">{settings.kepala_sekolah.nip ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">NUPTK</p>
                    <p className="text-sm text-gray-700 font-mono">{settings.kepala_sekolah.nuptk ?? '—'}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Signature upload */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className={labelCls}>Tanda Tangan Kepala Sekolah</label>
            <div className="flex items-center gap-4">
              {sigPreview ? (
                <img src={sigPreview} alt="Tanda Tangan" className="h-20 rounded-lg object-contain border border-gray-200 bg-white px-2" />
              ) : (
                <div className="h-20 w-32 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Belum ada</span>
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                    <Upload className="w-4 h-4" /> {uploadingSig ? 'Mengunggah...' : 'Unggah'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSig} />
                  </label>
                  {sigPreview && (
                    <button type="button" onClick={handleRemoveSignature} className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600 font-medium">
                      <Trash2 className="w-4 h-4" /> Hapus
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Lokasi Sekolah untuk Presensi */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            <MapPin className="w-5 h-5 text-emerald-600" /> Lokasi Sekolah untuk Presensi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelCls}>Latitude</label>
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={settings.latitude ?? ''}
                disabled={!canEdit}
                onChange={(e) => update('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                className={inputCls}
                placeholder="-6.2088"
              />
            </div>
            <div>
              <label className={labelCls}>Longitude</label>
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={settings.longitude ?? ''}
                disabled={!canEdit}
                onChange={(e) => update('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                className={inputCls}
                placeholder="106.8456"
              />
            </div>
            <div>
              <label className={labelCls}>Radius Presensi (meter)</label>
              <input
                type="number"
                min={1}
                value={settings.radius_presensi ?? 100}
                disabled={!canEdit}
                onChange={(e) => update('radius_presensi', e.target.value ? parseInt(e.target.value, 10) : null)}
                className={inputCls}
                placeholder="100"
              />
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition mb-4"
            >
              <MapPin className="w-4 h-4" /> Gunakan Lokasi Saya
            </button>
          )}

          <div className="rounded-xl overflow-hidden border border-gray-200 relative">
            <LeafletMap
              latitude={settings.latitude}
              longitude={settings.longitude}
              radius={settings.radius_presensi ?? 100}
              onLocationChange={(lat, lng) => {
                update('latitude', lat);
                update('longitude', lng);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Klik pada peta atau geser marker untuk mengatur lokasi. Lingkaran menunjukkan radius presensi.
            Lokasi ini menjadi acuan untuk validasi GPS presensi siswa dan guru.
          </p>
          {!canEdit && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <MapPinOff className="w-3.5 h-3.5" /> Hanya admin yang dapat mengubah lokasi.
            </p>
          )}
        </section>

        {/* 5. Jam Kerja Sekolah */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            <Clock className="w-5 h-5 text-emerald-600" /> Jam Kerja Sekolah
          </h2>
          <div className="mb-4">
            <label className={labelCls}>Hari Aktif Sekolah</label>
            <div className="flex flex-wrap gap-2">
              {HARI_OPTIONS.map((hari) => {
                const active = (settings.hari_aktif ?? []).includes(hari);
                return (
                  <button
                    key={hari}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleHari(hari)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                      active
                        ? 'bg-emerald-600 text-white border border-emerald-600'
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {hari}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Jam Mulai Sekolah</label>
              <input type="time" value={settings.jam_mulai ?? '07:00'} disabled={!canEdit} onChange={(e) => update('jam_mulai', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Jam Batas Terlambat</label>
              <input type="time" value={settings.jam_batas_terlambat ?? '07:30'} disabled={!canEdit} onChange={(e) => update('jam_batas_terlambat', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Jam Selesai Sekolah</label>
              <input type="time" value={settings.jam_selesai ?? '15:00'} disabled={!canEdit} onChange={(e) => update('jam_selesai', e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">Jam kerja sekolah hanya sebagai informasi jam operasional. Aturan waktu presensi menggunakan Shift Presensi atau Jadwal Mengajar.</p>
        </section>

        {/* 6. Notifikasi Jadwal */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            <Bell className="w-5 h-5 text-emerald-600" /> Notifikasi Jadwal
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifikasi_jadwal_aktif}
                disabled={!canEdit}
                onChange={(e) => update('notifikasi_jadwal_aktif', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200"
              />
              <span className="text-sm text-gray-700">Aktifkan pengingat jadwal guru</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifikasi_wa}
                disabled={!canEdit || !settings.notifikasi_jadwal_aktif}
                onChange={(e) => update('notifikasi_wa', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200"
              />
              <span className="text-sm text-gray-700">Channel WhatsApp</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifikasi_push}
                disabled={!canEdit || !settings.notifikasi_jadwal_aktif}
                onChange={(e) => update('notifikasi_push', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-200"
              />
              <span className="text-sm text-gray-700">Channel Push</span>
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-400">Detail waktu pengingat akan dikelola pada Pengaturan WhatsApp &amp; Notifikasi.</p>
        </section>

        {/* Save button at bottom */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : saved ? (<><Check className="w-4 h-4" /> Tersimpan</>) : (<><Save className="w-4 h-4" /> Simpan Pengaturan</>)}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Setup admin state
  const [showSetup, setShowSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupForm, setSetupForm] = useState({ email: '', password: '', full_name: '' });
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // Check if setup is needed (no users exist yet)
  async function checkSetupNeeded() {
    try {
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');
      if (count === 0) {
        setShowSetup(true);
      }
    } catch {
      // If we can't check, don't show setup — let login proceed normally
    }
    setSetupChecked(true);
  }

  // Only check once on mount
  if (!setupChecked) {
    checkSetupNeeded();
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: err } = await signIn(email, password);
    if (err) {
      setError('Email atau kata sandi salah.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setSetupLoading(true);
    setError(null);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-admin`;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(setupForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Gagal membuat akun Super Admin.');
        setSetupLoading(false);
        return;
      }
      setSetupSuccess(true);
      setShowSetup(false);
      setSetupLoading(false);
    } catch {
      setError('Gagal terhubung ke server. Silakan coba lagi.');
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-emerald-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SMK NUR INSANI</h1>
              <p className="text-sm text-emerald-200">Sistem Administrasi Sekolah</p>
            </div>
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              Kelola data sekolah<br />dengan mudah dan rapi
            </h2>
            <p className="text-emerald-100 text-lg leading-relaxed max-w-md">
              Platform terpadu untuk mengelola data siswa, guru, kelas, jurusan,
              mata pelajaran, dan tahun pelajaran dalam satu sistem.
            </p>
            <div className="flex gap-8 pt-4">
              <div>
                <p className="text-3xl font-bold">7</p>
                <p className="text-sm text-emerald-200">Modul Data</p>
              </div>
              <div>
                <p className="text-3xl font-bold">100%</p>
                <p className="text-sm text-emerald-200">Berbasis Web</p>
              </div>
              <div>
                <p className="text-3xl font-bold">Responsive</p>
                <p className="text-sm text-emerald-200">HP &amp; Komputer</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-emerald-200/70">
            &copy; {new Date().getFullYear()} SMK NUR INSANI. Semua hak dilindungi.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">SMK NUR INSANI</h1>
              <p className="text-xs text-gray-500">Sistem Administrasi Sekolah</p>
            </div>
          </div>

          {setupSuccess ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Super Admin Berhasil Dibuat</h2>
              <p className="text-sm text-gray-500">
                Akun Super Admin telah dibuat. Silakan masuk dengan email dan kata sandi yang baru saja Anda buat.
              </p>
              <button
                onClick={() => setSetupSuccess(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition"
              >
                Ke Halaman Masuk
              </button>
            </div>
          ) : showSetup ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Setup Super Admin</h2>
                  <p className="text-xs text-gray-500">Pembuatan akun pertama (sekali saja)</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Belum ada akun Super Admin. Buat akun pertama untuk memulai mengelola sistem.
              </p>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={setupForm.full_name}
                    onChange={(e) => setSetupForm({ ...setupForm, full_name: e.target.value })}
                    placeholder="Nama lengkap Super Admin"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={setupForm.email}
                    onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                    placeholder="admin@sekolah.sch.id"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kata Sandi</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={setupForm.password}
                    onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                    placeholder="Minimal 8 karakter, campuran huruf & angka"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Gunakan kata sandi yang kuat: minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={setupLoading}
                  className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition disabled:opacity-60"
                >
                  {setupLoading ? 'Memproses...' : 'Buat Akun Super Admin'}
                </button>
              </form>
              <button
                onClick={() => { setShowSetup(false); setError(null); }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Sudah punya akun? Masuk di sini
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-800">Masuk ke Akun</h2>
              <p className="mt-2 text-sm text-gray-500">
                Silakan masuk untuk mengakses dashboard.
              </p>

              {error && (
                <div className="mt-6 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="nama@sekolah.sch.id"
                      className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kata Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Masukkan kata sandi"
                      className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-10 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition disabled:opacity-60"
                >
                  {loading ? 'Memproses...' : 'Masuk'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

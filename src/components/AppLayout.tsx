import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap, LayoutDashboard, Users, UserCog, School, Layers,
  BookOpen, CalendarDays, History, DoorOpen, Clock, LogOut, Menu, X,
  ChevronDown, ShieldCheck, Bell, ClipboardList, FileText, BookMarked,
  Award, Briefcase, Trophy, Activity, BarChart3, Settings, CalendarCheck,
  Hourglass, MessageSquare, PanelLeftClose, PanelLeftOpen, User, Cpu,
  FileBarChart,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, type Role } from '@/types/database';

type IconType = typeof LayoutDashboard;

interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  adminOnly?: boolean;
  roles?: Role[];
  comingSoon?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Data Sekolah',
    items: [
      { to: '/siswa', label: 'Siswa', icon: Users },
      { to: '/guru-tendik', label: 'Guru & Tendik', icon: UserCog },
      { to: '/kelas', label: 'Data Kelas', icon: School },
      { to: '/jurusan', label: 'Jurusan', icon: Layers },
      { to: '/mata-pelajaran', label: 'Mata Pelajaran', icon: BookOpen },
      { to: '/tahun-pelajaran', label: 'Tahun Pelajaran', icon: CalendarDays },
      { to: '/ruangan', label: 'Ruangan', icon: DoorOpen },
      { to: '/shift-presensi', label: 'Shift Presensi', icon: Clock },
      { to: '/kalender-pendidikan', label: 'Kalender Pendidikan', icon: CalendarCheck },
      { to: '/riwayat-kelas', label: 'Riwayat Kelas Siswa', icon: History },
    ],
  },
  {
    title: 'Pembelajaran',
    items: [
      { to: '/jadwal-mengajar', label: 'Jadwal Mengajar', icon: BookMarked },
      { to: '/jam-pelajaran', label: 'Jam Pelajaran', icon: Hourglass, adminOnly: true },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { to: '/presensi', label: 'Presensi', icon: ClipboardList },
      { to: '/laporan-presensi', label: 'Laporan Presensi', icon: FileBarChart },
      { to: '/cbt', label: 'CBT / Ujian', icon: FileText, comingSoon: true },
      { to: '/log-aktivitas', label: 'Log Aktivitas', icon: Activity, comingSoon: true },
    ],
  },
  {
    title: 'Pengaturan',
    items: [
      { to: '/pengaturan-sekolah', label: 'Pengaturan Sekolah', icon: Settings, roles: ['super_admin', 'admin', 'kepala_sekolah'] },
      { to: '/iot-rfid', label: 'IoT RFID Integration', icon: Cpu, adminOnly: true },
      { to: '/whatsapp-notifikasi', label: 'WhatsApp & Notifikasi', icon: MessageSquare, adminOnly: true },
      { to: '/pengguna', label: 'Manajemen Pengguna', icon: ShieldCheck, adminOnly: true },
    ],
  },
];

function formatRoles(roles: Role[]): string {
  if (roles.length === 0) return 'Tanpa Role';
  return roles.map((r) => ROLE_LABELS[r]).join(', ');
}

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/siswa': 'Siswa',
  '/guru-tendik': 'Guru & Tendik',
  '/kelas': 'Data Kelas',
  '/jurusan': 'Jurusan',
  '/mata-pelajaran': 'Mata Pelajaran',
  '/tahun-pelajaran': 'Tahun Pelajaran',
  '/ruangan': 'Ruangan',
  '/shift-presensi': 'Shift Presensi',
  '/kalender-pendidikan': 'Kalender Pendidikan',
  '/riwayat-kelas': 'Riwayat Kelas Siswa',
  '/jadwal-mengajar': 'Jadwal Mengajar',
  '/jam-pelajaran': 'Jam Pelajaran',
  '/presensi': 'Presensi',
  '/laporan-presensi': 'Laporan Presensi',
  '/cbt': 'CBT / Ujian',
  '/log-aktivitas': 'Log Aktivitas',
  '/pengaturan-sekolah': 'Pengaturan Sekolah',
  '/whatsapp-notifikasi': 'WhatsApp & Notifikasi',
  '/iot-rfid': 'IoT RFID Integration',
  '/pengguna': 'Manajemen Pengguna',
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, isAdmin, hasAnyRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles) return hasAnyRole(...item.roles);
        if (item.adminOnly) return isAdmin();
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  const currentLabel = routeLabels[location.pathname] ?? 'Dashboard';
  const sidebarWidth = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64';

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-800 text-slate-100">
      {/* Header */}
      <div className={`flex items-center gap-3 border-b border-slate-700/50 shrink-0 ${sidebarCollapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4'}`}>
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-md">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold tracking-tight truncate text-white">SMK NUR INSANI</h1>
            <p className="text-[11px] text-slate-400 truncate">Sistem Administrasi Sekolah</p>
          </div>
        )}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden rounded-lg p-1.5 hover:bg-slate-700 transition shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3 sidebar-scroll">
        {visibleSections.map((section, si) => (
          <div key={si}>
            {!sidebarCollapsed && section.title && (
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg text-sm font-medium transition relative group ${
                      sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate flex-1">{item.label}</span>}
                  {!sidebarCollapsed && item.comingSoon && (
                    <span className="text-[9px] font-bold uppercase rounded bg-slate-600/60 px-1.5 py-0.5 text-slate-200">
                      Soon
                    </span>
                  )}
                  {sidebarCollapsed && item.comingSoon && (
                    <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                  {sidebarCollapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 shadow-lg">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/50 p-2 shrink-0">
        <div className={`flex items-center gap-3 rounded-lg ${sidebarCollapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'}`}>
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
            {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-white">{profile?.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{formatRoles(roles)}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={handleSignOut}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-30 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarWidth}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 backdrop-blur-md px-4 py-3 h-14">
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition"
            title={sidebarCollapsed ? 'Lebarkan sidebar' : 'Persempit sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-sm overflow-hidden">
            <NavLink to="/" className="text-gray-400 hover:text-emerald-600 transition shrink-0">Dashboard</NavLink>
            {location.pathname !== '/' && (
              <>
                <span className="text-gray-300 shrink-0">/</span>
                {(location.pathname === '/presensi' || location.pathname === '/laporan-presensi') ? (
                  <>
                    <NavLink to="/presensi" className={`shrink-0 transition ${location.pathname === '/presensi' ? 'font-semibold text-gray-800' : 'text-gray-400 hover:text-emerald-600'}`}>Presensi</NavLink>
                    {location.pathname === '/laporan-presensi' && (
                      <>
                        <span className="text-gray-300 shrink-0">/</span>
                        <span className="font-semibold text-gray-800 truncate">Laporan Presensi</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="font-semibold text-gray-800 truncate">{currentLabel}</span>
                )}
              </>
            )}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition" title="Notifikasi">
              <Bell className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-semibold text-white">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-medium text-gray-800 max-w-[130px] truncate">{profile?.full_name}</p>
                  <p className="text-[10px] text-gray-500 max-w-[130px] truncate">{formatRoles(roles)}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                          {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{profile?.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{formatRoles(roles)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600">
                        <User className="w-4 h-4 text-gray-400" /> Profil
                      </div>
                    </div>
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        <LogOut className="w-4 h-4" /> Keluar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

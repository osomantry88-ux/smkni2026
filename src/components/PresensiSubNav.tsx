import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, CalendarDays, FileBarChart, Settings } from 'lucide-react';

const tabs = [
  { to: '/presensi', label: 'Presensi Hari Ini', icon: ClipboardList, match: (path: string, search: string) => path === '/presensi' && !search.includes('tab=') },
  { to: '/presensi?tab=rekap', label: 'Rekap Presensi', icon: CalendarDays, match: (_path: string, search: string) => search.includes('tab=rekap') },
  { to: '/laporan-presensi', label: 'Laporan Presensi', icon: FileBarChart, match: (path: string) => path === '/laporan-presensi' },
  { to: '/presensi?tab=pengaturan', label: 'Pengaturan Presensi', icon: Settings, match: (_path: string, search: string) => search.includes('tab=pengaturan') },
];

export default function PresensiSubNav() {
  const { pathname, search } = useLocation();

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200">
      {tabs.map((t) => {
        const active = t.match(pathname, search);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              active
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

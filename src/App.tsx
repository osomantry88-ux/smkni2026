import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Siswa from '@/pages/Siswa';
import GuruTendik from '@/pages/GuruTendik';
import Kelas from '@/pages/Kelas';
import Jurusan from '@/pages/Jurusan';
import MataPelajaran from '@/pages/MataPelajaran';
import TahunPelajaran from '@/pages/TahunPelajaran';
import SiswaKelasRiwayat from '@/pages/SiswaKelasRiwayat';
import Ruangan from '@/pages/Ruangan';
import ShiftPresensi from '@/pages/ShiftPresensi';
import JamPelajaran from '@/pages/JamPelajaran';
import JadwalMengajar from '@/pages/JadwalMengajar';
import KalenderPendidikan from '@/pages/KalenderPendidikan';
import Pengguna from '@/pages/Pengguna';
import PengaturanSekolah from '@/pages/PengaturanSekolah';
import WhatsAppNotifikasi from '@/pages/WhatsAppNotifikasi';
import Presensi from '@/pages/Presensi';
import LaporanPresensi from '@/pages/LaporanPresensi';
import IoTRFID from '@/pages/IoTRFID';
import type { Role } from '@/types/database';

const adminRoles: Role[] = ['super_admin', 'admin'];
const settingsRoles: Role[] = ['super_admin', 'admin', 'kepala_sekolah'];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/siswa"
            element={
              <ProtectedRoute>
                <Siswa />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guru-tendik"
            element={
              <ProtectedRoute>
                <GuruTendik />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kelas"
            element={
              <ProtectedRoute>
                <Kelas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jurusan"
            element={
              <ProtectedRoute>
                <Jurusan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mata-pelajaran"
            element={
              <ProtectedRoute>
                <MataPelajaran />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tahun-pelajaran"
            element={
              <ProtectedRoute>
                <TahunPelajaran />
              </ProtectedRoute>
            }
          />
          <Route
            path="/riwayat-kelas"
            element={
              <ProtectedRoute>
                <SiswaKelasRiwayat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ruangan"
            element={
              <ProtectedRoute>
                <Ruangan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shift-presensi"
            element={
              <ProtectedRoute>
                <ShiftPresensi />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jam-pelajaran"
            element={
              <ProtectedRoute roles={adminRoles}>
                <JamPelajaran />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jadwal-mengajar"
            element={
              <ProtectedRoute>
                <JadwalMengajar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kalender-pendidikan"
            element={
              <ProtectedRoute>
                <KalenderPendidikan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pengguna"
            element={
              <ProtectedRoute roles={adminRoles}>
                <Pengguna />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pengaturan-sekolah"
            element={
              <ProtectedRoute roles={settingsRoles}>
                <PengaturanSekolah />
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp-notifikasi"
            element={
              <ProtectedRoute roles={adminRoles}>
                <WhatsAppNotifikasi />
              </ProtectedRoute>
            }
          />
          <Route
            path="/presensi"
            element={
              <ProtectedRoute>
                <Presensi />
              </ProtectedRoute>
            }
          />
          <Route
            path="/laporan-presensi"
            element={
              <ProtectedRoute>
                <LaporanPresensi />
              </ProtectedRoute>
            }
          />
          <Route
            path="/iot-rfid"
            element={
              <ProtectedRoute roles={adminRoles}>
                <IoTRFID />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

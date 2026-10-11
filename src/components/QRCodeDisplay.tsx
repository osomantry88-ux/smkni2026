import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Printer } from 'lucide-react';
import Modal from '@/components/Modal';

interface QRCodeDisplayProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function getGuruQrSource(g: { nip: string | null; nuptk: string | null; nik: string | null }): { value: string; source: string } | null {
  if (g.nip && g.nip.trim()) return { value: g.nip.trim(), source: 'NIP' };
  if (g.nuptk && g.nuptk.trim()) return { value: g.nuptk.trim(), source: 'NUPTK' };
  if (g.nik && g.nik.trim()) return { value: g.nik.trim(), source: 'NIK' };
  return null;
}

export function getSiswaQrSource(s: { nisn: string | null }): { value: string; source: string } | null {
  if (s.nisn && s.nisn.trim()) return { value: s.nisn.trim(), source: 'NISN' };
  return null;
}

export default function QRCodeDisplay({ value, label, sublabel }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: 160,
      margin: 2,
      color: { dark: '#065f46', light: '#ffffff' },
    }, () => {
      QRCode.toDataURL(value, {
        width: 300,
        margin: 2,
        color: { dark: '#065f46', light: '#ffffff' },
      }).then(setDataUrl).catch(() => {});
    });
  }, [value]);

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak QR Code - ${label}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              font-family: 'Segoe UI', Arial, sans-serif;
              background: white;
            }
            .card {
              border: 2px solid #065f46;
              border-radius: 12px;
              padding: 24px;
              text-align: center;
              width: 320px;
            }
            .header {
              color: #065f46;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 4px;
            }
            .subheader {
              color: #666;
              font-size: 12px;
              margin-bottom: 16px;
            }
            .qr-img { width: 250px; height: 250px; }
            .label {
              margin-top: 16px;
              font-size: 18px;
              font-weight: 600;
              color: #1f2937;
            }
            .sublabel {
              font-size: 13px;
              color: #666;
              margin-top: 4px;
            }
            .id-text {
              margin-top: 12px;
              font-family: monospace;
              font-size: 14px;
              color: #065f46;
              font-weight: 600;
            }
            @media print { @page { margin: 0.5cm; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">SMK NUR INSANI</div>
            <div class="subheader">Kartu Presensi QR Code</div>
            <img src="${dataUrl}" class="qr-img" alt="QR Code" />
            <div class="label">${label}</div>
            ${sublabel ? `<div class="sublabel">${sublabel}</div>` : ''}
            <div class="id-text">${value}</div>
          </div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (!value) {
    return (
      <div className="text-center py-4 text-sm text-gray-400">
        Belum ada data untuk membuat QR Code.
        Pastikan NISN (siswa) atau NIP/NUPTK/NIK (guru) telah diisi.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-xl border-2 border-emerald-100 bg-white p-3 shadow-sm">
          <canvas ref={canvasRef} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <QrCode className="w-4 h-4" /> Tampilkan QR
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition"
          >
            <Printer className="w-4 h-4" /> Cetak QR
          </button>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="QR Code Presensi" size="sm">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border-2 border-emerald-100 bg-white p-4">
            <canvas ref={canvasRef} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800">{label}</p>
            {sublabel && <p className="text-sm text-gray-500">{sublabel}</p>}
            <p className="mt-2 font-mono text-sm text-emerald-700 font-semibold">{value}</p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition"
          >
            <Printer className="w-4 h-4" /> Cetak QR
          </button>
        </div>
      </Modal>
    </>
  );
}


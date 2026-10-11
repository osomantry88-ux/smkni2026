import { useState, useRef, type ReactNode } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download, FileDown } from 'lucide-react';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import { parseExcelFile, downloadErrorReport, type ImportColumn, type ImportRow } from '@/lib/importUtils';

export type ImportMode = 'skip' | 'update';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: ImportColumn[];
  sheetName: string;
  onDownloadTemplate: () => void;
  onValidate: (rows: Record<string, string>[]) => Promise<ImportRow[]>;
  onImport: (validRows: Record<string, string>[], mode: ImportMode) => Promise<{ succeeded: number; failed: number; errors: string[] }>;
  onExport?: () => void;
  extraActions?: ReactNode;
}

type Step = 'upload' | 'preview' | 'importing' | 'result';

export default function ImportModal({
  open,
  onClose,
  title,
  columns,
  sheetName,
  onDownloadTemplate,
  onValidate,
  onImport,
  onExport,
  extraActions,
}: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [validatedRows, setValidatedRows] = useState<ImportRow[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('skip');
  const [importResult, setImportResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('upload');
    setFileName('');
    setRawRows([]);
    setValidatedRows([]);
    setImportResult(null);
    setError(null);
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const columnKeys = columns.map((c) => c.key);
      const rows = await parseExcelFile(file, columnKeys);
      if (rows.length === 0) {
        setError('File tidak berisi data atau format tidak sesuai.');
        setBusy(false);
        return;
      }
      setRawRows(rows);
      const validated = await onValidate(rows);
      setValidatedRows(validated);
      setStep('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Gagal membaca file: ${msg}`);
    }
    setBusy(false);
  }

  const validRows = validatedRows.filter((r) => r.status === 'valid');
  const errorRows = validatedRows.filter((r) => r.status === 'error');
  const validRawRows = validRows.map((r) => r.data);

  async function handleConfirmImport() {
    setBusy(true);
    setError(null);
    setStep('importing');
    try {
      const result = await onImport(validRawRows, importMode);
      setImportResult(result);
      setStep('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Gagal import: ${msg}`);
      setStep('preview');
    }
    setBusy(false);
  }

  const totalRows = validatedRows.length;

  return (
    <Modal open={open} onClose={handleClose} title={title} size="xl">
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1 ${step === 'upload' ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</span> Upload
          </span>
          <span className="text-gray-300">→</span>
          <span className={`flex items-center gap-1 ${step === 'preview' || step === 'importing' ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'preview' || step === 'importing' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</span> Validasi
          </span>
          <span className="text-gray-300">→</span>
          <span className={`flex items-center gap-1 ${step === 'result' ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'result' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</span> Hasil
          </span>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-sm text-emerald-800">
                <strong>Petunjuk:</strong> Download template, isi data sesuai kolom, lalu upload file.
                Tanggal dalam format YYYY-MM-DD (contoh: 2008-01-15).
                Baris pertama template adalah contoh — hapus sebelum upload.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onDownloadTemplate}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition"
              >
                <FileSpreadsheet className="w-4 h-4" /> Download Template
              </button>
              {onExport && (
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  <FileDown className="w-4 h-4" /> Export Data
                </button>
              )}
              {extraActions}
            </div>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">Klik untuk pilih file Excel/CSV</p>
              <p className="text-xs text-gray-400 mt-1">Format: .xlsx, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {fileName && <p className="text-sm text-gray-600">File: <strong>{fileName}</strong></p>}
          </div>
        )}

        {/* Step 2: Preview & Validation */}
        {(step === 'preview' || step === 'importing') && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-center">
                <p className="text-2xl font-bold text-gray-800">{totalRows}</p>
                <p className="text-xs text-gray-500">Total Baris</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-center">
                <p className="text-2xl font-bold text-emerald-700">{validRows.length}</p>
                <p className="text-xs text-emerald-600">Valid</p>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-center">
                <p className="text-2xl font-bold text-red-600">{errorRows.length}</p>
                <p className="text-xs text-red-500">Error</p>
              </div>
            </div>

            {errorRows.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorRows.length} baris memiliki error dan tidak akan diimport. Perbaiki data di Excel dan upload ulang, atau lanjutkan import hanya baris yang valid.
                </p>
              </div>
            )}

            {/* Import mode for duplicates */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Jika data sudah ada:</p>
              <div className="flex gap-3">
                <label className={`flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer transition ${importMode === 'skip' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                  <input type="radio" checked={importMode === 'skip'} onChange={() => setImportMode('skip')} className="text-emerald-600" />
                  <span className="text-sm">Lewati data yang sudah ada</span>
                </label>
                <label className={`flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer transition ${importMode === 'update' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                  <input type="radio" checked={importMode === 'update'} onChange={() => setImportMode('update')} className="text-emerald-600" />
                  <span className="text-sm">Perbarui data yang sudah ada</span>
                </label>
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2 w-8">Baris</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2 hidden sm:table-cell">Error</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {validatedRows.slice(0, 100).map((row) => (
                    <tr key={row.rowNumber} className={row.status === 'error' ? 'bg-red-50/50' : ''}>
                      <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[180px]">
                        {row.data['Nama Lengkap'] ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-red-600 hidden sm:table-cell">
                        {row.errors.join('; ') || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'valid' ? (
                          <Badge variant="success"><CheckCircle2 className="w-3 h-3 inline mr-1" />Valid</Badge>
                        ) : (
                          <Badge variant="error"><XCircle className="w-3 h-3 inline mr-1" />Error</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validatedRows.length > 100 && (
                <p className="text-center text-xs text-gray-400 py-2">Menampilkan 100 dari {validatedRows.length} baris</p>
              )}
            </div>

            {errorRows.length > 0 && (
              <button
                onClick={() => downloadErrorReport(validatedRows)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
              >
                <Download className="w-4 h-4" /> Download Laporan Error
              </button>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <button onClick={() => setStep('upload')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Kembali
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={busy || validRows.length === 0}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition disabled:opacity-60"
              >
                {busy ? 'Mengimport...' : `Import ${validRows.length} Baris Valid`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && importResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                <p className="text-3xl font-bold text-gray-800">{totalRows}</p>
                <p className="text-xs text-gray-500 mt-1">Total Baris</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-3 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-3xl font-bold text-emerald-700">{importResult.succeeded}</p>
                <p className="text-xs text-emerald-600 mt-1">Berhasil</p>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-3 text-center">
                <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                <p className="text-3xl font-bold text-red-600">{importResult.failed}</p>
                <p className="text-xs text-red-500 mt-1">Gagal</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">Detail Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importResult.errors.map((err, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs text-red-600">{err}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleClose} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition">
                Selesai
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {busy && step === 'importing' && (
          <p className="text-sm text-emerald-700 animate-pulse">Sedang mengimport data ke database...</p>
        )}
      </div>
    </Modal>
  );
}

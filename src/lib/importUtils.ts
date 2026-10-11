import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export interface ImportRow {
  rowNumber: number;
  data: Record<string, string>;
  status: 'valid' | 'error' | 'skip';
  errors: string[];
}

export interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: ImportRow[];
  successRows: ImportRow[];
}

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'date' | 'select';
  options?: string[];
}

export async function parseExcelFile(file: File, columnKeys: string[]): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rawRows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const key of columnKeys) {
      const val = row[key];
      if (val instanceof Date) {
        mapped[key] = val.toISOString().split('T')[0];
      } else if (typeof val === 'number') {
        mapped[key] = String(val);
      } else {
        mapped[key] = (val ?? '').toString().trim();
      }
    }
    return mapped;
  });
}

export function downloadTemplate(columns: ImportColumn[], sheetName: string, instructions?: string[]) {
  const headers: Record<string, string> = {};
  for (const col of columns) {
    headers[col.key] = col.label;
  }

  const exampleRow: Record<string, string> = {};
  for (const col of columns) {
    if (col.key === 'Nama Lengkap') exampleRow[col.key] = 'CONTOH - Budi Santoso';
    else if (col.key === 'NIS') exampleRow[col.key] = 'CONTOH - 2024001';
    else if (col.key === 'NISN') exampleRow[col.key] = 'CONTOH - 0091234567';
    else if (col.key === 'NIK') exampleRow[col.key] = 'CONTOH - 3201010101900001';
    else if (col.key === 'Jenis Kelamin') exampleRow[col.key] = 'CONTOH - L';
    else if (col.key === 'Tempat Lahir') exampleRow[col.key] = 'CONTOH - Bandung';
    else if (col.key === 'Tanggal Lahir') exampleRow[col.key] = 'CONTOH - 2008-01-15';
    else if (col.key === 'Agama') exampleRow[col.key] = 'CONTOH - Islam';
    else if (col.key === 'Status Siswa') exampleRow[col.key] = 'CONTOH - aktif';
    else if (col.key === 'Status') exampleRow[col.key] = 'CONTOH - PNS';
    else if (col.key === 'Jenis') exampleRow[col.key] = 'CONTOH - Guru';
    else if (col.key === 'NIP') exampleRow[col.key] = 'CONTOH - 196501011990031001';
    else if (col.key === 'NUPTK') exampleRow[col.key] = 'CONTOH - 1234567890';
    else if (col.key === 'No HP') exampleRow[col.key] = 'CONTOH - 081234567890';
    else if (col.key === 'No HP/WA Ayah') exampleRow[col.key] = 'CONTOH - 081234567891';
    else if (col.key === 'Tahun Pelajaran') exampleRow[col.key] = 'CONTOH - 2026/2027';
    else if (col.key === 'Kelas') exampleRow[col.key] = 'CONTOH - X TKJ 1';
    else exampleRow[col.key] = '';
  }

  const ws = XLSX.utils.json_to_sheet([headers, exampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (instructions && instructions.length > 0) {
    const instructionRows = instructions.map((text, i) => ({ No: i + 1, Petunjuk: text }));
    const wsPetunjuk = XLSX.utils.json_to_sheet(instructionRows, { header: ['No', 'Petunjuk'] });
    wsPetunjuk['!cols'] = [{ wch: 5 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'PETUNJUK');
  }

  XLSX.writeFile(wb, `Template_${sheetName}.xlsx`);
}

export function exportToExcel(rows: Record<string, string>[], columns: ImportColumn[], sheetName: string) {
  const labeledRows = rows.map((row) => {
    const labeled: Record<string, string> = {};
    for (const col of columns) {
      labeled[col.label] = row[col.key] ?? '';
    }
    return labeled;
  });
  const ws = XLSX.utils.json_to_sheet(labeledRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `Export_${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function checkExistingSiswa(nisList: string[], nisnList: string[], nikList: string[], rfidList: string[]) {
  const [nisRes, nisnRes, nikRes, rfidRes] = await Promise.all([
    supabase.from('siswa').select('nis').in('nis', nisList.filter(Boolean)),
    supabase.from('siswa').select('nisn').in('nisn', nisnList.filter(Boolean)),
    supabase.from('siswa').select('nik').in('nik', nikList.filter(Boolean)).not('nik', 'is', null),
    supabase.from('siswa').select('no_rfid').in('no_rfid', rfidList.filter(Boolean)),
  ]);

  const existingNis = new Set((nisRes.data ?? []).map((r: { nis: string }) => r.nis));
  const existingNisn = new Set((nisnRes.data ?? []).map((r: { nisn: string }) => r.nisn));
  const existingNik = new Set((nikRes.data ?? []).map((r: { nik: string }) => r.nik));
  const existingRfid = new Set((rfidRes.data ?? []).map((r: { no_rfid: string }) => r.no_rfid));

  return { existingNis, existingNisn, existingNik, existingRfid };
}

export async function checkExistingGuru(nipList: string[], nuptkList: string[], nikList: string[], rfidList: string[]) {
  const [nipRes, nuptkRes, nikRes, rfidRes] = await Promise.all([
    supabase.from('guru_tendik').select('nip').in('nip', nipList.filter(Boolean)),
    supabase.from('guru_tendik').select('nuptk').in('nuptk', nuptkList.filter(Boolean)),
    supabase.from('guru_tendik').select('nik').in('nik', nikList.filter(Boolean)).not('nik', 'is', null),
    supabase.from('guru_tendik').select('no_rfid').in('no_rfid', rfidList.filter(Boolean)),
  ]);

  const existingNip = new Set((nipRes.data ?? []).map((r: { nip: string }) => r.nip));
  const existingNuptk = new Set((nuptkRes.data ?? []).map((r: { nuptk: string }) => r.nuptk));
  const existingNik = new Set((nikRes.data ?? []).map((r: { nik: string }) => r.nik));
  const existingRfid = new Set((rfidRes.data ?? []).map((r: { no_rfid: string }) => r.no_rfid));

  return { existingNip, existingNuptk, existingNik, existingRfid };
}

export function downloadErrorReport(rows: ImportRow[]) {
  const errorData = rows
    .filter((r) => r.status === 'error')
    .map((r) => ({
      'Baris': r.rowNumber,
      'Nama': r.data['Nama Lengkap'] ?? r.data['Nama Lengkap'] ?? '',
      'Kolom': r.errors.map((e) => e.split(':')[0]).join('; '),
      'Masalah': r.errors.join('; '),
      'Status': 'ERROR',
    }));

  if (errorData.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(errorData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Error Report');
  XLSX.writeFile(wb, `Laporan_Error_Import_${new Date().toISOString().split('T')[0]}.xlsx`);
}

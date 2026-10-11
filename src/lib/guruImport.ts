import { supabase } from '@/lib/supabase';
import {
  checkExistingGuru,
  type ImportColumn,
  type ImportRow,
} from '@/lib/importUtils';

export const guruImportColumns: ImportColumn[] = [
  { key: 'NIP', label: 'NIP' },
  { key: 'NUPTK', label: 'NUPTK' },
  { key: 'NIK', label: 'NIK' },
  { key: 'Nama Lengkap', label: 'Nama Lengkap', required: true },
  { key: 'Jenis Kelamin', label: 'Jenis Kelamin', type: 'select', options: ['L', 'P'] },
  { key: 'Tempat Lahir', label: 'Tempat Lahir' },
  { key: 'Tanggal Lahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'Agama', label: 'Agama' },
  { key: 'Alamat', label: 'Alamat' },
  { key: 'No HP', label: 'No HP' },
  { key: 'Email', label: 'Email' },
  { key: 'Jenis', label: 'Jenis', required: true, type: 'select', options: ['Guru', 'Tendik'] },
  { key: 'Status', label: 'Status Kepegawaian' },
  { key: 'RFID', label: 'RFID' },
];

const validGenders = ['L', 'P', 'l', 'p'];
const validAgama = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];

function getGuruUsername(row: Record<string, string>): string | null {
  const nip = row['NIP']?.trim();
  const nuptk = row['NUPTK']?.trim();
  const nik = row['NIK']?.trim();
  return nip || nuptk || nik || null;
}

export async function validateGuruRows(
  rows: Record<string, string>[],
): Promise<ImportRow[]> {
  const nipList = rows.map((r) => r['NIP']?.trim()).filter(Boolean) as string[];
  const nuptkList = rows.map((r) => r['NUPTK']?.trim()).filter(Boolean) as string[];
  const nikList = rows.map((r) => r['NIK']?.trim()).filter(Boolean) as string[];
  const rfidList = rows.map((r) => r['RFID']?.trim()).filter(Boolean) as string[];

  const existing = await checkExistingGuru(nipList, nuptkList, nikList, rfidList);

  const seenNip = new Set<string>();
  const seenNuptk = new Set<string>();
  const seenNik = new Set<string>();
  const seenRfid = new Set<string>();
  const seenUsername = new Set<string>();

  return rows.map((data, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];

    const nip = data['NIP']?.trim() ?? '';
    const nuptk = data['NUPTK']?.trim() ?? '';
    const nik = data['NIK']?.trim() ?? '';
    const nama = data['Nama Lengkap']?.trim() ?? '';
    const gender = data['Jenis Kelamin']?.trim() ?? '';
    const jenis = data['Jenis']?.trim() ?? '';
    const rfid = data['RFID']?.trim() ?? '';
    const email = data['Email']?.trim() ?? '';
    const tglLahir = data['Tanggal Lahir']?.trim() ?? '';

    if (!nama) errors.push('Nama Lengkap: wajib diisi');

    if (!jenis) errors.push('Jenis: wajib diisi (Guru atau Tendik)');
    else if (jenis !== 'Guru' && jenis !== 'Tendik') errors.push('Jenis: harus Guru atau Tendik');

    if (nip) {
      if (existing.existingNip.has(nip)) errors.push('NIP: sudah terdaftar di database');
      else if (seenNip.has(nip)) errors.push('NIP: duplikat dalam file');
      else seenNip.add(nip);
    }

    if (nuptk) {
      if (existing.existingNuptk.has(nuptk)) errors.push('NUPTK: sudah terdaftar di database');
      else if (seenNuptk.has(nuptk)) errors.push('NUPTK: duplikat dalam file');
      else seenNuptk.add(nuptk);
    }

    if (nik) {
      if (existing.existingNik.has(nik)) errors.push('NIK: sudah terdaftar di database');
      else if (seenNik.has(nik)) errors.push('NIK: duplikat dalam file');
      else seenNik.add(nik);
    }

    if (rfid) {
      if (existing.existingRfid.has(rfid)) errors.push('RFID: sudah digunakan');
      else if (seenRfid.has(rfid)) errors.push('RFID: duplikat dalam file');
      else seenRfid.add(rfid);
    }

    const username = getGuruUsername(data);
    if (!username) errors.push('Username: NIP, NUPTK, dan NIK kosong — tidak bisa membuat akun');
    else if (seenUsername.has(username)) errors.push('Username: duplikat dalam file');
    else seenUsername.add(username);

    if (gender && !validGenders.includes(gender)) errors.push('Jenis Kelamin: harus L atau P');

    if (tglLahir && isNaN(Date.parse(tglLahir))) errors.push('Tanggal Lahir: format tidak valid (YYYY-MM-DD)');

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email: format tidak valid');

    const agama = data['Agama']?.trim() ?? '';
    if (agama && !validAgama.includes(agama)) errors.push('Agama: tidak valid');

    return {
      rowNumber,
      data,
      status: errors.length > 0 ? 'error' : 'valid',
      errors,
    };
  });
}

export async function importGuruRows(
  validRows: Record<string, string>[],
  mode: 'skip' | 'update',
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const accountsToCreate: {
    email: string;
    password: string;
    full_name: string;
    roles: string[];
    link_to: { table: 'siswa' | 'guru_tendik'; id: string };
  }[] = [];

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of validRows) {
    const nama = row['Nama Lengkap']?.trim();
    if (!nama) { failed++; errors.push('Baris tanpa nama'); continue; }

    const nip = row['NIP']?.trim() || null;
    const nuptk = row['NUPTK']?.trim() || null;
    const nik = row['NIK']?.trim() || null;
    const username = getGuruUsername(row);
    if (!username) { failed++; errors.push(`${nama}: tidak ada NIP/NUPTK/NIK`); continue; }

    const jenis = (row['Jenis']?.trim().toLowerCase() || 'guru') as 'guru' | 'tendik';
    const gender = row['Jenis Kelamin']?.trim() || null;

    const payload = {
      nip,
      nuptk,
      nik,
      no_rfid: row['RFID']?.trim() || null,
      nama_lengkap: nama,
      jenis_kelamin: (gender?.toUpperCase() as 'L' | 'P') || null,
      tempat_lahir: row['Tempat Lahir']?.trim() || null,
      tanggal_lahir: row['Tanggal Lahir']?.trim() || null,
      agama: row['Agama']?.trim() || null,
      alamat: row['Alamat']?.trim() || null,
      no_hp: row['No HP']?.trim() || null,
      email: row['Email']?.trim() || null,
      jenis_ptk: jenis,
      status_kepegawaian: row['Status']?.trim() || null,
      aktif: true,
      shift_presensi_id: null,
    };

    let guruId: string | null = null;

    try {
      if (mode === 'update') {
        let existingId: string | null = null;
        if (nip) {
          const { data } = await supabase.from('guru_tendik').select('id').eq('nip', nip).maybeSingle();
          if (data) existingId = data.id;
        }
        if (!existingId && nuptk) {
          const { data } = await supabase.from('guru_tendik').select('id').eq('nuptk', nuptk).maybeSingle();
          if (data) existingId = data.id;
        }
        if (!existingId && nik) {
          const { data } = await supabase.from('guru_tendik').select('id').eq('nik', nik).maybeSingle();
          if (data) existingId = data.id;
        }

        if (existingId) {
          const { error: updateErr } = await supabase.from('guru_tendik').update(payload).eq('id', existingId);
          if (updateErr) { failed++; errors.push(`${nama}: ${updateErr.message}`); continue; }
          guruId = existingId;
        }
      }

      if (!guruId) {
        const { data, error: insertErr } = await supabase.from('guru_tendik').insert(payload).select('id').single();
        if (insertErr) { failed++; errors.push(`${nama}: ${insertErr.message}`); continue; }
        guruId = data.id;
      }

      if (guruId && payload.no_rfid) {
        await supabase.from('rfid_history').insert({
          person_type: 'guru_tendik',
          person_id: guruId,
          no_rfid: payload.no_rfid,
          status: 'aktif',
        });
      }

      if (guruId && username) {
        accountsToCreate.push({
          email: `${username}@nurinsani.sch.id`,
          password: username,
          full_name: nama,
          roles: [jenis],
          link_to: { table: 'guru_tendik' as const, id: guruId },
        });
      }

      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed++;
      errors.push(`${nama}: ${msg}`);
    }
  }

  if (accountsToCreate.length > 0) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-accounts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ accounts: accountsToCreate }),
          }
        );
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          errors.push(`Pembuatan akun: ${errBody.error ?? res.statusText}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Pembuatan akun gagal: ${msg}`);
    }
  }

  return { succeeded, failed, errors };
}

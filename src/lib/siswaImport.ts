import { supabase } from '@/lib/supabase';
import {
  checkExistingSiswa,
  type ImportColumn,
  type ImportRow,
} from '@/lib/importUtils';
import type { Kelas, TahunPelajaran } from '@/types/database';

export const siswaImportColumns: ImportColumn[] = [
  { key: 'NIS', label: 'NIS', required: true },
  { key: 'NISN', label: 'NISN', required: true },
  { key: 'NIK', label: 'NIK' },
  { key: 'Nama Lengkap', label: 'Nama Lengkap', required: true },
  { key: 'Jenis Kelamin', label: 'Jenis Kelamin', type: 'select', options: ['L', 'P'] },
  { key: 'Tempat Lahir', label: 'Tempat Lahir' },
  { key: 'Tanggal Lahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'Agama', label: 'Agama' },
  { key: 'Alamat', label: 'Alamat' },
  { key: 'No HP', label: 'No HP' },
  { key: 'Email', label: 'Email' },
  { key: 'Status Siswa', label: 'Status Siswa', type: 'select', options: ['aktif', 'lulus', 'pindah', 'keluar'] },
  { key: 'RFID', label: 'RFID' },
  { key: 'Nama Ayah', label: 'Nama Ayah' },
  { key: 'NIK Ayah', label: 'NIK Ayah' },
  { key: 'Tahun Lahir Ayah', label: 'Tahun Lahir Ayah' },
  { key: 'Pendidikan Ayah', label: 'Pendidikan Ayah' },
  { key: 'Pekerjaan Ayah', label: 'Pekerjaan Ayah' },
  { key: 'Penghasilan Ayah', label: 'Penghasilan Ayah' },
  { key: 'No HP/WA Ayah', label: 'No HP/WA Ayah' },
  { key: 'Alamat Ayah', label: 'Alamat Ayah' },
  { key: 'Nama Ibu', label: 'Nama Ibu' },
  { key: 'NIK Ibu', label: 'NIK Ibu' },
  { key: 'Tahun Lahir Ibu', label: 'Tahun Lahir Ibu' },
  { key: 'Pendidikan Ibu', label: 'Pendidikan Ibu' },
  { key: 'Pekerjaan Ibu', label: 'Pekerjaan Ibu' },
  { key: 'Penghasilan Ibu', label: 'Penghasilan Ibu' },
  { key: 'No HP/WA Ibu', label: 'No HP/WA Ibu' },
  { key: 'Alamat Ibu', label: 'Alamat Ibu' },
  { key: 'Nama Wali', label: 'Nama Wali' },
  { key: 'NIK Wali', label: 'NIK Wali' },
  { key: 'Hubungan Wali', label: 'Hubungan Wali' },
  { key: 'Pendidikan Wali', label: 'Pendidikan Wali' },
  { key: 'Pekerjaan Wali', label: 'Pekerjaan Wali' },
  { key: 'Penghasilan Wali', label: 'Penghasilan Wali' },
  { key: 'No HP/WA Wali', label: 'No HP/WA Wali' },
  { key: 'Alamat Wali', label: 'Alamat Wali' },
  { key: 'Tahun Pelajaran', label: 'Tahun Pelajaran' },
  { key: 'Kelas', label: 'Kelas' },
];

const validStatuses = ['aktif', 'lulus', 'pindah', 'keluar'];
const validGenders = ['L', 'P', 'l', 'p'];
const validAgama = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];

export async function validateSiswaRows(
  rows: Record<string, string>[],
  kelasList: Kelas[],
  tpList: TahunPelajaran[],
): Promise<ImportRow[]> {
  const nisList = rows.map((r) => r['NIS']).filter(Boolean);
  const nisnList = rows.map((r) => r['NISN']).filter(Boolean);
  const nikList = rows.map((r) => r['NIK']).filter(Boolean);
  const rfidList = rows.map((r) => r['RFID']).filter(Boolean);

  const existing = await checkExistingSiswa(nisList, nisnList, nikList, rfidList);

  const kelasMap = new Map(kelasList.map((k) => [k.nama.toLowerCase(), k]));
  const tpMap = new Map(tpList.map((t) => [t.nama.toLowerCase(), t]));

  const seenNis = new Set<string>();
  const seenNisn = new Set<string>();
  const seenNik = new Set<string>();
  const seenRfid = new Set<string>();

  return rows.map((data, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];

    const nis = data['NIS']?.trim() ?? '';
    const nisn = data['NISN']?.trim() ?? '';
    const nik = data['NIK']?.trim() ?? '';
    const nama = data['Nama Lengkap']?.trim() ?? '';
    const gender = data['Jenis Kelamin']?.trim() ?? '';
    const tglLahir = data['Tanggal Lahir']?.trim() ?? '';
    const status = data['Status Siswa']?.trim().toLowerCase() ?? '';
    const rfid = data['RFID']?.trim() ?? '';
    const kelasName = data['Kelas']?.trim() ?? '';
    const tpName = data['Tahun Pelajaran']?.trim() ?? '';

    if (!nis) errors.push('NIS: wajib diisi');
    else if (existing.existingNis.has(nis)) errors.push('NIS: sudah terdaftar di database');
    else if (seenNis.has(nis)) errors.push('NIS: duplikat dalam file');
    else seenNis.add(nis);

    if (!nisn) errors.push('NISN: wajib diisi');
    else if (existing.existingNisn.has(nisn)) errors.push('NISN: sudah terdaftar di database');
    else if (seenNisn.has(nisn)) errors.push('NISN: duplikat dalam file');
    else seenNisn.add(nisn);

    if (nik) {
      if (existing.existingNik.has(nik)) errors.push('NIK: sudah terdaftar di database');
      else if (seenNik.has(nik)) errors.push('NIK: duplikat dalam file');
      else seenNik.add(nik);
    }

    if (!nama) errors.push('Nama Lengkap: wajib diisi');

    if (gender && !validGenders.includes(gender)) errors.push('Jenis Kelamin: harus L atau P');

    if (tglLahir && isNaN(Date.parse(tglLahir))) errors.push('Tanggal Lahir: format tidak valid (YYYY-MM-DD)');

    if (status && !validStatuses.includes(status)) errors.push('Status Siswa: harus aktif/lulus/pindah/keluar');

    if (rfid) {
      if (existing.existingRfid.has(rfid)) errors.push('RFID: sudah digunakan');
      else if (seenRfid.has(rfid)) errors.push('RFID: duplikat dalam file');
      else seenRfid.add(rfid);
    }

    if (kelasName) {
      const kelas = kelasMap.get(kelasName.toLowerCase());
      if (!kelas) errors.push('Kelas: tidak ditemukan di master Kelas');
    }

    if (tpName) {
      const tp = tpMap.get(tpName.toLowerCase());
      if (!tp) errors.push('Tahun Pelajaran: tidak ditemukan di master Tahun Pelajaran');
    }

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

export async function importSiswaRows(
  validRows: Record<string, string>[],
  mode: 'skip' | 'update',
  kelasList: Kelas[],
  tpList: TahunPelajaran[],
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const kelasMap = new Map(kelasList.map((k) => [k.nama.toLowerCase(), k]));
  const tpMap = new Map(tpList.map((t) => [t.nama.toLowerCase(), t]));

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
    const nis = row['NIS']?.trim() || null;
    const nisn = row['NISN']?.trim() || null;
    const nama = row['Nama Lengkap']?.trim();
    if (!nama) { failed++; errors.push(`Baris NIS ${nis}: Nama kosong`); continue; }

    const kelasName = row['Kelas']?.trim() ?? '';
    const tpName = row['Tahun Pelajaran']?.trim() ?? '';
    const kelas = kelasName ? kelasMap.get(kelasName.toLowerCase()) : null;
    const tp = tpName ? tpMap.get(tpName.toLowerCase()) : null;

    const gender = row['Jenis Kelamin']?.trim() || null;
    const status = (row['Status Siswa']?.trim().toLowerCase() || 'aktif') as 'aktif' | 'lulus' | 'pindah' | 'keluar';

    const payload = {
      nis,
      nisn,
      nik: row['NIK']?.trim() || null,
      nama_lengkap: nama,
      jenis_kelamin: (gender?.toUpperCase() as 'L' | 'P') || null,
      tempat_lahir: row['Tempat Lahir']?.trim() || null,
      tanggal_lahir: row['Tanggal Lahir']?.trim() || null,
      agama: row['Agama']?.trim() || null,
      alamat: row['Alamat']?.trim() || null,
      no_hp: row['No HP']?.trim() || null,
      email: row['Email']?.trim() || null,
      kelas_id: kelas?.id ?? null,
      jurusan_id: kelas?.jurusan_id ?? null,
      tahun_pelajaran_id: tp?.id ?? null,
      status,
      aktif: status === 'aktif',
      no_rfid: row['RFID']?.trim() || null,
      nama_ayah: row['Nama Ayah']?.trim() || null,
      nama_ibu: row['Nama Ibu']?.trim() || null,
      nama_wali: row['Nama Wali']?.trim() || null,
      pekerjaan_ayah: row['Pekerjaan Ayah']?.trim() || null,
      pekerjaan_ibu: row['Pekerjaan Ibu']?.trim() || null,
      pekerjaan_wali: row['Pekerjaan Wali']?.trim() || null,
      no_hp_ayah: row['No HP/WA Ayah']?.trim() || null,
      no_hp_ibu: row['No HP/WA Ibu']?.trim() || null,
      no_hp_wali: row['No HP/WA Wali']?.trim() || null,
      alamat_ortu: row['Alamat Ayah']?.trim() || row['Alamat Ibu']?.trim() || null,
      nik_ayah: row['NIK Ayah']?.trim() || null,
      nik_ibu: row['NIK Ibu']?.trim() || null,
      nik_wali: row['NIK Wali']?.trim() || null,
      tahun_lahir_ayah: row['Tahun Lahir Ayah']?.trim() || null,
      tahun_lahir_ibu: row['Tahun Lahir Ibu']?.trim() || null,
      pendidikan_ayah: row['Pendidikan Ayah']?.trim() || null,
      pendidikan_ibu: row['Pendidikan Ibu']?.trim() || null,
      pendidikan_wali: row['Pendidikan Wali']?.trim() || null,
      penghasilan_ayah: row['Penghasilan Ayah']?.trim() || null,
      penghasilan_ibu: row['Penghasilan Ibu']?.trim() || null,
      penghasilan_wali: row['Penghasilan Wali']?.trim() || null,
      hubungan_wali: row['Hubungan Wali']?.trim() || null,
      alamat_ayah: row['Alamat Ayah']?.trim() || null,
      alamat_ibu: row['Alamat Ibu']?.trim() || null,
      alamat_wali: row['Alamat Wali']?.trim() || null,
    };

    let siswaId: string | null = null;

    try {
      if (mode === 'update' && nisn) {
        const { data: existing } = await supabase.from('siswa').select('id').eq('nisn', nisn).maybeSingle();
        if (existing) {
          const { error: updateErr } = await supabase.from('siswa').update(payload).eq('id', existing.id);
          if (updateErr) { failed++; errors.push(`${nama}: ${updateErr.message}`); continue; }
          siswaId = existing.id;
        }
      }

      if (!siswaId) {
        const { data, error: insertErr } = await supabase.from('siswa').insert(payload).select('id').single();
        if (insertErr) { failed++; errors.push(`${nama}: ${insertErr.message}`); continue; }
        siswaId = data.id;
      }

      if (siswaId && payload.no_rfid) {
        await supabase.from('rfid_history').insert({
          person_type: 'siswa',
          person_id: siswaId,
          no_rfid: payload.no_rfid,
          status: 'aktif',
        });
      }

      if (siswaId && kelas && tp) {
        const semester = tp.semester;
        await supabase.from('siswa_kelas_riwayat').insert({
          siswa_id: siswaId,
          tahun_pelajaran_id: tp.id,
          semester,
          kelas_id: kelas.id,
          jurusan_id: kelas.jurusan_id ?? null,
          status: 'aktif',
        });
      }

      if (siswaId && nisn) {
        accountsToCreate.push({
          email: `${nisn}@nurinsani.sch.id`,
          password: nisn,
          full_name: nama,
          roles: ['siswa'],
          link_to: { table: 'siswa' as const, id: siswaId },
        });

        const parentPhone = row['No HP/WA Wali']?.trim() || row['No HP/WA Ibu']?.trim() || row['No HP/WA Ayah']?.trim();
        if (parentPhone) {
          accountsToCreate.push({
            email: `${nisn}@gmail.com`,
            password: nisn,
            full_name: `Orang Tua/Wali ${nama}`,
            roles: ['orang_tua_wali'],
            link_to: { table: 'siswa' as const, id: siswaId },
          });
        }
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

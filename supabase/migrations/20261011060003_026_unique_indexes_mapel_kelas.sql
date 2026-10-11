-- Partial unique index: kode + tingkat + jurusan_id
-- Allows same kode for different tingkat/jurusan, prevents exact duplicates.
-- Uses COALESCE to handle NULLs in the unique check.
CREATE UNIQUE INDEX IF NOT EXISTS mata_pelajaran_kode_tingkat_jurusan_unique
  ON mata_pelajaran (kode, COALESCE(tingkat, -1), COALESCE(jurusan_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Index for kelas nama + tahun_pelajaran uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS kelas_nama_tp_unique
  ON kelas (nama, tahun_pelajaran_id)
  WHERE tahun_pelajaran_id IS NOT NULL;

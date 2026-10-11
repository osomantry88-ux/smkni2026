-- ============================================================
-- 009: Add semester to tahun_pelajaran + siswa_kelas_riwayat table
-- ============================================================

-- 1. Add semester column to tahun_pelajaran
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tahun_pelajaran' AND column_name = 'semester') THEN
    ALTER TABLE public.tahun_pelajaran ADD COLUMN semester text NOT NULL DEFAULT 'ganjil' CHECK (semester IN ('ganjil', 'genap'));
  END IF;
END $$;

-- Make (nama, semester) unique instead of just nama
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tahun_pelajaran_nama_semester_key') THEN
    ALTER TABLE public.tahun_pelajaran DROP CONSTRAINT IF EXISTS tahun_pelajaran_nama_key;
    ALTER TABLE public.tahun_pelajaran ADD CONSTRAINT tahun_pelajaran_nama_semester_key UNIQUE (nama, semester);
  END IF;
END $$;

-- Partial unique index: only one active row at a time
DROP INDEX IF EXISTS idx_tahun_pelajaran_single_active;
CREATE UNIQUE INDEX idx_tahun_pelajaran_single_active
  ON public.tahun_pelajaran (aktif)
  WHERE aktif = true;

-- 2. Create siswa_kelas_riwayat table
CREATE TABLE IF NOT EXISTS public.siswa_kelas_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id uuid NOT NULL REFERENCES public.siswa(id) ON DELETE CASCADE,
  tahun_pelajaran_id uuid NOT NULL REFERENCES public.tahun_pelajaran(id) ON DELETE RESTRICT,
  semester text NOT NULL CHECK (semester IN ('ganjil', 'genap')),
  kelas_id uuid REFERENCES public.kelas(id) ON DELETE SET NULL,
  jurusan_id uuid REFERENCES public.jurusan(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'naik_kelas', 'tinggal_kelas', 'pindah_kelas', 'pindah_jurusan', 'lulus', 'mutasi')),
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.siswa_kelas_riwayat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skr_select_authenticated" ON public.siswa_kelas_riwayat;
CREATE POLICY "skr_select_authenticated"
  ON public.siswa_kelas_riwayat FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "skr_insert_authenticated" ON public.siswa_kelas_riwayat;
CREATE POLICY "skr_insert_authenticated"
  ON public.siswa_kelas_riwayat FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "skr_update_authenticated" ON public.siswa_kelas_riwayat;
CREATE POLICY "skr_update_authenticated"
  ON public.siswa_kelas_riwayat FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "skr_delete_authenticated" ON public.siswa_kelas_riwayat;
CREATE POLICY "skr_delete_authenticated"
  ON public.siswa_kelas_riwayat FOR DELETE TO authenticated USING (true);

-- Prevent duplicate riwayat for same siswa + tahun pelajaran + semester
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'siswa_kelas_riwayat_siswa_tp_semester_key') THEN
    ALTER TABLE public.siswa_kelas_riwayat ADD CONSTRAINT siswa_kelas_riwayat_siswa_tp_semester_key UNIQUE (siswa_id, tahun_pelajaran_id, semester);
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS siswa_kelas_riwayat_set_updated_at ON public.siswa_kelas_riwayat;
CREATE TRIGGER siswa_kelas_riwayat_set_updated_at
  BEFORE UPDATE ON public.siswa_kelas_riwayat
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skr_siswa ON public.siswa_kelas_riwayat(siswa_id);
CREATE INDEX IF NOT EXISTS idx_skr_tahun_pelajaran ON public.siswa_kelas_riwayat(tahun_pelajaran_id);
CREATE INDEX IF NOT EXISTS idx_skr_kelas ON public.siswa_kelas_riwayat(kelas_id);
CREATE INDEX IF NOT EXISTS idx_skr_status ON public.siswa_kelas_riwayat(status);
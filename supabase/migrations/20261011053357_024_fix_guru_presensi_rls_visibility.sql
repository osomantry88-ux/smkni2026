-- Fix: guru role should only see their OWN presensi, not all guru presensi.
-- kepala_sekolah and admin/super_admin keep full visibility.
-- wali_kelas/guru_bk/guru_piket/pembina don't need access to guru presensi records.

DROP POLICY IF EXISTS select_presensi_gt ON presensi_guru_tendik;

CREATE POLICY select_presensi_gt ON presensi_guru_tendik
  FOR SELECT TO authenticated
  USING (
    -- Admin & super_admin: full access
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY['super_admin', 'admin'])
    )
    -- Kepala sekolah: full visibility for oversight
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'kepala_sekolah'
    )
    -- Guru/Tendik: only their own presensi (linked via user_id)
    OR EXISTS (
      SELECT 1 FROM guru_tendik
      WHERE guru_tendik.id = presensi_guru_tendik.guru_tendik_id
        AND guru_tendik.user_id = auth.uid()
    )
  );

-- Fix: wali_kelas on presensi_siswa should only see presensi for siswa in THEIR class,
-- not all siswa presensi. Restructure the SELECT policy.

DROP POLICY IF EXISTS select_presensi ON presensi_siswa;

CREATE POLICY select_presensi ON presensi_siswa
  FOR SELECT TO authenticated
  USING (
    -- Admin & super_admin: full access
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY['super_admin', 'admin'])
    )
    -- Kepala sekolah: full visibility
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'kepala_sekolah'
    )
    -- Guru BK, guru piket, pembina: can see all siswa presensi (monitoring role)
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY['guru_bk', 'guru_piket', 'pembina'])
    )
    -- Wali kelas: only presensi for siswa in their class
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'wali_kelas'
      AND EXISTS (
        SELECT 1 FROM kelas k
        JOIN guru_tendik gt ON gt.id = k.wali_kelas_id
        WHERE k.id = presensi_siswa.kelas_id
          AND gt.user_id = auth.uid()
      )
    )
    -- Siswa: only own presensi
    OR EXISTS (
      SELECT 1 FROM siswa
      WHERE siswa.id = presensi_siswa.siswa_id
        AND siswa.user_id = auth.uid()
    )
    -- Orang tua/wali: only own child's presensi
    OR (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'orang_tua_wali'
      )
      AND EXISTS (
        SELECT 1 FROM siswa
        WHERE siswa.id = presensi_siswa.siswa_id
          AND siswa.user_id = auth.uid()
      )
    )
  );

/*
# Fix infinite recursion in profiles RLS policies

The previous policies on `profiles` used a subquery back into `profiles`
to check if the caller is an admin, causing infinite recursion.

Fix: introduce a SECURITY DEFINER helper function `is_admin()` that
reads from `profiles` bypassing RLS, then rewrite all policies that
checked admin status to use this function instead.

Also fixes the same recursion pattern in `applications`, `licenses`,
`hwid_bindings`, and `activity_logs`.
*/

-- ============================================================
-- Helper: is_admin() — reads profiles with NO RLS (security definer)
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- PROFILES — drop and recreate without self-referencing subquery
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
TO authenticated USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR is_admin())
WITH CHECK (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
TO authenticated USING (is_admin());

-- ============================================================
-- APPLICATIONS — replace self-referencing admin checks
-- ============================================================
DROP POLICY IF EXISTS "apps_select_own" ON applications;
CREATE POLICY "apps_select_own" ON applications FOR SELECT
TO authenticated USING (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "apps_insert_own" ON applications;
CREATE POLICY "apps_insert_own" ON applications FOR INSERT
TO authenticated WITH CHECK (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "apps_update_own" ON applications;
CREATE POLICY "apps_update_own" ON applications FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR is_admin())
WITH CHECK (owner_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "apps_delete_own" ON applications;
CREATE POLICY "apps_delete_own" ON applications FOR DELETE
TO authenticated USING (owner_id = auth.uid() OR is_admin());

-- ============================================================
-- LICENSES
-- ============================================================
DROP POLICY IF EXISTS "licenses_select_own" ON licenses;
CREATE POLICY "licenses_select_own" ON licenses FOR SELECT
TO authenticated USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "licenses_insert_own" ON licenses;
CREATE POLICY "licenses_insert_own" ON licenses FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "licenses_update_own" ON licenses;
CREATE POLICY "licenses_update_own" ON licenses FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "licenses_delete_own" ON licenses;
CREATE POLICY "licenses_delete_own" ON licenses FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

-- ============================================================
-- HWID BINDINGS
-- ============================================================
DROP POLICY IF EXISTS "hwid_select" ON hwid_bindings;
CREATE POLICY "hwid_select" ON hwid_bindings FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR is_admin()
    )
  )
);

DROP POLICY IF EXISTS "hwid_insert" ON hwid_bindings;
CREATE POLICY "hwid_insert" ON hwid_bindings FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR is_admin()
    )
  )
);

DROP POLICY IF EXISTS "hwid_update" ON hwid_bindings;
CREATE POLICY "hwid_update" ON hwid_bindings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR is_admin()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR is_admin()
    )
  )
);

DROP POLICY IF EXISTS "hwid_delete" ON hwid_bindings;
CREATE POLICY "hwid_delete" ON hwid_bindings FOR DELETE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR is_admin()
    )
  )
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
DROP POLICY IF EXISTS "logs_select" ON activity_logs;
CREATE POLICY "logs_select" ON activity_logs FOR SELECT
TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "logs_delete" ON activity_logs;
CREATE POLICY "logs_delete" ON activity_logs FOR DELETE
TO authenticated USING (is_admin());

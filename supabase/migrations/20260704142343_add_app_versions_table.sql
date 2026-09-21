/*
# Add app_versions table for online update system

1. New Tables
- `app_versions`
  - `id` (uuid, primary key)
  - `app_id` (uuid, FK applications)
  - `version` (text) — e.g. "V1.9"
  - `download_url` (text) — URL to the new DLL/binary
  - `changelog` (text) — release notes
  - `is_latest` (boolean) — only one per app can be latest
  - `force_update` (boolean) — force clients to update
  - `created_at` (timestamp)

2. Security
- RLS enabled, owner + admin can manage versions
- Public SELECT so the update endpoint can be called without auth
*/

CREATE TABLE IF NOT EXISTS app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  version text NOT NULL,
  download_url text NOT NULL,
  changelog text,
  is_latest boolean NOT NULL DEFAULT false,
  force_update boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_versions_app_id_idx ON app_versions(app_id);

ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated C++ clients) can read versions
DROP POLICY IF EXISTS "versions_select_public" ON app_versions;
CREATE POLICY "versions_select_public" ON app_versions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "versions_insert_own" ON app_versions;
CREATE POLICY "versions_insert_own" ON app_versions FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "versions_update_own" ON app_versions;
CREATE POLICY "versions_update_own" ON app_versions FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "versions_delete_own" ON app_versions;
CREATE POLICY "versions_delete_own" ON app_versions FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR is_admin()
);

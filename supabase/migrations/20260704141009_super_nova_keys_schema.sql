/*
# SUPER NOVA KEYS — Full Schema

## Summary
Creates the complete license management system schema for SUPER NOVA KEYS.

## New Tables

### 1. profiles
- id (uuid, PK, references auth.users)
- email (text)
- username (text)
- role (text: 'user' | 'admin')
- is_banned (boolean)
- ban_reason (text)
- created_at (timestamp)

### 2. applications
- id (uuid, PK)
- owner_id (uuid, FK profiles)
- name (text)
- description (text)
- version (text)
- is_active (boolean)
- created_at (timestamp)

### 3. licenses
- id (uuid, PK)
- app_id (uuid, FK applications)
- owner_id (uuid, FK profiles)
- license_key (text, unique) — format XXXX-XXXX-XXXX-XXXX
- status (text: 'active'|'suspended'|'expired'|'banned')
- license_type (text: 'daily'|'monthly'|'lifetime')
- expires_at (timestamp, nullable for lifetime)
- note (text)
- created_at (timestamp)

### 4. hwid_bindings
- id (uuid, PK)
- license_id (uuid, FK licenses)
- hwid (text)
- last_reset_at (timestamp)
- reset_count (integer)
- created_at (timestamp)

### 5. activity_logs
- id (uuid, PK)
- license_id (uuid, nullable FK licenses)
- user_id (uuid, nullable FK profiles)
- app_id (uuid, nullable FK applications)
- event_type (text)
- ip_address (text)
- hwid (text)
- metadata (jsonb)
- created_at (timestamp)

### 6. rate_limit_log
- id (uuid, PK)
- identifier (text) — IP or license key
- endpoint (text)
- request_count (integer)
- window_start (timestamp)

## Security
- RLS enabled on all tables
- Admin role can read/write everything
- Users can only access their own data
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  username text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned boolean NOT NULL DEFAULT false,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
TO authenticated USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
));

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
TO authenticated USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
)) WITH CHECK (auth.uid() = id OR EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
));

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
TO authenticated USING (EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
));

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  version text NOT NULL DEFAULT '1.0.0',
  api_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_select_own" ON applications;
CREATE POLICY "apps_select_own" ON applications FOR SELECT
TO authenticated USING (owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "apps_insert_own" ON applications;
CREATE POLICY "apps_insert_own" ON applications FOR INSERT
TO authenticated WITH CHECK (owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "apps_update_own" ON applications;
CREATE POLICY "apps_update_own" ON applications FOR UPDATE
TO authenticated USING (owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
)) WITH CHECK (owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

DROP POLICY IF EXISTS "apps_delete_own" ON applications;
CREATE POLICY "apps_delete_own" ON applications FOR DELETE
TO authenticated USING (owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

-- ============================================================
-- LICENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  license_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'banned')),
  license_type text NOT NULL DEFAULT 'monthly' CHECK (license_type IN ('daily', 'monthly', 'lifetime')),
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licenses_key_idx ON licenses(license_key);
CREATE INDEX IF NOT EXISTS licenses_app_id_idx ON licenses(app_id);
CREATE INDEX IF NOT EXISTS licenses_owner_id_idx ON licenses(owner_id);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licenses_select_own" ON licenses;
CREATE POLICY "licenses_select_own" ON licenses FOR SELECT
TO authenticated USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "licenses_insert_own" ON licenses;
CREATE POLICY "licenses_insert_own" ON licenses FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "licenses_update_own" ON licenses;
CREATE POLICY "licenses_update_own" ON licenses FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "licenses_delete_own" ON licenses;
CREATE POLICY "licenses_delete_own" ON licenses FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ============================================================
-- HWID BINDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS hwid_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  hwid text NOT NULL,
  last_reset_at timestamptz,
  reset_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(license_id)
);

ALTER TABLE hwid_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hwid_select" ON hwid_bindings;
CREATE POLICY "hwid_select" ON hwid_bindings FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);

DROP POLICY IF EXISTS "hwid_update" ON hwid_bindings;
CREATE POLICY "hwid_update" ON hwid_bindings FOR UPDATE
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM licenses l
    WHERE l.id = license_id AND (
      l.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM applications a WHERE a.id = l.app_id AND a.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid REFERENCES licenses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  app_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address text,
  hwid text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_app_id_idx ON activity_logs(app_id);
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS activity_logs_license_id_idx ON activity_logs(license_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select" ON activity_logs;
CREATE POLICY "logs_select" ON activity_logs FOR SELECT
TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM applications a WHERE a.id = app_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "logs_insert" ON activity_logs;
CREATE POLICY "logs_insert" ON activity_logs FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "logs_update" ON activity_logs;
CREATE POLICY "logs_update" ON activity_logs FOR UPDATE
TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "logs_delete" ON activity_logs;
CREATE POLICY "logs_delete" ON activity_logs FOR DELETE
TO authenticated USING (EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
));

-- Allow anon to insert logs (for license validation calls)
DROP POLICY IF EXISTS "logs_insert_anon" ON activity_logs;
CREATE POLICY "logs_insert_anon" ON activity_logs FOR INSERT
TO anon WITH CHECK (true);

-- ============================================================
-- RATE LIMIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  endpoint text NOT NULL DEFAULT 'validate',
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_identifier_idx ON rate_limit_log(identifier, endpoint);

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ratelimit_select" ON rate_limit_log;
CREATE POLICY "ratelimit_select" ON rate_limit_log FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ratelimit_insert" ON rate_limit_log;
CREATE POLICY "ratelimit_insert" ON rate_limit_log FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ratelimit_update" ON rate_limit_log;
CREATE POLICY "ratelimit_update" ON rate_limit_log FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ratelimit_delete" ON rate_limit_log;
CREATE POLICY "ratelimit_delete" ON rate_limit_log FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCTION: generate license key
-- ============================================================
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  key text := '';
  i int;
  segment text;
BEGIN
  FOR seg IN 1..4 LOOP
    segment := '';
    FOR i IN 1..4 LOOP
      segment := segment || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF seg = 1 THEN key := segment;
    ELSE key := key || '-' || segment;
    END IF;
  END LOOP;
  RETURN key;
END;
$$;

-- ============================================================================
-- Security Hardening Migration
-- Compliant with architettura_sicurezza_web.txt
-- ============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enhance PROFILES table with security columns
DO $$
BEGIN
  -- token_version: instant session revocation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'token_version') THEN
    ALTER TABLE profiles ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- failed_login_attempts: brute force and credential stuffing defense
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'failed_login_attempts') THEN
    ALTER TABLE profiles ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- locked_until: temporary account lockout
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'locked_until') THEN
    ALTER TABLE profiles ADD COLUMN locked_until TIMESTAMPTZ;
  END IF;

  -- last_login telemetry
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_at') THEN
    ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_ip') THEN
    ALTER TABLE profiles ADD COLUMN last_login_ip TEXT;
  END IF;
END $$;

-- 3. Dedicated Immutable Security Audit Events Table (Section 14.2)
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
  ip_address TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create performant indexes for threat detection and audit
CREATE INDEX IF NOT EXISTS idx_sec_audit_event_type ON security_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sec_audit_created_at ON security_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_audit_ip ON security_audit_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_sec_audit_user_id ON security_audit_events(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_ip ON activity_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_banned_ips_created_at ON banned_ips(created_at DESC);

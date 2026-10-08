CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '平台管理员',
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  store_name text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_verification',
  admin_status text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verification_failed_attempts integer NOT NULL DEFAULT 0,
  verification_locked_until timestamptz,
  verification_sent_at timestamptz,
  password_reset_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  code text NOT NULL,
  offer text NOT NULL,
  deal_type text NOT NULL CHECK (deal_type IN ('percentage', 'fixed_amount')),
  discount_value numeric(10, 2) NOT NULL,
  terms text NOT NULL DEFAULT '',
  end_at date,
  status text NOT NULL DEFAULT 'published',
  admin_status text NOT NULL DEFAULT 'normal',
  admin_removal_reason text NOT NULL DEFAULT '',
  copy_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_code_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  placement_type text NOT NULL CHECK (placement_type IN ('editorial', 'sponsored')),
  priority integer NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 1000),
  sponsor_name text NOT NULL DEFAULT '',
  starts_at date NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date),
  ends_at date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL DEFAULT 'admin' CHECK (source_type IN ('admin', 'user_points')),
  points_spent integer NOT NULL DEFAULT 0 CHECK (points_spent >= 0),
  duration_days integer,
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS user_point_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_code_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  points_per_code integer NOT NULL CHECK (points_per_code > 0),
  expires_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES point_code_batches(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  code_mask text NOT NULL,
  points integer NOT NULL CHECK (points > 0),
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'redeemed', 'revoked')),
  expires_at timestamptz,
  redeemed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('redemption', 'placement_purchase', 'adjustment')),
  delta integer NOT NULL CHECK (delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  redemption_code_id uuid REFERENCES point_redemption_codes(id) ON DELETE SET NULL,
  placement_id uuid REFERENCES promo_code_placements(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creation_quota_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id text,
  name text NOT NULL,
  quota integer NOT NULL CHECK (quota > 0 AND quota <= 1000),
  points integer NOT NULL CHECK (points > 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE creation_quota_packages ADD COLUMN IF NOT EXISTS config_id text;
CREATE UNIQUE INDEX IF NOT EXISTS creation_quota_packages_config_id_idx
  ON creation_quota_packages (config_id)
  WHERE config_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_creation_quota_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  free_quota integer NOT NULL DEFAULT 1 CHECK (free_quota >= 0),
  purchased_quota integer NOT NULL DEFAULT 0 CHECK (purchased_quota >= 0),
  adjustment_quota integer NOT NULL DEFAULT 0,
  consumed_quota integer NOT NULL DEFAULT 0 CHECK (consumed_quota >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (free_quota + purchased_quota + adjustment_quota - consumed_quota >= 0)
);

CREATE TABLE IF NOT EXISTS creation_quota_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('free_grant', 'purchase', 'consume', 'adjustment')),
  delta integer NOT NULL CHECK (delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  package_id uuid REFERENCES creation_quota_packages(id) ON DELETE SET NULL,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO user_creation_quota_accounts (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO creation_quota_ledger (user_id, entry_type, delta, balance_after, description)
SELECT a.user_id, 'free_grant', 1, 1, convert_from(decode('E696B0E794A8E688B7E5858DE8B4B9E5889BE5BBBAE9A29DE5BAA6', 'hex'), 'UTF8')
FROM user_creation_quota_accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM creation_quota_ledger l
  WHERE l.user_id = a.user_id AND l.entry_type = 'free_grant'
);
CREATE INDEX IF NOT EXISTS creation_quota_ledger_user_time_idx ON creation_quota_ledger (user_id, created_at DESC);
INSERT INTO creation_quota_packages (name, quota, points, enabled)
SELECT '入门包', 1, 10, true
WHERE NOT EXISTS (SELECT 1 FROM creation_quota_packages);
INSERT INTO creation_quota_packages (name, quota, points, enabled)
SELECT '标准包', 5, 40, true
WHERE (SELECT COUNT(*) FROM creation_quota_packages) = 1;
INSERT INTO creation_quota_packages (name, quota, points, enabled)
SELECT '批量包', 10, 70, true
WHERE (SELECT COUNT(*) FROM creation_quota_packages) = 2;
CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_redemption_idx ON point_ledger (redemption_code_id) WHERE redemption_code_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS point_ledger_user_time_idx ON point_ledger (user_id, created_at DESC);
ALTER TABLE promo_code_placements ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'admin';
ALTER TABLE promo_code_placements ADD COLUMN IF NOT EXISTS points_spent integer NOT NULL DEFAULT 0;
ALTER TABLE promo_code_placements ADD COLUMN IF NOT EXISTS duration_days integer;

CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, promo_code_id)
);

CREATE TABLE IF NOT EXISTS deal_events (
  id bigserial PRIMARY KEY,
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'copy', 'favorite', 'unfavorite', 'report')),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ip_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  handled_at timestamptz,
  handled_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, promo_code_id)
);

CREATE TABLE IF NOT EXISTS website_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type text NOT NULL CHECK (match_type IN ('domain', 'keyword')),
  hostname text NOT NULL DEFAULT '',
  keyword text NOT NULL DEFAULT '',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  principal_type text NOT NULL CHECK (principal_type IN ('admin', 'merchant', 'user')),
  principal_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS verification_tokens (
  token_hash text PRIMARY KEY,
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  verification_code text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_created_at_idx ON promo_codes (created_at DESC);
CREATE INDEX IF NOT EXISTS promo_codes_status_idx ON promo_codes (status, admin_status);
DROP INDEX IF EXISTS promo_codes_merchant_code_lower_idx;
CREATE INDEX IF NOT EXISTS promo_codes_merchant_code_lower_idx
  ON promo_codes (merchant_id, lower(code));
CREATE INDEX IF NOT EXISTS promo_code_placements_active_idx
  ON promo_code_placements (status, starts_at, ends_at, priority DESC);
CREATE INDEX IF NOT EXISTS promo_code_placements_deal_idx
  ON promo_code_placements (promo_code_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_events_deal_time_idx
  ON deal_events (promo_code_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_events_time_idx
  ON deal_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS website_filters_status_idx ON website_filters (status);

-- On databases created before email verification existed, the newly added
-- column is NULL for legacy accounts. Preserve their previous access once,
-- while keeping new accounts unverified by default.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at timestamptz;
UPDATE users
   SET email_verified = true,
       verified_at = COALESCE(verified_at, created_at, now())
 WHERE email_verified IS NULL;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_locked_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_sent_at timestamptz;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE verification_tokens ALTER COLUMN merchant_id DROP NOT NULL;
ALTER TABLE verification_tokens ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE verification_tokens ADD COLUMN IF NOT EXISTS verification_code text;
ALTER TABLE promo_code_placements
  ALTER COLUMN starts_at SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date);
CREATE UNIQUE INDEX IF NOT EXISTS merchants_user_id_idx
  ON merchants (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS verification_tokens_user_id_idx ON verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

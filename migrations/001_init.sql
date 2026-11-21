CREATE TABLE IF NOT EXISTS user_roles (
  stage TEXT NOT NULL,
  cursor_sub TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'employee')),
  employee_id TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stage, cursor_sub)
);

CREATE INDEX IF NOT EXISTS user_roles_stage_role_idx ON user_roles (stage, role);

CREATE TABLE IF NOT EXISTS app_state (
  stage TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

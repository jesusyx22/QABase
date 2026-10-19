-- Núcleo de identidad: roles, permisos, cuentas, sesiones y auditoría.

CREATE TABLE roles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  seed_key TEXT UNIQUE,
  is_protected INTEGER NOT NULL DEFAULT 0 CHECK (is_protected IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX roles_single_protected
  ON roles (is_protected)
  WHERE is_protected = 1;

CREATE TABLE permissions (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  permission_key TEXT NOT NULL REFERENCES permissions (key) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX role_permissions_permission_idx
  ON role_permissions (permission_key);

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (username_normalized = lower(username))
);

CREATE INDEX accounts_role_idx ON accounts (role_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id INTEGER NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_account_idx ON sessions (account_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  actor_account_id INTEGER NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  actor_username TEXT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('app', 'local')),
  module TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT NULL,
  after_json TEXT NULL
);

CREATE INDEX audit_events_entity_idx
  ON audit_events (entity_type, entity_id, occurred_at);

CREATE INDEX audit_events_occurred_idx
  ON audit_events (occurred_at);

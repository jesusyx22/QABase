DROP TABLE IF EXISTS proxies;

CREATE TABLE proxy_services (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'qa', 'production', 'unspecified')),
  entry TEXT NOT NULL,
  health_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE proxy_ports (
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES proxy_services(id) ON DELETE CASCADE,
  port INTEGER NOT NULL UNIQUE CHECK (port BETWEEN 1 AND 65535),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1))
);

CREATE UNIQUE INDEX proxy_ports_one_primary_idx
  ON proxy_ports (service_id)
  WHERE is_primary = 1;
CREATE INDEX proxy_ports_service_idx ON proxy_ports (service_id);

CREATE TABLE proxy_routes (
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES proxy_services(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  target TEXT NOT NULL,
  access_id INTEGER REFERENCES accesses(id),
  detail TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (service_id, path)
);

CREATE INDEX proxy_routes_service_idx ON proxy_routes (service_id);

CREATE TABLE proxy_runtime (
  service_id INTEGER PRIMARY KEY REFERENCES proxy_services(id) ON DELETE CASCADE,
  pid INTEGER,
  started_at TEXT,
  started_by_qabase INTEGER NOT NULL DEFAULT 0 CHECK (started_by_qabase IN (0, 1)),
  last_exit_code INTEGER,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('proxies.operar', 'Iniciar, detener y reiniciar servicios de proxy.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT id, 'proxies.operar' FROM roles WHERE seed_key = 'editor';

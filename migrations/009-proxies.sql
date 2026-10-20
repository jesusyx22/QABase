CREATE TABLE proxy_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE proxies (
  id INTEGER PRIMARY KEY,
  access_id INTEGER NOT NULL UNIQUE REFERENCES accesses(id),
  port INTEGER NOT NULL UNIQUE CHECK (port BETWEEN 1 AND 65535),
  detail TEXT NOT NULL CHECK (length(detail) BETWEEN 1 AND 200),
  detail_normalized TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX proxies_active_idx ON proxies (is_active);
CREATE INDEX proxies_port_idx ON proxies (port);
INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('proxies.ver', 'Consultar el catálogo de proxies publicados.'),
  ('proxies.gestionar', 'Configurar el puente y gestionar proxies publicados.');
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT id, 'proxies.ver' FROM roles WHERE seed_key IN ('editor', 'consulta');

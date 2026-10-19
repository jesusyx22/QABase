-- Catálogo de accesos de firewall. Independiente de las asignaciones QA.

CREATE TABLE accesses (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL CHECK (length(address) BETWEEN 1 AND 255),
  address_normalized TEXT NOT NULL CHECK (length(address_normalized) BETWEEN 1 AND 255),
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  environment TEXT NOT NULL
    CHECK (environment IN ('development', 'qa', 'production')),
  protocol TEXT NULL
    CHECK (protocol IS NULL OR protocol IN ('tcp', 'udp', 'both')),
  detail TEXT NULL
    CHECK (detail IS NULL OR length(detail) BETWEEN 1 AND 200),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX accesses_unique_key
  ON accesses (address_normalized, port, environment);

CREATE INDEX accesses_environment_idx ON accesses (environment);
CREATE INDEX accesses_active_idx ON accesses (is_active);
CREATE INDEX accesses_protocol_idx ON accesses (protocol);

-- Catálogo de permisos del módulo. En bases existentes, conceder solo
-- lectura a Editor y Consulta; Administrador los recibe de forma implícita.
INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('accesos.ver', 'Consultar el catálogo de accesos de firewall.'),
  ('accesos.gestionar', 'Crear, editar, activar, desactivar y consultar el historial de accesos.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT id, 'accesos.ver'
  FROM roles
 WHERE seed_key IN ('editor', 'consulta');

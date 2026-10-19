-- Extiende el catálogo de accesos para el inventario real de firewall:
-- ambiente sin clasificar, rango de puertos, aplicaciones y URLs.
-- Reconstruye las tablas para preservar claves foráneas e IDs existentes.

CREATE TABLE accesses_new (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL CHECK (length(address) BETWEEN 1 AND 255),
  address_normalized TEXT NOT NULL CHECK (length(address_normalized) BETWEEN 1 AND 255),
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  port_end INTEGER NOT NULL CHECK (port_end BETWEEN 1 AND 65535),
  environment TEXT NOT NULL
    CHECK (environment IN ('development', 'qa', 'production', 'unspecified')),
  protocol TEXT NULL
    CHECK (protocol IS NULL OR protocol IN ('tcp', 'udp', 'both')),
  detail TEXT NULL
    CHECK (detail IS NULL OR length(detail) BETWEEN 1 AND 200),
  applications TEXT NULL
    CHECK (applications IS NULL OR length(applications) BETWEEN 1 AND 500),
  urls TEXT NULL
    CHECK (urls IS NULL OR length(urls) BETWEEN 1 AND 4000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (port_end >= port)
);

INSERT INTO accesses_new (
  id, address, address_normalized, port, port_end, environment, protocol,
  detail, applications, urls, is_active, version, created_at, updated_at
)
SELECT
  id, address, address_normalized, port, port, environment, protocol,
  detail, NULL, NULL, is_active, version, created_at, updated_at
FROM accesses;

CREATE TABLE access_assignments_new (
  id INTEGER PRIMARY KEY,
  access_id INTEGER NOT NULL REFERENCES accesses_new(id),
  person_id INTEGER NOT NULL REFERENCES personal_qa(id),
  expires_on TEXT NOT NULL
    CHECK (expires_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (access_id, person_id)
);

INSERT INTO access_assignments_new (
  id, access_id, person_id, expires_on, version, created_at, updated_at
)
SELECT id, access_id, person_id, expires_on, version, created_at, updated_at
FROM access_assignments;

DROP TABLE access_assignments;
DROP TABLE accesses;

ALTER TABLE accesses_new RENAME TO accesses;
ALTER TABLE access_assignments_new RENAME TO access_assignments;

CREATE UNIQUE INDEX accesses_unique_key
  ON accesses (address_normalized, port, port_end, environment);

CREATE INDEX accesses_environment_idx ON accesses (environment);
CREATE INDEX accesses_active_idx ON accesses (is_active);
CREATE INDEX accesses_protocol_idx ON accesses (protocol);

CREATE INDEX access_assignments_person_idx
  ON access_assignments (person_id, expires_on);
CREATE INDEX access_assignments_access_idx
  ON access_assignments (access_id);
CREATE INDEX access_assignments_expiry_idx
  ON access_assignments (expires_on);

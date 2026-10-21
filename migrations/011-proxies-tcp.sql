ALTER TABLE proxy_services
  ADD COLUMN protocol TEXT NOT NULL DEFAULT 'http'
  CHECK (protocol IN ('http', 'tcp'));

CREATE TABLE proxy_allowlist (
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES proxy_services(id) ON DELETE CASCADE,
  cidr TEXT NOT NULL,
  UNIQUE (service_id, cidr)
);

CREATE INDEX proxy_allowlist_service_idx ON proxy_allowlist (service_id);

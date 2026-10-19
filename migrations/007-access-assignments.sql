-- Asignaciones de accesos de firewall a Personal QA.
-- Una fila por QA + acceso; el vencimiento es una fecha sin hora.

CREATE TABLE access_assignments (
  id INTEGER PRIMARY KEY,
  access_id INTEGER NOT NULL REFERENCES accesses(id),
  person_id INTEGER NOT NULL REFERENCES personal_qa(id),
  expires_on TEXT NOT NULL
    CHECK (expires_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (access_id, person_id)
);

CREATE INDEX access_assignments_person_idx
  ON access_assignments (person_id, expires_on);

CREATE INDEX access_assignments_access_idx
  ON access_assignments (access_id);

CREATE INDEX access_assignments_expiry_idx
  ON access_assignments (expires_on);

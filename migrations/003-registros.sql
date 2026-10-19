-- Escala fija de impacto y registros de méritos e incidencias.

CREATE TABLE impact_levels (
  type TEXT NOT NULL CHECK (type IN ('merito', 'incidencia')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (type, level)
);

CREATE TABLE records (
  id INTEGER PRIMARY KEY,
  qa_id INTEGER NOT NULL REFERENCES personal_qa (id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('merito', 'incidencia')),
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  detail TEXT NOT NULL CHECK (length(detail) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'vigente'
    CHECK (status IN ('vigente', 'anulado')),
  annulled_at TEXT NULL,
  annulled_by INTEGER NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  annul_reason TEXT NULL
    CHECK (annul_reason IS NULL OR length(annul_reason) BETWEEN 1 AND 1000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (type, level)
    REFERENCES impact_levels (type, level) ON DELETE RESTRICT,
  CHECK (
    (status = 'vigente'
      AND annulled_at IS NULL
      AND annulled_by IS NULL
      AND annul_reason IS NULL)
    OR
    (status = 'anulado'
      AND annulled_at IS NOT NULL
      AND annulled_by IS NOT NULL
      AND annul_reason IS NOT NULL)
  )
);

CREATE INDEX records_qa_date_idx ON records (qa_id, event_date);
CREATE INDEX records_status_idx ON records (status);
CREATE INDEX records_type_idx ON records (type);
CREATE INDEX records_level_idx ON records (level);
CREATE INDEX records_event_date_idx ON records (event_date);

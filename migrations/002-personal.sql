-- Catálogo de Personal QA, independiente de las cuentas de acceso.

CREATE TABLE personal_qa (
  id INTEGER PRIMARY KEY,
  source_id INTEGER UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX personal_qa_active_name_idx
  ON personal_qa (is_active, name);

CREATE INDEX personal_qa_name_idx
  ON personal_qa (name);

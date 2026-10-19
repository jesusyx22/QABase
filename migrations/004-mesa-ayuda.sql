-- Copia local de tickets importados desde la exportación oficial.
-- QABase no crea tickets ni llama al sistema institucional.

CREATE TABLE helpdesk_tickets (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  description TEXT NULL
    CHECK (description IS NULL OR length(description) <= 5000),
  status TEXT NOT NULL,
  requester TEXT NULL,
  organization TEXT NULL,
  team TEXT NULL,
  analyst TEXT NULL,
  reported_at TEXT NULL,
  created_at TEXT NOT NULL,
  last_imported_at TEXT NOT NULL
);

CREATE INDEX helpdesk_tickets_reported_idx
  ON helpdesk_tickets (reported_at DESC, id DESC);

CREATE TABLE helpdesk_attachments (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL
    REFERENCES helpdesk_tickets (id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NULL,
  size_bytes INTEGER NULL,
  storage_path TEXT NULL,
  imported_at TEXT NOT NULL,
  UNIQUE (ticket_id, source_id)
);

CREATE INDEX helpdesk_attachments_ticket_idx
  ON helpdesk_attachments (ticket_id);

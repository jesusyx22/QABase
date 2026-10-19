-- Estado de la última sincronización de Mesa de Ayuda desde el agente local.

CREATE TABLE helpdesk_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL CHECK (status IN ('never', 'success', 'error')),
  last_started_at TEXT NULL,
  last_finished_at TEXT NULL,
  message TEXT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO helpdesk_sync_state (id, status) VALUES (1, 'never');

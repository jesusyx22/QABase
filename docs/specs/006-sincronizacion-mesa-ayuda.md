# 006 — Sincronización de Mesa de Ayuda desde agente local

- **Estado:** aprobada
- **Fecha:** 2026-10-18
- **ADR:** `docs/adr/0005-sincronizacion-agente-local.md`
- **Sustituye:** importación CSV de la spec 005

## Contexto

No hay CSV disponible. La web institucional no es alcanzable desde el VPS, pero
sí desde la red del usuario/Termux. La sincronización debe ser de solo lectura y
nunca crear tickets.

## API

### `POST /api/helpdesk/ingest`

Sin sesión de usuario. Autenticada con `X-Sync-Token` (secreto local en
`data/sync-token`, 0600). Solo se acepta desde loopback; en producción llega por
el túnel SSH del agente.

```ts
type IngestPayload = {
  tickets: Array<{
    reference: string          // R-\d+
    subject: string            // 1–200
    status: string             // no vacío; se conserva el original
    description?: string | null // <= 5000
    requester?: string | null
    organization?: string | null
    team?: string | null
    analyst?: string | null
    reportedAt?: string | null // AAAA-MM-DD o ISO; si falta, ahora
  }>
}
```

Respuesta:

```ts
type IngestResult = {
  created: number
  updated: number
  rejected: Array<{ row: number; reason: string }>
}
```

- Upsert por `reference`; conserva `created_at`; nunca borra.
- Valida referencias, asunto, estado, longitudes, fecha y duplicados del lote.
- Actualiza `helpdesk_sync_state` con estado, fecha, conteos y mensaje.
- No expone ninguna ruta para crear tickets.

### `GET /api/helpdesk/sync-status`

Requiere `mesa.ver`. Devuelve:

```ts
type SyncStatus = {
  status: 'never' | 'success' | 'error'
  lastStartedAt: string | null
  lastFinishedAt: string | null
  message: string | null
  createdCount: number
  updatedCount: number
  rejectedCount: number
}
```

## Agente local

`scripts/helpdesk-agent/helpdesk_agent.py`:

- Corre en Termux, donde la web es accesible.
- Login con formulario detectado; solo `GET` después del login.
- `--discover`: guarda HTML local 0600 y muestra formularios, tablas y cabeceras.
- `--sync`: extrae tickets, filtra por `HELPDESK_ASSIGNED_TO`, envía a QABase.
- Credenciales en `~/.qabase/helpdesk.env` (0600); nunca en el repo ni en logs.
- Token en `QABASE_SYNC_TOKEN`; se lee de `data/sync-token` en el VPS.
- Nunca crea, edita, cierra, asigna ni comenta tickets.

## Criterios de aceptación

1. No existe endpoint ni UI de importación CSV.
2. `POST /api/helpdesk/ingest` sin token o con token incorrecto devuelve 401.
3. Con token correcto, crea/actualiza por referencia y conserva `created_at`.
4. Un lote con referencias inválidas o asuntos vacíos rechaza esas filas e importa las válidas.
5. El estado de sincronización pasa de `never` a `success` con conteos.
6. Un ticket que no viene en una ingesta posterior permanece en la copia local.
7. La UI muestra la última sincronización y no ofrece importar archivos ni crear tickets.
8. La búsqueda por referencia/asunto/analista y el detalle siguen funcionando.
9. Ningún test ni comando del repo llama a la web institucional.
10. El agente no imprime credenciales ni cookies.

## Archivos

```text
migrations/005-mesa-sync.sql
apps/api/src/modules/helpdesk/sync.ts
apps/api/src/core/security/sync-token.ts
apps/api/src/routes/helpdesk.ts
apps/web/src/pages/HelpdeskPage.tsx
scripts/helpdesk-agent/helpdesk_agent.py
```

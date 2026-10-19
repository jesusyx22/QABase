# 008 — Asignaciones de accesos a QAs

- **Estado:** aprobada
- **Fecha:** 2026-10-19
- **Rama:** `feat/accesos`
- **Depende de:** `docs/specs/007-accesos.md`

## Problema

El catálogo de accesos ya existe, pero no permite saber qué accesos tiene cada
QA, cuándo vencen ni cuáles ya vencieron. La asignación debe ser una entidad
independiente del catálogo y de la persona, con vencimiento por asignación.

## Alcance

### Dentro

- Pestaña **Por QA** dentro de Accesos.
- Lista de QAs con conteos, próximo vencimiento y semáforo.
- Detalle por QA con asignaciones vigentes/por vencer y vencidas.
- Vista inversa dentro del detalle de un acceso: QAs asignados.
- Alta, edición de QA/acceso/fecha y renovación sobre el mismo registro.
- Historial de cambios por asignación.
- Permisos existentes `accesos.ver` y `accesos.gestionar`.

### Fuera

- Lista global de todas las asignaciones.
- Notificaciones por correo, Telegram u otro canal externo.
- Motivo o nota por asignación.
- Borrado físico o estado “revocada”.
- Carga masiva.
- Paginación mientras el volumen sea menor a 100 QAs y 500 asignaciones.
- Reportes históricos.

## Datos

Migración `migrations/007-access-assignments.sql`.

```text
access_assignments
├── id
├── access_id → accesses.id
├── person_id → personal_qa.id
├── expires_on TEXT NOT NULL  -- AAAA-MM-DD
├── version INTEGER NOT NULL DEFAULT 1
├── created_at TEXT NOT NULL
└── updated_at TEXT NOT NULL
```

Reglas:

- Un solo registro por `(access_id, person_id)`.
- Si vence, se renueva editando `expires_on`; no se crea otro registro.
- Sin borrado físico ni estado “revocada”.
- La fecha es la única fuente de vencimiento.
- Índices por persona, acceso y fecha.
- Sin datos demo.

## Fechas y estados

- Fecha sin hora; vence al final del día en `America/Lima`.
- Al crear, `expires_on` debe ser hoy o futuro.
- Al editar, se permiten fechas pasadas para corregir.
- Estados derivados, nunca almacenados:

| Días restantes | Estado | Urgencia | Texto |
|---|---|---|---|
| > 30 | `current` | `ok` | “Vence en X días” |
| 11–30 | `expiring` | `warning` | “Vence en X días” |
| 0–10 | `expiring` | `critical` | “Vence hoy” o “Vence en X días” |
| < 0 | `expired` | `expired` | “Vencido hace X días” |

- El color siempre se acompaña de texto.
- Tokens nuevos: `--warning` (naranja) y `--danger` (rojo); `--success` (verde)
  ya existe.
- Se documenta la excepción semántica en `DESIGN.md` y en un ADR.

## Permisos

- `accesos.ver`: lista Por QA, detalle, vista inversa y fechas.
- `accesos.gestionar`: asignar, editar QA/acceso/fecha y ver historial.
- Administrador recibe todos los permisos de forma implícita.
- Editor y Consulta solo consultan.
- No se crean permisos nuevos.

## API

Módulo `apps/api/src/modules/access-assignments/` y rutas
`apps/api/src/routes/access-assignments.ts`.

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/api/access-assignments/overview?q=&filter=&sort=` | `accesos.ver` | Lista de QAs + KPIs |
| GET | `/api/personal/:personId/access-assignments` | `accesos.ver` | Detalle del QA |
| GET | `/api/accesses/:accessId/assignments` | `accesos.ver` | Vista inversa |
| POST | `/api/access-assignments` | `accesos.gestionar` | Crear |
| PATCH | `/api/access-assignments/:id` | `accesos.gestionar` | Editar |
| GET | `/api/access-assignments/:id/history` | `accesos.gestionar` | Historial |

### Formas

```ts
type AssignmentState = 'current' | 'expiring' | 'expired'
type AssignmentUrgency = 'ok' | 'warning' | 'critical' | 'expired'

type AssignmentView = {
  id: number
  person: { id: number; name: string; isActive: boolean }
  access: {
    id: number
    address: string
    port: number
    portEnd: number
    environment: 'development' | 'qa' | 'production' | 'unspecified'
    protocol: 'tcp' | 'udp' | 'both' | null
    detail: string | null
    applications: string | null
    urls: string | null
    isActive: boolean
    version: number
    createdAt: string
    updatedAt: string
  }
  expiresOn: string
  state: AssignmentState
  urgency: AssignmentUrgency
  daysRemaining: number
  version: number
  createdAt: string
  updatedAt: string
}

type QaOverview = {
  person: { id: number; name: string; isActive: boolean }
  counts: { current: number; expiring: number; expired: number; total: number }
  nextExpiry: string | null
  urgency: 'critical' | 'warning' | 'ok' | 'expired' | 'none'
}

type OverviewResponse = {
  kpis: {
    qasWithAccess: number
    current: number
    expiring: number
    expired: number
  }
  qas: QaOverview[]
}

type AssignmentDetailResponse = {
  counts: { current: number; expiring: number; expired: number; total: number }
  current: AssignmentView[]   // no vencidas, orden ascendente por fecha
  expired: AssignmentView[]   // vencidas, orden descendente por fecha
}
```

- El detalle del QA incluye `person`; la vista inversa incluye `access`.
- `GET /api/access-assignments/overview`:
  - `q`: búsqueda parcial por nombre de QA, sin distinguir mayúsculas y
    conservando tildes/Ñ.
  - `filter`: `all` (por defecto, QAs activos), `withAccess`, `current`,
    `expiring`, `expired`, `none`, `inactive`.
  - `sort`: `urgency` (por defecto) o `name`.
  - Los KPIs son globales sobre QAs activos y no cambian con los filtros.
- `POST {personId, accessId, expiresOn}` → 201.
- `PATCH {personId?, accessId?, expiresOn?, version}` → 200.
- Duplicado QA + acceso → 409.
- Versión vieja → 409.
- QA o acceso inactivo:
  - bloquea nuevas asignaciones;
  - bloquea renovar o editar la fecha;
  - no altera asignaciones existentes.
- `expiresOn` inválida → 400.
- Historial con actor, momento y antes/después.
- Eventos: `access_assignment.created`, `access_assignment.updated`.
- Sin endpoint DELETE.

## Reglas de la lista Por QA

- Se listan todos los QAs activos por defecto, incluidos los que no tienen
  asignaciones.
- El filtro `inactive` muestra QAs inactivos.
- Semáforo de la fila:
  - rojo si alguna asignación no vencida tiene 10 días o menos;
  - naranja si la más urgente está entre 11 y 30 días;
  - verde si todas superan 30 días;
  - gris “Vencidos” si solo tiene vencidas;
  - neutro “Sin accesos” si no tiene ninguna.
- Orden por urgencia: `critical`, `warning`, `ok`, `expired`, `none`; luego
  nombre. Orden alternativo: nombre.
- KPIs:
  - `qasWithAccess`: QAs activos con al menos una asignación no vencida.
  - `current`: asignaciones no vencidas con más de 30 días.
  - `expiring`: asignaciones no vencidas con 30 días o menos.
  - `expired`: asignaciones con fecha pasada.
- Cada KPI filtra la lista al pulsarlo.

## UI

### Rutas

- `/accesos`: pestaña **Catálogo**.
- `/accesos/qas`: pestaña **Por QA**.
- `/accesos/qas/:personId`: detalle del QA.
- Vista inversa dentro del diálogo de detalle del acceso.

### Lista Por QA

- 4 KPIs clicables.
- Buscador por nombre.
- Filtros: Todos, Con accesos, Vigentes, Por vencer, Vencidos, Sin accesos,
  Inactivos.
- Orden por urgencia o nombre.
- Columnas: QA, Estado, Vigentes, Por vencer, Vencidos, Próximo vencimiento,
  Semáforo, Acciones.
- Acciones: Ver detalle; Asignar (solo `accesos.gestionar`).

### Detalle del QA

- Cabecera: nombre, estado, total y conteos por estado; botón “Asignar acceso”.
- Grupo “Vigentes y por vencer”, orden ascendente.
- Grupo “Vencidos”, los más recientes primero.
- Columnas: Acceso, Ambiente, Protocolo, Vence, Estado, Acciones.
- El acceso muestra detalle y `dirección:puerto`; badge “Acceso inactivo” si
  corresponde.
- Acciones: Ver acceso; Editar vencimiento e Historial (solo Administrador).
- Sin asignaciones: mensaje y CTA.

### Vista inversa

- Sección “QAs asignados” dentro del detalle del acceso.
- Mismos grupos y columnas adaptadas: QA, Vence, Estado, Asignado el, Acciones.
- Badge “QA inactivo” si corresponde.
- Acciones: Ver QA; Editar vencimiento e Historial (solo Administrador).
- El diálogo se amplía y permite scroll interno.

### Formulario de asignación

- Crear: QA preseleccionado y fijo; buscador de accesos activos; fecha
  obligatoria; atajos +30/+60/+90; opción “Asignar otro”.
- Los accesos ya asignados aparecen deshabilitados con “Ya asignado”; si la
  asignación está vencida, se ofrece editar esa asignación.
- Editar: permite QA, acceso y fecha; solo selector de fecha, sin atajos.
- Si la nueva fecha es anterior a la actual o deja la asignación vencida, pide
  confirmación.
- No hay borrado.

### Historial

- Diálogo por asignación, solo Administrador.
- Acción, actor, momento y antes/después.
- Etiquetas: “Asignación creada”, “Asignación actualizada”.

### Estados

- Cargando: skeletons.
- Vacío: explicación y acción si corresponde.
- Error: mensaje y “Reintentar”.
- Con datos: tablas agrupadas.

## Criterios de aceptación

1. Administrador asigna un acceso activo a un QA activo con fecha válida.
2. Se rechaza duplicado QA + acceso con 409.
3. El mismo registro se renueva editando la fecha; no se duplica.
4. La fecha se interpreta en America/Lima y vence al final del día.
5. Los estados y colores respetan los umbrales 30/10/vencido.
6. La lista muestra todos los QAs activos y permite filtrar inactivos.
7. Los KPIs y filtros funcionan y son clicables.
8. El detalle agrupa vigentes/por vencer y vencidos.
9. La vista inversa muestra los QAs de un acceso.
10. Editor y Consulta solo ven; Administrador gestiona.
11. QA/acceso inactivo bloquea nuevas asignaciones y renovaciones.
12. Las asignaciones existentes de un acceso inactivo siguen visibles.
13. El historial muestra actor y antes/después.
14. No hay borrado físico ni datos demo.
15. `npm run verify` queda en verde.

## Archivos

```text
migrations/007-access-assignments.sql
packages/shared/src/access-assignments.ts
apps/api/src/modules/access-assignments/{validation,repository,service}.ts
apps/api/src/routes/access-assignments.ts
apps/web/src/features/access-assignments/*
apps/web/src/features/accesses/AccessesTabs.tsx
apps/web/src/pages/AccessesQaPage.tsx
apps/web/src/pages/AccessesQaDetailPage.tsx
apps/web/src/pages/AccessesPage.tsx
apps/web/src/features/accesses/AccessDetailDialog.tsx
apps/web/src/App.tsx
apps/web/src/components/ui/badge.tsx
apps/web/src/index.css
DESIGN.md
docs/adr/0009-asignaciones-y-semaforo.md
```

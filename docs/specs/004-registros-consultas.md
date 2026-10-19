# 004 — Registros, consultas y métricas

- **Estado:** aprobada
- **Fecha:** 2026-10-18
- **Depende de:** 001, 003
- **Fuente:** secciones 5, 6 y 7 del documento de negocio

## Alcance

Méritos e incidencias con fecha del hecho, nivel, detalle, edición con versión, anulación irreversible e historial. Consulta con rango de fechas, filtros combinables, paginación, totales separados y tabla por QA.

### Fuera

- Saldo neto, rankings y evaluación de desempeño.
- Adjuntos, comentarios o aprobaciones.
- Exportación.
- Borrado o restauración.

## Datos

`migrations/003-registros.sql`:

- `impact_levels (type, level, label, description)`, PK `(type, level)`, 10 filas fijas.
- `records`: QA, tipo, fecha `AAAA-MM-DD`, nivel, detalle, estado, versión, fechas de sistema y datos de anulación.
- CHECK de coherencia estado/anulación, longitud de detalle, fecha con forma válida y FK compuesta a la escala.
- Índices por QA/fecha, estado, tipo, nivel y fecha.

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/records` | `registros.ver` |
| GET | `/api/records/levels` | `registros.ver` |
| POST | `/api/records` | `registros.crear` |
| PATCH | `/api/records/:id` | `registros.editar` |
| POST | `/api/records/:id/annul` | `registros.anular` |
| GET | `/api/records/:id/history` | `registros.ver` + `registros.historial` |

### Consulta

Parámetros: `from`, `to`, `all=1`, `qaId`, `type=merito|incidencia`, `level=1..5`, `q`, `includeAnnulled=1`, `page`, `pageSize=25|50|100`.

- Sin rango ni `all`: mes local actual.
- Rango inclusivo; fechas inválidas o invertidas → 400.
- `includeAnnulled` exige `registros.historial`.
- Texto: parcial sobre `detail`, sin distinguir mayúsculas, conservando tildes/Ñ; comodines escapados.
- Orden: `event_date DESC`, `created_at DESC`, `id DESC`.
- Totales y tabla por QA se calculan sobre vigentes filtrados, no sobre la página.
- Tabla por QA incluye todo el catálogo, con ceros y etiqueta de inactivo.
- Respuesta:

```ts
type RecordsPage = {
  items: RecordView[]
  page: number
  pageSize: 25 | 50 | 100
  total: number
  totals: {
    merits: { count: number; points: number }
    incidents: { count: number; points: number }
  }
  byQa: Array<{
    id: number
    name: string
    isActive: boolean
    merits: { count: number; points: number }
    incidents: { count: number; points: number }
  }>
}
```

### Mutaciones

- `POST {qaId, type, eventDate, level, detail}` → 201.
- `PATCH {qaId?, type?, eventDate?, level?, detail?, version}` → 200; al menos un campo; versión obligatoria.
- `POST /:id/annul {reason, version, confirm: true}` → 200; irreversible.
- Historial: eventos con antes/después y actor.

## Reglas

- Fecha real `AAAA-MM-DD`, no futura según el día local del servidor; sin límite inferior (`RN-REG-04`–`RN-REG-06`).
- Detalle recortado 1–5000 (`RN-REG-07`).
- Nivel entero 1–5; tipo mérito/incidencia (`RN-REG-08`, `RN-REG-09`).
- QA existente y activo para alta o cambio; si se conserva el mismo QA inactivo, se permite corregir otros campos (`RN-REG-02`, `RN-REG-16`, `RN-REG-17`).
- Nace vigente, versión 1 (`RN-REG-10`).
- Editar anulado → 409; versión vieja → 409 (`RN-REG-21`, `RN-REG-22`).
- Anular exige motivo 1–1000, confirmación y versión; no exige QA activo (`RN-REG-25`–`RN-REG-29`, `RN-REG-42`).
- Un segundo intento de anulación → 409 (`RN-REG-32`).
- Anulado no cuenta en totales ni tabla por QA (`RN-REG-35`, `RN-CON-35`, `RN-CON-45`).
- Historial de solo lectura, con actor y sin secretos (`RN-REG-37`–`RN-REG-40`).
- Auditoría en la misma transacción que la escritura.

## Criterios de aceptación

1. El seed crea exactamente 10 combinaciones de la escala con etiquetas distintas por tipo.
2. Crear un mérito válido lo deja vigente, versión 1, y suma 1 mérito y sus puntos.
3. Fecha futura, fecha inexistente, nivel 0/6, tipo inválido, detalle vacío o QA inactivo se rechazan sin escribir.
4. Editar con la versión vigente guarda antes/después; con versión vieja devuelve 409.
5. Editar un anulado devuelve 409.
6. Cambiar a un QA inactivo se rechaza; conservar el QA inactivo y editar el detalle se acepta.
7. Anular exige confirmación y motivo; deja estado anulado y no cuenta en totales.
8. Anular dos veces devuelve 409 y no duplica el evento.
9. La consulta por defecto usa el mes local actual.
10. Filtros de QA, tipo, nivel, texto y rango se combinan con “y”.
11. La paginación 25/50/100 informa el total filtrado y los totales no dependen de la página.
12. Los anulados solo aparecen con `includeAnnulled` y permiso de historial; nunca en totales.
13. La tabla por QA incluye las 21 personas, con ceros y etiqueta de inactivo.
14. La búsqueda `MUÑOZ` encuentra `Muñoz`; `munoz` no; `%` y `_` son literales.
15. El historial muestra creación, ediciones y anulación con actor.

## Archivos

```text
migrations/003-registros.sql
apps/api/src/modules/records/{repository,service,seed}.ts
apps/api/src/routes/records.ts
apps/web/src/pages/RecordsPage.tsx
apps/web/src/features/records/*
```

# 005 — Mesa de Ayuda por importación

> **Sustituida en la parte de importación CSV por la spec 006.** El modelo de
> tickets, la consulta local y el detalle siguen vigentes. La entrada ya no es
> un archivo: es la ingesta del agente local de solo lectura.

- **Estado:** parcialmente sustituida
- **Fecha:** 2026-10-18
- **Depende de:** 001
- **Fuente:** sección 9 del documento de negocio

## Restricción dura

La Mesa de Ayuda institucional es **producción**. QABase **no llama** a su API, **no hace scraping**, **no automatiza el navegador** y **no crea tickets**. El único canal es un archivo exportado que una persona descarga y luego importa en el panel. Ningún test toca la institución.

Por eso quedan fuera:

- Reporte rápido de tickets (`RN-MA-18`–`RN-MA-32`).
- Sincronización automática.
- Descarga remota de anexos.
- Asignación de equipo/analista.
- Cambios de estado o comentarios.

El módulo es de **solo lectura local** sobre la última importación.

## Datos

`migrations/004-mesa-ayuda.sql`:

- `helpdesk_tickets`: referencia única, asunto, descripción, estado, solicitante, organización, equipo, analista, fecha de reporte, creación local y última importación.
- `helpdesk_attachments`: metadatos de anexos; la importación actual no los crea. La descarga devuelve 404 si el archivo no existe.

## Importación CSV

`POST /api/helpdesk/import` con `Content-Type: text/csv` y cuerpo crudo. Permiso `mesa.ver`.

Cabeceras obligatorias:

```text
referencia,asunto,estado,solicitante,organizacion,equipo,analista,fecha_reporte,descripcion
```

- `referencia`: `R-` seguida de dígitos; clave de conciliación.
- `asunto`: 1–200 tras recortar.
- `descripcion`: opcional, hasta 5000.
- `estado`: obligatorio; se conserva el valor original.
- `fecha_reporte`: `AAAA-MM-DD` o ISO-8601; si falta, se usa el momento de importación.
- Filas inválidas se rechazan y se informan; las válidas se aplican en una transacción.
- Upsert por `referencia`: crea o actualiza; conserva `created_at`; nunca borra.
- Respuesta:

```ts
type ImportResult = {
  created: number
  updated: number
  rejected: Array<{ row: number; reason: string }>
}
```

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/helpdesk/tickets?q=` | `mesa.ver` |
| GET | `/api/helpdesk/tickets/:id` | `mesa.ver` |
| GET | `/api/helpdesk/attachments/:id/download` | `mesa.ver` |
| POST | `/api/helpdesk/import` | `mesa.ver` |

- Listado completo, sin paginación, orden `reported_at DESC, id DESC`.
- Búsqueda parcial en referencia, asunto y analista; sin distinguir mayúsculas, conservando tildes/Ñ; comodines escapados.
- La búsqueda no cubre descripción, solicitante, organización ni equipo.
- Estados conocidos se muestran en español; uno desconocido se muestra tal cual.
- Detalle de solo lectura, con descripción completa y anexos si existen.

## Criterios de aceptación

1. No existe ningún endpoint ni código que cree tickets o llame a la institución.
2. Importar un CSV válido crea tickets y devuelve conteos.
3. Importar dos veces el mismo archivo no duplica; actualiza y conserva `created_at`.
4. Una referencia inválida o un asunto vacío se rechazan e informan por fila.
5. Los campos entre comillas con comas y saltos de línea se leen correctamente.
6. La búsqueda encuentra por referencia, asunto o analista; no por descripción.
7. `MUÑOZ` encuentra `Muñoz`; `munoz` no.
8. Un estado desconocido se conserva y se muestra sin inventar traducción.
9. Un ticket que ya no viene en el CSV permanece en la copia local.
10. La descarga de un anexo inexistente devuelve 404.

## Archivos

```text
migrations/004-mesa-ayuda.sql
apps/api/src/modules/helpdesk/{csv,repository,service,seed?}.ts
apps/api/src/routes/helpdesk.ts
apps/web/src/pages/HelpdeskPage.tsx
apps/web/src/features/helpdesk/*
```

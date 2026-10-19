# 003 — Personal QA

- **Estado:** aprobada
- **Fecha:** 2026-10-18
- **Depende de:** 001
- **Fuente:** sección 4 del documento de negocio

## Alcance

Catálogo de personas independiente de las cuentas. Incluye el catálogo inicial de 21 personas.

### Dentro

- Migración `002-personal.sql` y seed insert-only de las 21 personas.
- Listado con búsqueda, opción de incluir inactivos y orden alfabético.
- Alta, renombrado, activación y desactivación con versión.
- Historial de la persona.

### Fuera

- Cuentas y roles.
- Registros y métricas.
- Borrado físico.

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/personal?includeInactive=1&q=` | `personal.gestionar` |
| GET | `/api/personal/options?includeInactive=1` | `registros.ver` o `registros.crear` |
| POST | `/api/personal` | `personal.gestionar` |
| PATCH | `/api/personal/:id` | `personal.gestionar` |
| GET | `/api/personal/:id/history` | `personal.gestionar` |

### Formas

```ts
type Person = {
  id: number
  sourceId: number | null
  name: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}
```

- `POST {name}` → 201 con la persona.
- `PATCH {name?, isActive?, version}` → 200; al menos un campo; versión obligatoria.
- `options` devuelve `{id, name, isActive}[]` para selectores de registros.
- Historial: `{occurredAt, actorUsername, action, before, after}`.

## Reglas

- Nombre obligatorio, recortado, 1–200 (`RN-QA-01`).
- Homónimos permitidos (`RN-QA-02`).
- Toda alta nace activa (`RN-QA-03`).
- Renombrar conserva id, registros e historial (`RN-QA-04`).
- Se puede renombrar activa o inactiva (`RN-QA-05`).
- Activar/desactivar es reversible y sin motivo (`RN-QA-06`).
- Inactiva no se ofrece para nuevos registros (`RN-QA-08`).
- No se borra (`RN-QA-14`).
- Búsqueda parcial sin distinguir mayúsculas, conservando tildes y Ñ; comodines escapados (`RN-QA-17`–`RN-QA-19`).
- Orden alfabético sin distinguir mayúsculas, id como desempate (`RN-QA-20`).
- Sin paginación (`RN-QA-21`).
- Versión desactualizada → 409 (`RN-QA-13`).
- Auditoría: `personal.created`, `personal.renamed`, `personal.deactivated`, `personal.reactivated`, en la misma transacción.

## Seed

- 21 personas de la tabla 4.6, con `source_id` 1–21 y grafías originales.
- Insert-only por `source_id`; no renombra ni reactiva filas existentes.
- La entrada 22 no existe (`RN-QA-23`–`RN-QA-25`).

## Criterios de aceptación

1. Una base nueva contiene exactamente 21 personas activas con sus `source_id`.
2. Ejecutar el seed dos veces no duplica ni sobrescribe nombres.
3. Crear una persona devuelve 201 y deja evento de alta.
4. Dos personas con el mismo nombre coexisten con ids distintos.
5. Renombrar conserva id y versión incrementada.
6. Desactivar y reactivar conserva id y registros.
7. Una versión vieja devuelve 409 y no cambia nada.
8. La búsqueda `MUÑOZ` encuentra `Muñoz`; `munoz` no.
9. `%` y `_` se buscan como texto literal.
10. `options` sin `includeInactive` solo devuelve activas.
11. El historial muestra nombre anterior y posterior y es de solo lectura.

## Archivos

```text
migrations/002-personal.sql
apps/api/src/modules/personal/{repository,service,seed}.ts
apps/api/src/routes/personal.ts
apps/web/src/pages/PersonalPage.tsx
apps/web/src/features/personal/*
```

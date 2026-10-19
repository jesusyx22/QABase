# 007 — Catálogo de accesos

- **Estado:** aprobada
- **Fecha:** 2026-10-19
- **Rama:** `feat/accesos`
- **Checkpoint:** `docs/plans/2026-10-19-accesos.md`
- **Extensión:** `docs/specs/009-importacion-destinos-firewall.md` (rango de
  puertos, ambiente `unspecified`, aplicaciones, URLs y dominios comodín).

## Problema

El equipo necesita un catálogo único de los accesos de firewall que existen en la empresa: dirección, puerto, ambiente, protocolo opcional, detalle y estado. Hoy no hay una fuente consultable y la vinculación con QAs se hará después, en un módulo separado.

## Alcance

### Dentro

- Catálogo de accesos independiente de QA.
- Alta, edición, activación/desactivación y detalle.
- Búsqueda por detalle, dirección o puerto; filtros por ambiente, estado y protocolo.
- Historial de solo lectura para Administrador.
- Permisos `accesos.ver` y `accesos.gestionar`.

### Fuera

- Asignación QA–acceso.
- Fecha de vencimiento y semáforo (módulo posterior).
- Borrado físico.
- Carga masiva o CSV.
- Datos demo precargados.

## Datos

Migración `migrations/006-accesos.sql`.

| Campo | Regla |
|---|---|
| `id` | Entero estable. |
| `address` | Obligatoria, 1–255. IPv4, IPv6, CIDR o dominio. |
| `address_normalized` | Minúsculas y sin espacios exteriores; clave de unicidad. |
| `port` | Entero 1–65535. Un solo puerto por acceso. |
| `environment` | `development`, `qa` o `production`. |
| `protocol` | `tcp`, `udp`, `both` o `NULL`. |
| `detail` | Opcional, 1–200 tras recortar; `NULL` si está vacío. |
| `is_active` | `0/1`, activo por defecto. |
| `version` | Entero `>= 1`; control optimista. |
| `created_at`, `updated_at` | ISO-8601 UTC. |

- Clave única: `(address_normalized, port, environment)`.
- Índices por ambiente, estado y protocolo.
- Sin borrado físico.

## Permisos

- `accesos.ver`: Administrador, Editor y Consulta. Permite listado y detalle.
- `accesos.gestionar`: solo Administrador. Permite alta, edición, activación/desactivación e historial.
- El rol Administrador recibe todos los permisos de forma implícita.

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/accesses?q=&environment=&status=&protocol=` | `accesos.ver` |
| GET | `/api/accesses/:id` | `accesos.ver` |
| GET | `/api/accesses/:id/history` | `accesos.gestionar` |
| POST | `/api/accesses` | `accesos.gestionar` |
| PATCH | `/api/accesses/:id` | `accesos.gestionar` |

### Formas

```ts
type Access = {
  id: number
  address: string
  port: number
  environment: 'development' | 'qa' | 'production'
  protocol: 'tcp' | 'udp' | 'both' | null
  detail: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}
```

- `POST {address, port, environment, protocol?, detail?}` → 201.
- `PATCH {address?, port?, environment?, protocol?, detail?, isActive?, version}` → 200; al menos un campo.
- `q` busca parcialmente en detalle, dirección y puerto (el puerto se compara como texto). Sin distinguir mayúsculas; conserva tildes y Ñ; comodines escapados.
- `status`: `all` (por defecto), `active` o `inactive`.
- `protocol`: `all` (por defecto), `tcp`, `udp`, `both` o `none`.
- Orden: ambiente (Desarrollo → QA → Producción), luego dirección y puerto.

## UI

- Módulo **“Accesos”** en **Principal**, visible con `accesos.ver`.
- Listado sin paginación: Detalle, Dirección, Puerto, Ambiente, Protocolo, Estado y acciones.
- Búsqueda y filtros; estado inactivo visible por defecto.
- Alta/edición en diálogo; Detalle opcional; estado activo por defecto.
- Detalle en diálogo con todos los campos y fechas.
- Historial en diálogo separado, solo si el usuario puede gestionar.
- Desactivar/reactivar con confirmación; sin borrado.
- Estados: cargando, vacío, error y con datos.

## Reglas

- Dirección válida: IPv4, IPv6, CIDR o dominio; se recorta y se normaliza a minúsculas para unicidad.
- Puerto obligatorio y entero 1–65535.
- Ambiente obligatorio.
- Protocolo opcional; `NULL` = “Sin especificar”.
- Detalle opcional; se recorta; máximo 200.
- Alta activa por defecto; toda alta deja evento `access.created`.
- Edición con versión; una versión vieja devuelve 409.
- Desactivar no borra, no cambia asignaciones y deja `access.deactivated`; reactivar deja `access.reactivated`.
- Historial de solo lectura, con actor y antes/después; sin secretos.

## Criterios de aceptación

1. Un Administrador crea un acceso válido y aparece en el listado.
2. Se rechazan dirección inválida, puerto fuera de rango, ambiente inválido y detalle de más de 200.
3. Se rechaza un duplicado con la misma dirección, puerto y ambiente; el mismo par en otro ambiente se acepta.
4. Editor y Consulta ven listado y detalle; no pueden crear, editar, desactivar ni ver historial.
5. El Administrador edita cualquier campo con versión; una versión vieja devuelve 409.
6. Inactivar/reactivar conserva el registro y el historial; no hay borrado.
7. La búsqueda por detalle, dirección o puerto y los filtros por ambiente/estado/protocolo funcionan.
8. El estado inactivo se muestra por defecto y se puede filtrar.
9. El historial muestra actor, momento y antes/después.
10. No se cargan datos demo automáticamente.
11. `npm run verify` queda en verde.

## Archivos

```text
migrations/006-accesos.sql
apps/api/src/modules/accesses/{validation,repository,service}.ts
apps/api/src/routes/accesses.ts
apps/web/src/pages/AccessesPage.tsx
apps/web/src/features/accesses/*
packages/shared/src/permissions.ts
apps/api/src/modules/identity/seed.ts
```

# 010 — Catálogo de Proxies publicados

- **Estado:** aprobada
- **Fecha:** 2026-10-20
- **Rama:** `feat/proxies`
- **Depende de:** `docs/specs/007-accesos.md`, `docs/specs/009-importacion-destinos-firewall.md`

## Problema

Los QAs necesitan un catálogo de accesos publicados mediante un reverse proxy
que corre en el PC del Administrador. QABase debe registrar qué accesos están
publicados, en qué puerto y con qué nombre, sin ejecutar ni monitorear el
script Python.

## Alcance

### Dentro

- Módulo **Proxies** en el grupo **Principal**.
- IP global IPv4 del puente, editable por Administrador.
- Un endpoint por acceso del catálogo de firewall.
- Detalle obligatorio y único por endpoint.
- Puerto único, activo/inactivo, edición y auditoría interna.
- Listado, búsqueda, filtros y copia de `IP:puerto`.

### Fuera

- Ejecutar, detener o monitorear el reverse proxy.
- Guardar scripts, comandos o rutas de Python.
- Asignar endpoints a QAs concretos.
- Historial visible en pantalla.
- Borrado físico.
- HTTP/HTTPS o enlaces clicables.
- Varios puentes o IPs por registro.

## Permisos

- `proxies.ver`: Administrador, Editor y Consulta.
- `proxies.gestionar`: solo Administrador.
- Administrador recibe todos los permisos de forma implícita.

## Datos

Migración `migrations/009-proxies.sql`.

### `proxy_settings`

Registro único con la IP global del puente.

```text
id = 1
host TEXT NOT NULL        -- IPv4
version INTEGER NOT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

- Solo puede existir una fila.
- `host` se valida como IPv4.
- No se puede crear un endpoint si no existe esta configuración.

### `proxies`

```text
id INTEGER PRIMARY KEY
access_id INTEGER NOT NULL UNIQUE REFERENCES accesses(id)
port INTEGER NOT NULL UNIQUE CHECK (port BETWEEN 1 AND 65535)
detail TEXT NOT NULL CHECK (length(detail) BETWEEN 1 AND 200)
detail_normalized TEXT NOT NULL UNIQUE
is_active INTEGER NOT NULL DEFAULT 1
version INTEGER NOT NULL DEFAULT 1
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

- Un acceso solo puede tener un endpoint.
- El puerto es único entre todos los endpoints, incluidos los inactivos.
- `detail` se recorta y es obligatorio; su unicidad no distingue mayúsculas.
- Sin borrado físico.
- Endpoint nuevo activo por defecto.
- Índices por estado y puerto.

## API

Módulo `apps/api/src/modules/proxies/` y rutas
`apps/api/src/routes/proxies.ts`.

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/api/proxies` | `proxies.ver` | Configuración global + listado |
| GET | `/api/proxies/access-options` | `proxies.gestionar` | Accesos activos sin endpoint |
| PATCH | `/api/proxies/settings` | `proxies.gestionar` | Crear/actualizar IP global |
| POST | `/api/proxies` | `proxies.gestionar` | Crear endpoint |
| PATCH | `/api/proxies/:id` | `proxies.gestionar` | Editar endpoint o estado |

### Formas

```ts
type ProxySettings = {
  host: string | null
  version: number | null
}

type ProxyView = {
  id: number
  port: number
  detail: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
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
}

type ProxyListResponse = {
  settings: ProxySettings
  proxies: ProxyView[]
}
```

- Estos tipos viven en `packages/shared/src/proxies.ts` y los consumen el API y la
  SPA; no se duplican en cada capa.
- `GET /api/proxies` devuelve `settings` y todos los proxies, activos e inactivos,
  ordenados por `detail`.
- `GET /api/proxies/access-options` devuelve accesos activos sin proxy.
- `PATCH /api/proxies/settings {host, version?}`:
  - crea la configuración si no existe;
  - actualiza si existe y la versión coincide;
  - una versión vieja devuelve 409.
- `POST /api/proxies {accessId, port, detail}` → 201.
- `PATCH /api/proxies/:id {accessId?, port?, detail?, isActive?, version}` → 200.
- `accessId` debe existir y estar activo.
- No se puede vincular un acceso que ya tenga otro endpoint.
- Al editar, se puede cambiar a otro acceso activo; no se puede vincular a uno
  inactivo.
- Un endpoint existente cuyo acceso se inactivó sigue visible y puede cambiar
  detalle, puerto o estado, pero no volver a un acceso inactivo.
- Puerto repetido → 409.
- Detalle repetido → 409.
- Sin configuración global → 409 al crear.
- Sin endpoint DELETE.
- La auditoría es interna: `proxy.created`, `proxy.updated`,
  `proxy.deactivated`, `proxy.reactivated`, `proxy.settings_updated`.
- No hay ruta de historial.

## UI

### Página Proxies

- Título **Proxies**; módulo en Principal con `proxies.ver`.
- Tarjeta de **IP global**:
  - muestra la IP actual y permite copiarla;
  - solo Administrador puede cambiarla;
  - si no está configurada, muestra aviso y deshabilita “Nuevo proxy”;
  - el cambio pide confirmación e indica cuántos endpoints se verán afectados.
- Listado sin paginación:
  - columnas: Detalle, Endpoint, Acceso, Ambiente, Estado y Acciones;
  - Endpoint se muestra como `IP:puerto` y se puede copiar;
  - Acceso muestra detalle y `dirección:puerto` como texto secundario;
  - advertencia **Acceso inactivo** si el acceso vinculado está inactivo;
  - inactivos visibles por defecto;
  - orden por Detalle;
  - búsqueda por detalle, endpoint o acceso;
  - filtros por ambiente y estado.
- Acciones por fila:
  - copiar endpoint;
  - ver acceso vinculado;
  - editar;
  - activar/desactivar con confirmación.
- Estados: cargando, vacío, error y con datos.

### Formularios

- **Nuevo proxy**:
  - selector de accesos activos sin endpoint;
  - puerto;
  - detalle obligatorio;
  - el endpoint nace activo.
- **Editar**:
  - detalle, puerto y acceso;
  - no edita la IP global;
  - versión y validaciones.
- **IP global**:
  - input IPv4;
  - confirmación al cambiar;
  - error visible.
- Sin página de detalle del proxy; “Ver acceso” abre el detalle existente del
  catálogo de firewall.

## Reglas

- Un endpoint por acceso.
- Detalle obligatorio, recortado, máximo 200, único sin distinguir mayúsculas.
- Puerto entero 1–65535, único incluso en inactivos.
- IP global IPv4; no se admiten hostnames ni IPv6 en este corte.
- No se crean endpoints sin IP global.
- El endpoint nuevo nace activo.
- Sin borrado; se desactiva.
- Editar puerto o detalle no cambia el acceso.
- La IP global afecta a todos los endpoints.
- Auditoría interna con actor y antes/después.

## Criterios de aceptación

1. Administrador configura una IPv4 global válida.
2. No se puede crear un proxy sin IP global.
3. Administrador crea un proxy para un acceso activo sin endpoint.
4. Se rechazan puerto y detalle duplicados.
5. Se rechaza un segundo proxy para el mismo acceso.
6. Se rechaza un proxy para un acceso inactivo.
7. Se rechaza un puerto fuera de 1–65535.
8. Editor y Consulta ven el listado; no crean, editan ni cambian estado.
9. El listado muestra Detalle, `IP:puerto`, Acceso, Ambiente, Estado y Acciones.
10. Copiar endpoint copia `IP:puerto`.
11. Búsqueda y filtros funcionan; los inactivos se ven por defecto.
12. Un acceso inactivo vinculado se muestra con advertencia.
13. Cambiar la IP global afecta a todos los endpoints y queda auditado.
14. No hay borrado físico ni pantalla de historial.
15. `npm run verify` queda en verde.

## Archivos previstos

```text
migrations/009-proxies.sql
packages/shared/src/permissions.ts
packages/shared/src/proxies.ts
apps/api/src/modules/identity/seed.ts
apps/api/src/modules/proxies/{validation,repository,service}.ts
apps/api/src/modules/proxies/proxies.test.ts
apps/api/src/routes/proxies.ts
apps/api/src/routes/proxies.test.ts
apps/web/src/features/proxies/*
apps/web/src/pages/ProxiesPage.tsx
apps/web/src/features/modules/registry.ts
apps/web/src/App.tsx
docs/adr/0012-modulo-proxies.md
```

# 011 — Servicios de proxy operables

- **Estado:** aprobada
- **Fecha:** 2026-10-20
- **Rama:** `feat/proxies-servicios`
- **Depende de:** `docs/specs/010-proxies.md`
- **Reemplaza parcialmente:** `docs/adr/0012-modulo-proxies.md`

## Problema

El módulo actual modela un proxy como un endpoint publicado: un acceso, un
puerto y un detalle. Los proxies reales del equipo son procesos con varias rutas
y, a veces, varios puertos. Además, hoy se inician y detienen a mano, sin estado
visible ni logs dentro de QABase.

QABase corre en la misma PC que los proxies (`10.4.24.18`), que permanece
encendida casi siempre. El panel sigue siendo local y solo escucha en loopback.

## Alcance

### Dentro

- Catálogo de **servicios de proxy**: nombre, slug, ambiente, puertos, rutas,
  health opcional y estado.
- Rutas con destino y vínculo opcional a un acceso de firewall.
- Monitoreo de estado por proceso y puerto, con health opcional.
- Iniciar, detener y reiniciar manualmente desde la UI.
- Procesos detached con reconciliación al arrancar QABase.
- Logs en archivo y últimas líneas visibles en el detalle.
- Permisos separados para ver, operar y gestionar.
- Sincronización del catálogo desde `scripts/proxies/<slug>/service.json`.

### Fuera

- Arranque automático al iniciar sesión o al encender la PC.
- Ejecutar comandos escritos en la base o en la UI.
- Editar el código o las rutas de un proxy desde la UI.
- Historial visible de estados.
- Borrado físico de servicios.
- HTTP/HTTPS en el endpoint publicado; se muestra `IP:puerto`.
- Varios hosts públicos; se conserva una IP global.

## Datos

Migración `migrations/010-proxy-services.sql`.

### `proxy_services`

```text
id INTEGER PRIMARY KEY
slug TEXT NOT NULL UNIQUE
name TEXT NOT NULL
environment TEXT NOT NULL CHECK (development|qa|production|unspecified)
entry TEXT NOT NULL              -- archivo dentro de scripts/proxies/<slug>/
health_path TEXT NULL
is_active INTEGER NOT NULL DEFAULT 1
version INTEGER NOT NULL DEFAULT 1
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

### `proxy_ports`

```text
id INTEGER PRIMARY KEY
service_id INTEGER NOT NULL REFERENCES proxy_services(id)
port INTEGER NOT NULL UNIQUE CHECK (port BETWEEN 1 AND 65535)
is_primary INTEGER NOT NULL DEFAULT 0
```

- Un solo puerto primario por servicio.
- El puerto es único entre todos los servicios, activos o no.

### `proxy_routes`

```text
id INTEGER PRIMARY KEY
service_id INTEGER NOT NULL REFERENCES proxy_services(id)
path TEXT NOT NULL
target TEXT NOT NULL
access_id INTEGER NULL REFERENCES accesses(id)
detail TEXT NULL
sort_order INTEGER NOT NULL DEFAULT 0
UNIQUE (service_id, path)
```

- `access_id` es opcional: hay destinos que no están en el catálogo de firewall.
- Las rutas y los puertos se reconstruyen desde el manifiesto al sincronizar.

### `proxy_settings`

Se conserva la tabla actual. `host` es la IPv4 de **enlace**: QABase la pasa a
cada proceso como `BIND_HOST` y los proxies escuchan solo en esa interfaz. Si
está vacía, se usa `0.0.0.0` para no romper instalaciones existentes. Cambiarla
no reinicia los servicios; hay que reiniciarlos para aplicar la nueva interfaz.

## Manifiesto

Cada servicio vive en `scripts/proxies/<slug>/` y declara `service.json`:

```json
{
  "name": "GitLab",
  "environment": "qa",
  "entry": "proxy.js",
  "ports": [8081],
  "primaryPort": 8081,
  "healthPath": null,
  "routes": [
    { "path": "/", "target": "http://10.5.5.201:80", "detail": "GitLab" }
  ]
}
```

- El `slug` sale del nombre de la carpeta y debe coincidir con
  `^[a-z][a-z0-9-]{0,31}$`.
- `entry` debe ser un archivo relativo dentro de la carpeta; no se admiten `..`
  ni rutas absolutas.
- Al arrancar, QABase sincroniza los manifiestos con la base: inserta servicios
  nuevos, actualiza los existentes y desactiva los que ya no tienen carpeta.
- Los comandos no vienen de la base: QABase ejecuta el `entry` con el Node del
  proceso, desde la carpeta del servicio.
- Sentinel se reimplementa con `http` nativo para no introducir Express ni
  dependencias npm; conserva las dos rutas, CORS y `/bridge-health`. GitLab y
  Mantis se copian tal cual, sin dependencias externas.
- Los ejecutables usan extensión `.cjs` porque el `package.json` raíz declara
  `"type": "module"`; con `.js`, Node los trata como ESM y `require` falla.

## Estado

- **Activo:** al menos un puerto esperado escucha y el proceso que lo posee es
  `node.exe`.
- **Iniciando:** QABase lanzó el proceso hace menos de 15 s y aún no escucha.
- **Detenido:** ningún puerto esperado escucha.
- **Conflicto:** el puerto está ocupado por un proceso que no es el esperado.
- **Error:** el proceso murió o el health no responde.
- Si hay `healthPath`, se consulta `http://127.0.0.1:<primario><healthPath>`;
  un fallo convierte el estado en `Error` con detalle.
- El estado se calcula bajo demanda. La UI refresca cada 10 s mientras la página
  está visible.

## Procesos

- QABase lanza `node <entry>` detached, con `cwd` en la carpeta del servicio y
  `BIND_HOST=<host>` para que escuche solo en la IPv4 configurada.
- stdout y stderr se anexan a `data/logs/<slug>.log`, con rotación básica.
- Se guarda el PID y la hora de arranque; al reiniciar QABase se reconcilia por
  PID y puertos.
- Detener envía terminación al árbol del proceso y espera; si no termina, fuerza.
- Un proceso activo iniciado fuera de QABase se muestra como activo; detenerlo
  exige confirmación porque QABase no lo lanzó.
- Si un puerto está ocupado por otro proceso, no se mata: se muestra conflicto.

## API

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/api/proxies` | `proxies.ver` | Configuración y servicios con estado |
| PATCH | `/api/proxies/settings` | `proxies.gestionar` | Crear/actualizar IP global |
| POST | `/api/proxies/:id/start` | `proxies.operar` | Iniciar servicio |
| POST | `/api/proxies/:id/stop` | `proxies.operar` | Detener servicio |
| POST | `/api/proxies/:id/restart` | `proxies.operar` | Reiniciar servicio |
| GET | `/api/proxies/:id/logs` | `proxies.operar` | Últimas líneas del log |

- `GET /api/proxies` devuelve `{ settings, services }`.
- Cada servicio incluye rutas, puertos con `listening`, estado, PID, si QABase lo
  lanzó y el detalle del estado.
- No hay `POST /api/proxies` ni `PATCH /api/proxies/:id` de definición.
- Las acciones de proceso se auditan: `proxy.started`, `proxy.stopped`,
  `proxy.restarted`, `proxy.start_failed`, `proxy.stop_failed`.
- La IP global se audita como `proxy.settings_updated`.

## Permisos

- `proxies.ver`: Administrador, Editor y Consulta.
- `proxies.operar`: Administrador y Editor.
- `proxies.gestionar`: solo Administrador.

El rol protegido recibe todos los permisos de forma implícita.

## UI

- Página **Proxies** en el grupo Principal.
- Tarjeta de IP global, con copia y edición solo para Administrador.
- Listado de servicios: Nombre, Endpoints, Rutas, Ambiente, Estado y Acciones.
- Endpoints como `IP:puerto`; si hay varios, uno por línea.
- Rutas: path y destino; el detalle secundario muestra el acceso vinculado o
  “Sin acceso en el catálogo”.
- Estado con texto y color semántico: Activo, Iniciando, Detenido, Conflicto,
  Error. Nunca solo color.
- Acciones: Iniciar, Detener, Reiniciar y Ver detalle/log.
- Detener y reiniciar piden confirmación.
- El detalle muestra puertos, rutas, health, PID, origen (QABase/externo) y las
  últimas 100 líneas del log.
- Estados de la vista: cargando, vacío, error y con datos.

## Criterios de aceptación

1. Los tres servicios (Sentinel, GitLab, Mantis) aparecen con sus puertos y
   rutas reales.
2. Sentinel muestra dos rutas; Mantis muestra dos puertos; GitLab una ruta.
3. El estado se calcula con proceso y puerto, sin falsos positivos por Docker o
   WSL.
4. Iniciar, detener y reiniciar funcionan y quedan auditados.
5. Detener un servicio iniciado fuera de QABase exige confirmación.
6. Un puerto ocupado por otro proceso se reporta como conflicto y no se mata.
7. Los logs quedan en `data/logs/<slug>.log` y se ven las últimas líneas.
8. Editor y Consulta ven el catálogo; solo Editor y Administrador operan; solo
   Administrador cambia la IP global.
9. No existe arranque automático ni ejecución de comandos arbitrarios.
10. `npm run verify` queda en verde en Windows.

## Archivos previstos

```text
migrations/010-proxy-services.sql
packages/shared/src/permissions.ts
packages/shared/src/proxies.ts
apps/api/src/modules/identity/seed.ts
apps/api/src/modules/proxies/{catalog,process,validation,repository,service}.ts
apps/api/src/modules/proxies/proxies.test.ts
apps/api/src/routes/proxies.ts
apps/api/src/routes/proxies.test.ts
apps/api/src/server.ts
apps/api/src/config.ts
apps/web/src/features/proxies/*
apps/web/src/pages/ProxiesPage.tsx
apps/web/src/features/modules/registry.ts
scripts/proxies/{sentinel,gitlab,mantis}/*
docs/adr/0013-operacion-proxies.md
```

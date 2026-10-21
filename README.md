# QABase

Panel local del equipo de QA para mantener el catálogo de Personal QA, registrar méritos e incidencias y consultar la copia local de la Mesa de Ayuda.

El producto, sus reglas y su arquitectura están en [`docs/product/qabase-reglas-de-negocio.md`](docs/product/qabase-reglas-de-negocio.md).

## Requisitos

- Node 24 o superior
- npm 11 o superior
- `sqlite3` CLI opcional, solo para inspeccionar la base

## Puesta en marcha

```bash
npm install
npm run setup     # crea la primera cuenta administradora y el secreto local
npm run dev:api   # Fastify en http://127.0.0.1:3000
npm run dev       # Vite en http://127.0.0.1:5173 (proxy /api)
```

`npm run setup` pide usuario y contraseña, aplica migraciones y carga los datos iniciales. Sin ese paso el servidor no arranca, porque el secreto de sesión es obligatorio.

La base se crea en `data/qabase.sqlite`. Las migraciones viven en `migrations/`.

## Build y ejecución local

```bash
npm run build     # API (tsup) + SPA (Vite)
npm start         # un solo proceso sirve la SPA y /api
```

## Módulos

| Módulo | Qué hace |
|---|---|
| Panel | Accesos directos a los módulos habilitados por permisos. |
| Méritos e Incidencias | Alta, edición, anulación, historial, filtros, totales y resumen por QA. |
| Mesa de Ayuda | Copia local de tickets asignados, sincronizada desde un agente local. **No crea tickets.** |
| Accesos | Catálogo de destinos de firewall y asignaciones por QA. |
| Proxies | Servicios reverse proxy, estado, operación y logs. |
| Personal QA | Catálogo de personas, estados e historial. |
| Usuarios | Cuentas, roles y restablecimiento de contraseñas. |
| Roles | Roles y permisos. |

### MongoDB por TCP

Los servicios `mongodb-qa` (`10.4.24.18:27017`) y `documentdb-qa`
(`10.4.24.18:27018`) publican MongoDB y DocumentDB mediante proxies TCP
transparentes. Solo aceptan las IPs o rangos CIDR de su allowlist; vacía
significa denegar todo. Cada entrada de allowlist lleva un nombre para
identificar al responsable. QABase no guarda usuario, contraseña ni URI: el
cliente se autentica directamente contra el motor. El detalle de cada servicio
permite editar la allowlist.

DocumentDB exige TLS y `directConnection=true`; el proxy conserva el cifrado de
extremo a extremo, pero no sigue el descubrimiento de réplicas.

### Mesa de Ayuda

El VPS no puede alcanzar la web institucional y no hay exportación CSV. La copia
local se alimenta de un **agente local en Termux** que inicia sesión, extrae solo
los tickets asignados y los envía a QABase por el túnel SSH con un token. QABase
**no** llama a la web, no crea tickets y no modifica el sistema de origen.

Instrucciones en `scripts/helpdesk-agent/README.md`. El token está en
`data/sync-token` (0600) y las credenciales de la web viven solo en
`~/.qabase/helpdesk.env` del dispositivo del agente.

```bash
python scripts/helpdesk-agent/helpdesk_agent.py --discover
python scripts/helpdesk-agent/helpdesk_agent.py --sync
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Crea la primera cuenta administradora. |
| `npm run reset-admin-password` | Reinicia localmente la contraseña de un administrador. |
| `npm run dev` | Vite con recarga en caliente. |
| `npm run dev:api` | Fastify con `tsx watch`. |
| `npm test` | Vitest (API, web y contratos). |
| `npm run typecheck` | TypeScript estricto por workspace. |
| `npm run lint` | ESLint sobre todo el repo. |
| `npm run build` | Bundle del API y build de la SPA. |
| `npm run db:migrate` | Aplica migraciones pendientes. |
| `npm run verify` | Gate único: typecheck + lint + test + build. |

## Estructura

```text
apps/web          React 19 + Vite + React Router + Tailwind + shadcn/ui
apps/api          Fastify 5 + node:sqlite + migraciones
packages/shared   contratos, permisos, validaciones y códigos de error
docs/adr          decisiones duraderas
docs/specs        especificaciones por módulo
docs/handoffs     relevos entre sesiones
scripts           agente local de Mesa de Ayuda
migrations        SQL versionado, solo hacia adelante
```

## Seguridad

- Solo escucha en loopback.
- Sesiones opacas de 8 horas, cookie `HttpOnly` + `SameSite=Strict`, CSRF en mutaciones.
- Argon2id para contraseñas.
- Sin acceso por red, sin multiempresa y sin respaldos automáticos.

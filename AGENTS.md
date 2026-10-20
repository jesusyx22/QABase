# QABase

## Qué es

Panel local del equipo de QA para mantener el catálogo de Personal QA, registrar méritos e incidencias y consultar la Mesa de Ayuda.

## Stack

- React 19 + Vite + TypeScript + React Router (SPA)
- Fastify 5 + TypeScript
- SQLite con `node:sqlite`, SQL explícito y sin ORM
- Tailwind 4 + shadcn/ui (Base UI) + tokens de `DESIGN.md`
- npm workspaces: `apps/web`, `apps/api`, `packages/shared`

## Comandos

- setup: `npm run setup`
- reset admin: `npm run reset-admin-password`
- dev web: `npm run dev`
- dev api: `npm run dev:api`
- test: `npm test`
- typecheck: `npm run typecheck`
- lint: `npm run lint`
- build: `npm run build`
- migraciones: `npm run db:migrate`
- importar inventario de firewall: `npm run import:firewall -- --dry-run` (el origen real vive en `data/imports/`, ignorado por Git)
- gate único: `npm run verify`

## Arquitectura

- Monolito modular: un proceso, una base local, la UI compilada servida por el API.
- Núcleo: datos, autenticación, permisos, auditoría, errores y texto.
- Módulos: ruta → servicio → repositorio, con escrituras propias de sus tablas.
- SQL solo en repositorios. Ni rutas, ni servicios, ni interfaz contienen SQL.
- Contratos compartidos en `packages/shared`, sin lógica ni acceso a datos.
- Permisos con formato `modulo.accion`; el servidor autoriza en cada petición.
- Migraciones `migrations/NNN-slug.sql`, solo hacia adelante; una aplicada no se edita.

## Convenciones

- TypeScript estricto. Sin `any` sin justificar.
- Sin ORM y sin `SELECT *` en código de negocio.
- Dinero en centavos; fecha del hecho `AAAA-MM-DD`; momentos en ISO-8601 UTC.
- Sin borrado físico: se desactiva, se anula o se conserva.
- Nunca exponer secretos, credenciales ni sesiones en respuestas, logs o auditoría.
- Desde el agente, no ejecutar SQL de escritura directo (`UPDATE`, `INSERT`, `DELETE`, `MERGE`, DDL) sobre bases locales o remotas sin que la tarea lo requiera y exista autorización explícita en ese momento. Las migraciones solo se ejecutan cuando se piden.
- La escritura de negocio y su evento de auditoría comparten transacción.
- Una decisión nueva no obvia → `docs/adr/`.
- Los módulos funcionales nuevos van al grupo `principal` del sidebar; `configuracion` se reserva para administración general (Personal QA, Usuarios, Roles).
- El estado Activo usa el token semántico `--success` (verde) e Inactivo queda neutro/gris; el verde no se usa como decoración.
- El semáforo de vencimientos usa `--success`, `--warning` y `--danger` con texto explícito; nunca se comunica solo con color.
- Movimiento: 120–160 ms, sin `transition: all`, sin rebotes ni 3D y respetando `prefers-reduced-motion`.

## Verificación obligatoria

Antes de afirmar que algo está listo: `npm run verify` y leer la salida.
Si se toca UI: revisar `DESIGN.md` y cargar la skill `web-design-guidelines`.

## Contexto y handoff

- `docs/handoffs/ACTIVE.md` es el handoff vivo de la sesión.
- Actualízalo **sin esperar a cerrar la sesión** cuando ocurra un hito:
  1. Se cierren decisiones de producto/arquitectura o se apruebe/cambie una spec.
  2. Termine una unidad de implementación, migración o cambio de contrato.
  3. Pase `npm run verify` o una revisión independiente.
  4. Se cambie de tarea, módulo o proyecto.
  5. Se vaya a hacer una pausa larga o el contexto empiece a ser grande.
- En esos hitos, actualízalo sin pedir confirmación; es parte del cierre del hito.
- Actualiza solo el delta: objetivo, estado, decisiones nuevas, hecho, pendiente,
  archivos clave, comandos ejecutados y siguiente paso.
- No dupliques specs, ADR ni diffs; referéncialos por ruta.
- No lo actualices en cada turno ni por cambios triviales. Si no hay delta, dilo.
- Al cerrar la tarea, archiva `ACTIVE.md` como
  `docs/handoffs/AAAA-MM-DD-<slug>.md`.
- En ramas que no son `main`, haz commit y push de cada cambio para conservar
  historial. En `main` sigue haciendo falta autorización explícita.
- `learn` es distinto: guarda solo conocimiento no obvio; no lo mezcles con el
  handoff.

## Delegación multiagente (Herdr)

Mapa vigente para repartir trabajo sin pisar archivos:

| Rol | Panel | Modelo | Uso |
|---|---|---|---|
| Coordinación | OpenCode `w1:p1` | `deepseek/deepseek-flash` (max) | Plan, integración, revisión de diffs y `verify` final |
| Worker OpenCode | OpenCode `w1:p7` | `nan/deepseek-v4-flash` | Tareas paralelas acotadas, tests, documentación y cambios simples |
| UI | `agy` `w1:p2` | Gemini 3.8 Flash High | Pantallas, componentes, estilos y revisión visual |
| Backend / DB / seguridad | Codex `w1:p6` | `gpt-6.1-sol` con reasoning `high` | API, SQLite, migraciones, concurrencia y refactors complejos |

Reglas:

- Codex se lanza con `codex -p qabase` para usar el perfil `~/.codex/qabase.config.toml`.
- Reparto por archivos disjuntos. Dos agentes no editan el mismo archivo a la vez.
- La revisión la hace un agente distinto al implementador.
- El coordinador revisa el diff y ejecuta `npm run verify` antes de cerrar.
- Si Codex, `agy` o el OpenCode principal responden **límite de créditos o del plan**, no reintentar con ese agente: mover la tarea pendiente al worker OpenCode `w1:p7` con `nan/deepseek-v4-flash`.
- Si el worker NaN también queda limitado, el coordinador continúa y deja constancia en el relevo.
- No usar modelos pagos alternativos como fallback; el fallback acordado es `nan/deepseek-v4-flash`.

### Estrategia de paralelización

- Por defecto, 2–3 agentes en total: coordinador, implementador y revisor.
- Módulos cross-layer grandes: máximo 4 agentes (coordinador, backend, UI y tests); la revisión va después de integrar.
- Cambios pequeños o ambiguos: un solo agente; no paralelizar decisiones.
- Contrato primero: los tipos de request/response viven en `packages/shared` antes de repartir el trabajo; la UI puede mockear el API.
- Cada agente ejecuta typecheck y tests de su área; `npm run verify` se ejecuta una vez al integrar.
- Un dueño por archivo compartido; si dos agentes lo necesitan, lo integra el coordinador.
- Un revisor por área, distinto al implementador; no se revisa todo con todos.

## Dónde está la verdad

- Producto y reglas: `docs/product/qabase-reglas-de-negocio.md`
- Decisiones: `docs/adr/`
- Specs: `docs/specs/`
- Diseño: `DESIGN.md`
- Relevos: `docs/handoffs/`

## Mesa de Ayuda

Solo lectura. QABase **no** llama a la web institucional: el VPS no la alcanza. Un agente local en Termux inicia sesión, extrae únicamente los tickets asignados y los envía por el túnel SSH a `POST /api/helpdesk/ingest` con `X-Sync-Token` (`data/sync-token`). No hay importación CSV, no hay scraping desde el VPS y **nunca** se crean tickets. El módulo hace upsert por referencia y conserva la copia local.

## Notas técnicas

- `tsup` quita el prefijo `node:` por defecto: `node:sqlite` exige `removeNodeProtocol: false`. Si el build falla con `Cannot find package 'sqlite'`, es eso.
- El CLI de shadcn lee `apps/web/tsconfig.json`; si faltan `paths`, escribe los componentes en una carpeta literal `@/`.
- TypeScript 6 rechaza `baseUrl`; los `paths` se resuelven relativos al tsconfig.
- Vitest: `apps/web/src/test/setup.ts` debe llamar `cleanup()`; sin eso React puede fallar con `window is not defined` tras el teardown.
- `apiFetch` solo pone `application/json` si no hay `Content-Type`; la importación CSV depende de poder enviar `text/csv`.
- El API escucha únicamente en loopback (`127.0.0.1:3000`). Para verlo desde Termux o Windows hace falta un túnel SSH: `ssh -N -L 3000:127.0.0.1:3000 usuario@vps` y abrir `http://localhost:3000`. No exponer el puerto directamente.
- React 19: `react-hooks/set-state-in-effect` rechaza `setLoading(true)` síncrono dentro de un `useEffect`; deriva el estado de carga de una clave de petición y actualiza solo en callbacks asíncronos.
- Si una página es lazy en `registry.ts` y se importa estáticamente en `App.tsx`, Vite duplica el chunk; reutiliza el componente lazy del registry en las rutas.
- `npm run setup` exige una TTY: `apps/api/src/cli/prompts.ts` aborta sin terminal interactiva, así que un agente no puede crear el administrador; debe ejecutarlo el usuario. Ese paso genera `data/session-secret`, sin el cual la API no arranca.
- Para cambiar `data/qabase.sqlite`, detén la API y usa un snapshot consistente (`.backup` de SQLite o `Connection.backup()`); copiar solo el `.sqlite` mientras exista `-wal` pierde transacciones confirmadas.
- En este equipo no hay clave SSH ni `sshpass`/`plink`: para operar el VPS desde el agente, instala `paramiko` en `%TEMP%` y no persistas credenciales en el repo.
- `npm install` con npm 11 reescribe `package-lock.json` (marcadores `peer` y `libc`); revierte ese cambio si no se buscaba actualizar dependencias.
- Los proxies de `scripts/proxies/**` usan `.cjs`: el `package.json` raíz declara `"type": "module"` y un `.js` con `require` falla como ESM.
- `proxy_settings.host` es la interfaz de enlace: QABase la pasa como `BIND_HOST`; cambiarla exige reiniciar los servicios.
- La inspección de puertos usa `netstat -ano`; no vuelvas a `Get-NetTCPConnection`/`Get-CimInstance` en el camino caliente: añaden ~3 s por carga.

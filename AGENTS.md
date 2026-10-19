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
- La escritura de negocio y su evento de auditoría comparten transacción.
- Una decisión nueva no obvia → `docs/adr/`.
- Los módulos funcionales nuevos van al grupo `principal` del sidebar; `configuracion` se reserva para administración general (Personal QA, Usuarios, Roles).
- El estado Activo usa el token semántico `--success` (verde) e Inactivo queda neutro/gris; el verde no se usa como decoración.
- El semáforo de vencimientos usa `--success`, `--warning` y `--danger` con texto explícito; nunca se comunica solo con color.
- Movimiento: 120–160 ms, sin `transition: all`, sin rebotes ni 3D y respetando `prefers-reduced-motion`.

## Verificación obligatoria

Antes de afirmar que algo está listo: `npm run verify` y leer la salida.
Si se toca UI: revisar `DESIGN.md` y cargar la skill `web-design-guidelines`.

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

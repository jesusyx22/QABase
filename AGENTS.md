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

## Verificación obligatoria

Antes de afirmar que algo está listo: `npm run verify` y leer la salida.
Si se toca UI: revisar `DESIGN.md` y cargar la skill `web-design-guidelines`.

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

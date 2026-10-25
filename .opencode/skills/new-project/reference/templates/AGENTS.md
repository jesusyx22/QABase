# Proyecto

## Qué es
<una frase>

## Stack
- React 19 + <Vite o Next.js> + TypeScript
- <Fastify o Hono> + SQLite (better-sqlite3 + Drizzle)
- <Tailwind + shadcn | CSS Modules> + tokens de `DESIGN.md`

## Comandos
- dev: `npm run dev`
- test: `npm test`
- typecheck: `npm run typecheck`
- lint: `npm run lint`
- build: `npm run build`
- gate único: `npm run verify`

## Convenciones
- TypeScript estricto. Sin `any` sin justificar.
- Dinero en centavos; fechas en ISO-8601 UTC.
- Migraciones versionadas en `migrations/`; nunca editar una ya aplicada.
- No editar archivos generados ni `node_modules`.
- Una decisión nueva no obvia → `docs/adr/`.
- Contratos de API y DTOs en `packages/shared/src/<modulo>.ts`; API y UI no duplican formas.
- Trabajo multiagente: 2–3 agentes por defecto; máximo 4 en módulos cross-layer grandes.
- Un dueño por archivo; el coordinador integra los archivos compartidos.

## Verificación obligatoria
Antes de afirmar que algo está listo: `npm run verify` y leer la salida.
Si toco UI: revisar `DESIGN.md` y cargar la skill `web-design-guidelines`.

## Dónde está la verdad
- Decisiones: `docs/adr/`
- Specs: `docs/specs/`
- Diseño: `DESIGN.md`
- Relevos: `docs/handoffs/`

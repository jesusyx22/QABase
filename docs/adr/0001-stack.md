# ADR 0001 — Stack de QABase

- **Estado:** aceptado
- **Fecha:** 2026-10-18
- **Contexto:** arranque del proyecto desde `docs/product/qabase-reglas-de-negocio.md`

## Contexto y restricciones

La sección 14 del documento de negocio fija un monolito modular local: un proceso, una base SQLite, sin ORM (`BD-06`, `DES-03`), sin exposición a red (`SEG-01`) y con la interfaz compilada servida por el mismo servidor (`ARQ-02`). El equipo no tiene `make` ni `g++`, y la máquina corre Node 24.22.

El manual de arranque propone Drizzle, `better-sqlite3` y despliegue en VPS. Esas tres piezas chocan con el documento o con el entorno, así que este ADR registra las desviaciones.

## Decisión

| Capa | Decisión | Motivo |
|---|---|---|
| Front | Vite 8 + React 19 + TypeScript + React Router | SPA local; no hay SSR, SEO ni rutas públicas |
| Estilos | Tailwind 4 + shadcn/ui (`base-nova`, Base UI) | Tablas y formularios densos con componentes accesibles |
| API | Fastify 5 | Modelo de plugins para sesión, permisos y estáticos |
| DB | SQLite con `node:sqlite` | Builtin de Node 24, sin módulos nativos ni build tools |
| Acceso a datos | SQL explícito y parametrizado | `BD-06`, `BD-07`, `DES-03` |
| Migraciones | Runner propio en `apps/api/src/db/` | `BD-09`–`BD-16`: SQL versionado, atómico, hacia adelante |
| Contratos | `packages/shared` como fuente TS | `BE-55`–`BE-58` |
| Monorepo | npm workspaces | Un solo `npm install` y scripts por paquete |
| Tests | Vitest + Testing Library | Gate único; DB real y efímera |
| Build API | tsup → bundle ESM | `shared` no se compila por separado |
| Lint | ESLint 10 flat config | Un solo lint para todo el repo |

## Alternativas descartadas

- **Next.js:** añade SSR y un segundo modelo de servidor que `ARQ-02` no necesita.
- **Drizzle / Kysely:** `DES-03` prohíbe una capa que oculte el SQL; además el bloqueo optimista (`BD-07`) y la auditoría transaccional (`BE-43`) se expresan mejor con SQL directo.
- **`better-sqlite3`:** exige binario nativo; el equipo no tiene toolchain de compilación.
- **Hono:** más ligero, pero su modelo de middleware obliga a construir sesión, CSRF y estáticos con más piezas propias.
- **Servidor de estáticos separado:** contradice “un solo proceso” (`ARQ-02`).

## Consecuencias

- `tsup` elimina el prefijo `node:` por defecto; `node:sqlite` exige `removeNodeProtocol: false`.
- `packages/shared` no se compila: Vite lo consume como fuente y tsup lo bundlea en el API.
- shadcn usa Base UI, no Radix. El componente `form` no está disponible en el preset `base-nova`; los formularios se resolverán con Base UI Field o campos nativos en la primera spec que los necesite.
- Sin ORM, el mapeo fila → dominio es manual y cada repositorio debe declarar sus columnas (`BD-08`).
- Los tests de datos usan SQLite real (`:memory:` o archivo temporal), nunca mocks del driver.
- La raíz del repo se resuelve desde `apps/api/src/config.ts` y `apps/api/dist/server.js` con `../../../`; un test lo fija.
- El servidor rechaza `HOST` distinto de loopback al arrancar (`BE-03`).

## Pendiente

La integración con Mesa de Ayuda será por **importación de un archivo exportado** desde la web institucional, no por API REST. Se documentará en un ADR 0004 al abordar el módulo. El reporte rápido no podrá crear tickets remotos: es una decisión de producto pendiente.

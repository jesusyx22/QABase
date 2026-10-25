---
name: New Project
description: "Use only when starting a greenfield project (dashboard or internal app) with React and SQLite: verify the workflow skills, scaffold the repo, and create AGENTS.md, PRODUCT.md, DESIGN.md, agents, and commands. Do not use for new features, modules, or refactors in an existing project."
metadata:
  opencode/autoinvoke: false
---

# Arrancar un proyecto nuevo

Versión 2.1 · 20/10/2026

Eres el punto de entrada para un proyecto **desde cero**. No improvises el arranque y no escribas código de negocio en esta fase.

## Regla de oro

React y SQLite son obligatorios. Todo lo demás es una decisión que se pregunta, se toma y se documenta en un ADR. No asumas Next.js, Tailwind, shadcn, Drizzle ni Fastify sin confirmarlo.

## Paso 0 — Leer el manual

Lee `reference/flujo.md` completo antes de actuar. Es la fuente de verdad del flujo, las reglas de SQLite y React, y las plantillas. Si ya lo leíste en esta sesión, no lo repitas.

## Paso 1 — Confirmar el punto de partida

Pregunta y espera respuesta. Una pregunta a la vez:

1. ¿Es un proyecto nuevo y vacío, o hay código existente?
2. ¿Quién lo usa y qué decisión debe permitir tomar en menos de 10 segundos?
3. ¿Necesita SSR, SEO o rutas públicas? Si no, Vite + React Router.
4. ¿Cuántos usuarios y qué tipo de autenticación?
5. ¿Dónde se despliega? Un VPS con volumen para SQLite es el default.
6. ¿Qué tan densa es la UI? Dashboard operativo, panel gerencial o CRUD.

Si el usuario ya respondió algo, no lo vuelvas a preguntar.

## Paso 2 — Verificar las skills

```bash
npx skills ls -g -a opencode
ls ~/.config/opencode/skills ~/.agents/skills 2>/dev/null
```

Deben estar: `grilling`, `grill-me`, `tdd`, `code-review`, `diagnosing-bugs`, `handoff`, `web-design-guidelines`, `vercel-react-best-practices`.

Si falta alguna, instálala con los comandos de la sección 3 del manual. No instales packs alternativos ni skills que cubran las mismas fases.

## Paso 2.5 — Estrategia de agentes y contrato

Antes de repartir trabajo, decide y escribe el contrato:

- **Por defecto, 2–3 agentes en total**: coordinador, implementador y revisor.
- **Módulos cross-layer grandes**: máximo 4 agentes (coordinador, backend, UI y tests). La revisión va después de integrar.
- **Cambios pequeños o ambiguos**: un solo agente. No paralelices decisiones.
- **Contrato primero**: los DTOs de request/response de cada módulo viven en
  `packages/shared/src/<modulo>.ts`; API y UI los importan con `import type`.
- **Archivos disjuntos**: un dueño por archivo. Si dos agentes necesitan el mismo
  archivo compartido, lo edita el coordinador.
- **Verificación distribuida**: cada agente ejecuta typecheck y tests de su área;
  el coordinador ejecuta `npm run verify` una sola vez al integrar.
- **Revisión independiente**: un revisor distinto al implementador, por área. No
  revises todo con todos.

El contrato compartido evita que API y UI inventen formas distintas cuando
trabajan en paralelo. Los tipos no sustituyen los tests de integración.

## Paso 3 — Crear el repo

Sigue la Fase 1 del manual. Como mínimo:

```bash
mkdir <proyecto> && cd <proyecto>
git init
npm init -y
mkdir -p apps/api/src packages/shared/src docs/{adr,specs,handoffs} \
         .opencode/{agents,commands} migrations data backups
printf "node_modules/\ndata/\n.env*\nbackups/\n" > .gitignore
```

Sustituye el `package.json` raíz por el de la sección 5.2 del manual y crea
`apps/api/package.json` y `packages/shared/package.json` antes de `npm install`.

Decide con el usuario:

- Vite o Next.js.
- Tailwind + shadcn, CSS Modules u otra base.
- Fastify o Hono para la API.

Si el proyecto es de un solo paquete, omite `apps/` y `packages/` y ajusta los scripts.

## Paso 4 — Copiar las plantillas

Copia desde la skill y sustituye los marcadores `<...>`:

```bash
SKILL_DIR="${HOME}/.config/opencode/skills/new-project"
cp "$SKILL_DIR/reference/templates/AGENTS.md" ./AGENTS.md
cp "$SKILL_DIR/reference/templates/PRODUCT.md" ./PRODUCT.md
cp "$SKILL_DIR/reference/templates/DESIGN.md" ./DESIGN.md
mkdir -p .opencode/agents .opencode/commands
cp "$SKILL_DIR/reference/templates/agents/"*.md .opencode/agents/
cp "$SKILL_DIR/reference/templates/commands/"*.md .opencode/commands/
```

Después:

- Rellena `AGENTS.md` con los comandos reales del proyecto.
- Rellena `PRODUCT.md` con lo respondido en el paso 1.
- Ajusta `DESIGN.md` si hay UI; si no hay UI, bórralo.
- Si no usas shadcn, elimina esa línea de `AGENTS.md`.

## Paso 5 — Skill de stack

Solo si aplica, dentro del repo:

```bash
npx skills add shadcn/ui -a opencode
```

## Paso 6 — Primer ADR

Escribe `docs/adr/0001-stack.md` con:

- Contexto y restricciones.
- Decisión por capa: front, router, API, DB, estilos, tests.
- Alternativas descartadas y por qué.
- Consecuencias.

## Paso 7 — Proyecto vacío en verde

Antes de la primera feature:

```bash
npm install
npm run verify
```

Si no existe `verify`, créalo según la sección 5.2 del manual. No sigas hasta que pase, o hasta que el usuario acepte explícitamente un gate distinto.

## Paso 8 — Parar

No implementes nada. Entrega:

- Resumen del stack decidido.
- Rutas de `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` y el ADR.
- Confirmación de las skills instaladas.
- Siguiente paso: `/grill <idea>`.

## Criterio de terminado

- [ ] Ocho skills globales presentes.
- [ ] Repo con git y `.gitignore`.
- [ ] `AGENTS.md`, `PRODUCT.md` y `DESIGN.md` (si hay UI).
- [ ] `.opencode/agents/` y `.opencode/commands/`.
- [ ] `docs/adr/0001-stack.md`.
- [ ] Contrato compartido definido en `packages/shared/src/<modulo>.ts` para el
      primer módulo cross-layer.
- [ ] `npm run verify` en verde.
- [ ] Cero código de negocio escrito.

## Portabilidad

La skill es autocontenida: `SKILL.md`, `reference/flujo.md` y `reference/templates/`. Para llevarla a otra máquina, copia la carpeta `new-project` a `~/.config/opencode/skills/`. No depende de rutas del proyecto.

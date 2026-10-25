# Flujo de trabajo con OpenCode

> Sistema operativo para construir **dashboards y aplicaciones internas de tamaño medio**.
> Stack obligatorio: **React** en el front y **SQLite** como base de datos. Todo lo demás se decide por proyecto.
> Versión 2.1 · 20/10/2026 · OpenCode V2 · portable a cualquier agente que lea `AGENTS.md` y skills en Markdown.

---

## TL;DR

- **Stack fijo:** React 19 + SQLite + TypeScript. Lo demás se decide por proyecto y se anota en un ADR.
- **Global:** 8 skills. 6 de desarrollo, 1 de diseño, 1 de React. Nada más.
- **Por proyecto:** la skill del stack (p. ej. `shadcn/ui`) y, si aplica, una skill de dominio.
- **Flujo:** `/grill` → `/spec` → `/build` → `/verify` → `/review` → `/relevo`.
- **Gate único:** `npm run verify` (typecheck + lint + test + build). Sin eso no hay "listo".
- **Vía rápida:** un archivo y menos de 30 minutos → `tdd` + `/verify`, sin spec.
- **Contrato primero:** los DTOs de cada módulo cross-layer viven en `packages/shared/src/<modulo>.ts`; API y UI comparten la misma definición.
- **Diseño:** la dirección vive en `DESIGN.md`; las skills solo auditan.
- **Poda:** cada 2–4 semanas, `improve-codebase-architecture` y fuera lo que no usaste.

---

## 0. Cómo usar este documento

- Es un manual de arranque, no una biblia. Si una regla estorba en un proyecto concreto, se cambia y se anota el motivo en un ADR.
- **Si eres un agente:** lee las secciones 1, 2 y 3 antes de tocar código. No instales nada sin confirmar con el usuario.
- **Si eres una persona:** la sección 3 se ejecuta una vez por máquina; la 9 es el día a día.
- Las skills y comandos son **Markdown portable**. Cualquier agente que soporte `AGENTS.md` y skills puede usar este flujo; los comandos `/…` son la única parte específica de OpenCode.

### Invariantes del stack

| Pieza | Obligatoria | Por qué |
|---|---|---|
| React 19+ | Sí | Todo el front se escribe en React. Sin excepciones. |
| SQLite | Sí | Base de datos única, local al proceso, sin servidor que administrar. |
| TypeScript estricto | Sí | El tipado es la primera red de seguridad. |
| Git | Sí | La verdad vive en el repo, no en la memoria del agente. |

Todo lo demás —framework, router, ORM, estilos, charts, deploy— es una **decisión documentada**, no una preferencia implícita. Ver sección 5.

---

## 1. Principios

1. **Una skill por fase, no por tecnología.** Aclarar → especificar → implementar → verificar → revisar → cerrar.
2. **React y SQLite son fijos; el resto se decide.** Cada decisión no obvia termina en `docs/adr/`.
3. **El contexto se paga en cada turno.** `AGENTS.md` breve; `DESIGN.md` solo se lee cuando se toca UI.
4. **La verdad vive en el repo.** `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `docs/adr/`, `docs/specs/`, `docs/handoffs/`.
5. **Verificar antes de afirmar.** Ningún "listo" sin `npm run verify` ejecutado y leído.
6. **Una sola familia de skills.** Mezclar packs que cubren lo mismo (TDD, review, debugging) hace que el agente elija mal.
7. **El diseño se define en `DESIGN.md`.** Las skills de diseño auditan o ejecutan; no inventan la dirección visual.
8. **Menos es más.** Si no usaste una skill en tres semanas, se elimina.
9. **Contrato antes que paralelismo.** Los tipos que cruzan el API se definen una vez en `packages/shared`; después se reparte el trabajo.

---

## 2. Mapa del flujo

| Fase | Objetivo | Herramienta | Salida |
|---|---|---|---|
| 0. Preparar | Instalar skills, agentes y comandos | `npx skills add` + este documento | Entorno listo |
| 1. Nacer | Scaffold, git, documentos base | CLI del stack + plantillas | Repo con `AGENTS.md`, `DESIGN.md`, `docs/` |
| 2. Aclarar | Entender el problema antes de codificar | `/grill` | Decisiones y criterios de aceptación |
| 3. Especificar | Convertir la conversación en spec | `/spec` | `docs/specs/NNN-*.md` |
| 4. Construir | Implementar con tests primero | `/build`, `tdd` | Código + tests + commits |
| 5. Verificar | Typecheck, lint, tests y build | `/verify` | Gates en verde, con evidencia |
| 6. Revisar | Código, spec y UI | `/review` | Hallazgos corregidos |
| 7. Cerrar | Documentar y dejar relevo | `/relevo` | Handoff + repo limpio |
| 8. Podar | Revisar arquitectura y skills | `improve-codebase-architecture` | Deuda identificada, skills podadas |

**Vía rápida** (no todo necesita ceremonia):

| Situación | Qué hacer |
|---|---|
| Cambio de un archivo, menos de 30 minutos, sin tocar esquema ni auth | `tdd` + `/verify`. Sin `/spec`. |
| Feature nueva, endpoint, migración o pantalla | `/grill` → `/spec` → `/build` → `/verify` |
| 2–3 frentes con archivos disjuntos (máximo 4) | `/teamwork` |
| Bug difícil o comportamiento inesperado | `diagnosing-bugs` + test de regresión |
| Duda de diseño o requisito ambiguo | `/grill` antes de escribir una línea |

---

## 3. Preparar la máquina (una vez)

### 3.1 Requisitos

- Node 22+ (LTS) y `npx`
- Git
- OpenCode V2
- `sqlite3` CLI (para inspeccionar y respaldar)
- Opcional: `gh`, Docker, Playwright

### 3.2 Instalar las skills globales

```bash
# Desarrollo: 6 skills, una por fase
npx skills add mattpocock/skills -g -a opencode -y \
  --skill grilling \
  --skill grill-me \
  --skill tdd \
  --skill code-review \
  --skill diagnosing-bugs \
  --skill handoff

# Diseño y React: 2 skills transversales
npx skills add vercel-labs/agent-skills -g -a opencode -y \
  --skill web-design-guidelines \
  --skill vercel-react-best-practices
```

> El CLI instala en `~/.agents/skills/<nombre>/`. OpenCode descubre esa ruta y también `~/.config/opencode/skills/`, así que ambas valen. El **ID de la skill es el nombre del directorio**, no el `name` del frontmatter: por eso la skill de React se invoca como `vercel-react-best-practices`.

> `grill-me` **depende** de `grilling`: instala las dos o la primera fallará.

### 3.3 Verificar

```bash
npx skills ls -g -a opencode

# El CLI solo lista lo que instaló él; las skills puestas a mano viven aquí:
ls ~/.config/opencode/skills ~/.agents/skills 2>/dev/null
```

Deben aparecer estas ocho, y nada que cubra las mismas fases:

```text
grilling · grill-me · tdd · code-review · diagnosing-bugs · handoff
web-design-guidelines · vercel-react-best-practices
```

### 3.4 Quitar lo que se solapa

Si vienes de otro pack (Superpowers u otro), elimina las skills que cubren las mismas fases. Dos skills de TDD o de review hacen que el agente elija mal.

```bash
npx skills remove -g -a opencode \
  test-driven-development systematic-debugging writing-plans verification-before-completion

# Si las instalaste a mano (sin el CLI), borra el directorio:
rm -rf ~/.config/opencode/skills/{test-driven-development,systematic-debugging,writing-plans,verification-before-completion}
rm -rf ~/.agents/skills/{test-driven-development,systematic-debugging,writing-plans,verification-before-completion}
```

### 3.5 Opcionales (instalar solo si se usan)

```bash
# Arquitectura, para la poda de cada 2–4 semanas
npx skills add mattpocock/skills -g -a opencode -y \
  --skill improve-codebase-architecture --skill codebase-design

# Craft de interacción (micro-animaciones, foco, transiciones)
npx skills add emilkowalski/skills -g -a opencode -y --skill emil-design-eng
```

**No instales `impeccable` por defecto.** Es un director de diseño potente, pero añade un binario, hooks y 24 comandos. Si un proyecto merece una pasada de diseño, se instala solo ahí y se quita al terminar:

```bash
npx impeccable install --providers=opencode --scope=project
```

### 3.6 Instalar en otra máquina

Copia este archivo y ejecuta la sección 3.2. Las skills son Markdown y los comandos/agentes de las secciones 7 y 8 se copian al repo. No hay nada atado a un modelo concreto.

> **Windows (PowerShell):** sustituye `\` por `` ` `` al partir líneas. Todo lo demás funciona igual.

---

## 4. Skills: qué, para qué y cuándo

### 4.1 Núcleo (8 globales)

| Skill | Fase | Se invoca | Qué aporta |
|---|---|---|---|
| `grilling` | Aclarar | Automática (la usa `grill-me`) | Interrogatorio estructurado: una pregunta a la vez, sin inventar requisitos |
| `grill-me` | Aclarar | Manual (`/grill`) | Entrevista hasta que el plan no tenga huecos |
| `tdd` | Construir | Automática o `/build` | Rojo → verde → refactor, tests de comportamiento |
| `code-review` | Revisar | `/review` | Revisión en dos ejes: estándares del repo y spec, con subagentes en paralelo |
| `diagnosing-bugs` | Depurar | Automática | Reproducir, aislar, explicar la causa raíz y dejar test de regresión |
| `handoff` | Cerrar | `/relevo` | Compacta la sesión en un documento para el siguiente agente |
| `web-design-guidelines` | Revisar UI | `/review` | Auditoría de accesibilidad, foco, contraste, espaciado y estados |
| `vercel-react-best-practices` | Construir | Automática | Reglas de React 19: hooks, estado, data fetching, rendimiento |

### 4.2 Por proyecto (no global)

| Skill | Cuándo | Instalación |
|---|---|---|
| `shadcn/ui` | Si el proyecto usa shadcn/ui (funciona con Vite y con Next) | `npx skills add shadcn/ui -a opencode` |
| Skill de dominio | Si el proyecto repite un patrón (módulos, permisos, migraciones) | `.opencode/skills/<nombre>/SKILL.md` |

La skill de stack se instala **dentro del repo** para que viaje con el código y no contamine otros proyectos.

### 4.3 Cómo se invocan en OpenCode V2

- Las skills no son slash commands. El agente las carga con la herramienta `skill` usando su **ID** (el nombre del directorio, no el `name` del frontmatter).
- Para forzar una skill desde el prompt, menciónala como `@skill-id`.
- Las que llevan `disable-model-invocation: true` (por ejemplo `grill-me` y `handoff`) no se anuncian solas: hay que nombrarlas.
- Los `/comandos` de la sección 8 sí son slash commands reales.
- **Dentro de una plantilla de comando, `@ruta` no se expande.** No escribas `@grill-me` en el cuerpo de `/grill`; escribe "carga la skill `grill-me`". Es la diferencia entre funcionar y quedarse en texto muerto.

### 4.4 Lo que no se instala

- Dos packs que cubren TDD, review o debugging a la vez.
- Una skill por tecnología (React, Vite, Fastify, Drizzle…). Eso es documentación, no una fase.
- Skills "por si acaso". Cada descripción compite por atención en cada turno.
- `frontend-design`, `design-taste-frontend` o packs de landings para un dashboard interno: empujan identidad y hero, no densidad y claridad.

---

## 5. Stack: React + SQLite y decisiones por proyecto

### 5.1 Línea base recomendada

| Capa | Default | Alternativa | Cuándo cambiar |
|---|---|---|---|
| Front | Vite + React + TypeScript | Next.js (App Router) | Solo si hay SSR, SEO o rutas públicas |
| Router | React Router | TanStack Router | Si quieres rutas tipadas y búsqueda de parámetros |
| Datos remotos | TanStack Query | `fetch` + estado local | Si hay una sola llamada trivial |
| Estado global | Ninguno | Zustand | Si dos ramas lejanas comparten estado de UI |
| Estilos | Tailwind + tokens CSS | CSS Modules + tokens | Si el equipo no quiere Tailwind |
| Componentes | shadcn/ui | Headless UI + propios | Si no hay Tailwind |
| Charts | Recharts | ECharts / visx | Si hay más de ~7 series o mapas |
| Tablas | TanStack Table | `<table>` propio | Si hay menos de ~20 filas y no hay orden/filtro |
| Formularios | react-hook-form + Zod | Formulario nativo | Si es un solo campo |
| API | Fastify + TypeScript | Hono | Si el runtime es edge |
| DB | SQLite + `better-sqlite3` | `node:sqlite` (sin dependencias) | Si quieres cero módulos nativos |
| ORM | Drizzle ORM + `drizzle-kit` | Kysely o SQL plano | Si las consultas son analíticas y complejas |
| Validación | Zod, compartido cliente/servidor | — | — |
| Tests | Vitest + Testing Library | — | — |
| E2E | Playwright | — | Solo flujos críticos |
| Deploy | Un proceso Node + volumen para la DB | Docker + Caddy/Nginx | Nunca serverless con SQLite local |

**Regla:** una decisión por capa. No dos librerías que hacen lo mismo.

### 5.2 `package.json` mínimo

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w apps/web",
    "dev:api": "npm run dev -w apps/api",
    "build": "npm run build --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "eslint .",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "verify": "npm run typecheck && npm run lint && npm test && npm run build"
  }
}
```

`npm run verify` es el **único gate**. Si no pasa, no está listo, y el agente no puede decir lo contrario.

> Si el proyecto es de un solo paquete, quita `workspaces` y los `-w`: el gate es el mismo.

### 5.3 Reglas de SQLite que el agente debe conocer

1. **Un proceso, un escritor.** Abre una conexión por proceso y no compartas el archivo por red (NFS, SMB). SQLite no es un servidor.
2. **Pragmas al abrir:**

   ```ts
   import Database from "better-sqlite3";

   const db = new Database("data/app.db");
   db.pragma("journal_mode = WAL");
   db.pragma("busy_timeout = 5000");
   db.pragma("foreign_keys = ON");
   db.pragma("synchronous = NORMAL");
   ```

3. **Migraciones versionadas y hacia adelante.** Se generan con `drizzle-kit generate` y se aplican con un script explícito antes de desplegar. Nunca `push` automático contra producción.
4. **Transacciones cortas.** Rodear escrituras relacionadas; no mantener una transacción abierta mientras se espera una petición HTTP.
5. **Tipos de dato:** dinero en **enteros de centavos**, fechas en ISO-8601 UTC o epoch en milisegundos (elige uno y no lo mezcles), booleanos en `INTEGER 0/1`.
6. **Índices para lo que filtras y ordenas.** Si una vista tarda, `EXPLAIN QUERY PLAN` antes de tocar código.
7. **Nada de blobs grandes.** Archivos al sistema de archivos o a un object store; en la DB solo la ruta.
8. **Respaldo real:**

   ```bash
   sqlite3 data/app.db ".backup 'backups/app-$(date +%F-%H%M).db'"
   ```

   Para copias continuas, Litestream. Un `cp` de la DB en caliente no es un respaldo.
9. **Tests con DB real y efímera.** Un archivo temporal o `:memory:` por suite, migraciones aplicadas al inicio.
10. **Búsqueda de texto:** FTS5 si hace falta; no `LIKE '%…%'` sobre tablas grandes.

### 5.4 Reglas de React que el agente debe conocer

- **Estado de servidor ≠ estado de UI.** TanStack Query para lo primero; `useState`/`useReducer` para lo segundo. No metas respuestas de API en un store global.
- **La URL es estado.** Filtros, paginación, orden y pestañas activas van en la URL para que se puedan compartir y recargar.
- **No derives con `useEffect`.** Calcula en render o con `useMemo`; los efectos son para sincronizar con el exterior.
- **Claves estables.** Nunca el índice si la lista se reordena.
- **Carga por ruta.** `lazy` + `Suspense` antes de optimizar con memo.
- **Accesibilidad obligatoria:** `label` en cada campo, foco visible, navegación por teclado, contraste 4.5:1.
- **Toda vista de datos tiene cuatro estados:** cargando, vacío, error y con datos.
- **Mide antes de memoizar.** React 19 es rápido; el `useMemo` preventivo suele ser ruido.

---

## 6. Estructura del repo

```text
proyecto/
├── AGENTS.md                  # instrucciones que se pagan en cada turno (< 100 líneas)
├── PRODUCT.md                 # qué es, para quién, qué no es
├── DESIGN.md                  # reglas visuales y tokens (solo si hay UI)
├── docs/
│   ├── adr/                   # decisiones durables
│   │   └── 0001-stack.md
│   ├── specs/                 # especificaciones por tarea
│   │   └── 001-alta-de-clientes.md
│   ├── handoffs/              # relevos entre sesiones
│   └── conventions/           # opcional: reglas de código que se cargan siempre
├── .opencode/
│   ├── agents/
│   │   ├── orchestrator.md
│   │   ├── implementer.md
│   │   └── reviewer.md
│   └── commands/
│       ├── grill.md
│       ├── spec.md
│       ├── build.md
│       ├── verify.md
│       ├── review.md
│       ├── relevo.md
│       └── teamwork.md
├── apps/
│   ├── web/                   # React
│   └── api/                   # Node + SQLite
├── packages/
│   └── shared/                # tipos y esquemas Zod compartidos
├── migrations/                # SQL versionado
└── data/                      # app.db (ignorado por git)
```

**Presupuesto de contexto:**

- `AGENTS.md` se envía siempre: breve y operativo.
- `DESIGN.md` **no** va en `instructions`: se lee cuando se toca UI.
- `docs/adr/` y `docs/specs/` se leen bajo demanda; se referencian por ruta.

---

## 7. Documentos base

### 7.1 `AGENTS.md`

```md
# Proyecto

## Qué es
<una frase>

## Stack
- React 19 + Vite + TypeScript
- Fastify + SQLite (better-sqlite3 + Drizzle)
- Tailwind + tokens de `DESIGN.md`

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

## Verificación obligatoria
Antes de afirmar que algo está listo: `npm run verify` y leer la salida.
Si toco UI: revisar `DESIGN.md` y cargar la skill `web-design-guidelines`.

## Dónde está la verdad
- Decisiones: `docs/adr/`
- Specs: `docs/specs/`
- Diseño: `DESIGN.md`
- Relevos: `docs/handoffs/`
```

### 7.2 `PRODUCT.md`

```md
# Producto

- **Qué es:** <panel de gestión de …>
- **Para quién:** <gerencia / operaciones / clientes>
- **Trabajo principal:** <responder "cómo vamos" en menos de 10 segundos>
- **Éxito:** <métrica>
- **No es:** <lo que deliberadamente no hace>
- **Tono:** <sobrio, denso, sin decoración>
```

### 7.3 `DESIGN.md` (dashboards minimalistas)

````md
# Diseño

## Principios
1. Un solo acento. Grises neutros + un color de marca.
2. Verde/rojo/ámbar solo para estado, nunca decorativos.
3. Máximo 4 KPIs por fila.
4. Cifras con `font-variant-numeric: tabular-nums`.
5. Bordes de 1px; sombras solo para capas flotantes.
6. Radio 8–12px. Escala de espaciado de 8pt.
7. Sin degradados, glassmorphism, emojis como iconos ni 3D.
8. Movimiento 120–200ms y respetar `prefers-reduced-motion`.
9. Contraste mínimo 4.5:1 y foco visible.
10. Cada vista tiene estados: vacío, cargando y error.

## Jerarquía
- Título de página: 20–24px
- Título de sección: 14–16px
- Etiqueta: 12px
- Cuerpo: 14px

## Densidad
- Filas de tabla: 36–40px
- Padding de card: 16–24px
- Gap entre cards: 16–24px

## Charts
- Máximo 5–7 series.
- Sin doble eje.
- Unidades en el título.
- Barras con base cero.
- Una serie destacada; el resto en gris.

## Tokens
```css
:root {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.20 0 0);
  --muted: oklch(0.96 0 0);
  --border: oklch(0.90 0 0);
  --primary: oklch(0.55 0.16 255);
  --radius: 10px;
}
```
````

---

## 8. Configuración de OpenCode

### 8.1 Agentes

**Orquestador** (`.opencode/agents/orchestrator.md`): reparte, no implementa.

```md
---
description: Coordina subagentes y consolida resultados
mode: primary
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: subagent
    resource: implementer
    effect: allow
  - action: subagent
    resource: reviewer
    effect: allow
  - action: subagent
    resource: explore
    effect: allow
---

Eres un coordinador. No implementas: divides, delegas, verificas y consolidas.
Por defecto usa 2–3 subagentes en total; como máximo 4 en módulos cross-layer grandes.
Congela primero el contrato en `packages/shared/src/<modulo>.ts` y reparte archivos disjuntos.
Cada subagente recibe rutas, criterio de aceptación y límites explícitos.
Cada subagente ejecuta typecheck y tests de su área; tú ejecutas `npm run verify` una vez al integrar.
```

**Implementador** (`.opencode/agents/implementer.md`): escribe código y tests.

```md
---
description: Implementa una tarea acotada con TDD
mode: subagent
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: edit
    resource: "*"
    effect: allow
  - action: shell
    resource: "*"
    effect: allow
  - action: shell
    resource: "git push*"
    effect: ask
---

Implementa solo lo que se te asigna. Usa TDD. No toques archivos fuera de tu alcance.
Al terminar: typecheck y tests de tu área, y un resumen de archivos cambiados.
No ejecutes `npm run verify` si hay otros agentes en paralelo; el coordinador lo hará al integrar.
```

**Revisor** (`.opencode/agents/reviewer.md`): solo lectura.

```md
---
description: Revisa cambios sin editar ni ejecutar comandos
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
---

Revisa el diff que se te pasa en el prompt y los archivos que referencia.
Lista hallazgos por severidad con archivo:línea.
No propongas refactors fuera del alcance de la tarea.
```

> El revisor **no** ejecuta shell a propósito: si le das `git diff*`, la regla de comodín también acepta `git diff; rm -rf`. El diff se le pasa como texto.

### 8.2 Comandos

**`/grill`** — aclarar antes de construir.

```md
---
description: Interroga el plan hasta que esté claro
agent: plan
---

Carga la skill `grill-me` y úsala para interrogar al usuario sobre: $ARGUMENTS

Haz una pregunta a la vez. No escribas código ni propongas implementación todavía.
Al terminar, resume en 5–10 líneas: problema, restricciones, decisiones tomadas y
criterios de aceptación.
```

**`/spec`** — spec local, sin depender de un tracker.

```md
---
description: Convierte la conversación en una spec
agent: build
---

Escribe una spec en `docs/specs/` para: $ARGUMENTS

Usa el siguiente número disponible (`001`, `002`, …) y un slug corto.
Incluye: problema, resultado esperado, criterios de aceptación, seams de test,
archivos probables, riesgos y lo que queda fuera de alcance.
No implementes nada y no modifiques código.
```

**`/build`** — implementar con TDD.

```md
---
description: Implementa una spec con TDD
agent: build
---

Implementa la spec de `docs/specs/` cuyo nombre empieza por `$1` (por ejemplo `001-*.md`).

1. Lee la spec y `AGENTS.md`.
2. Carga la skill `tdd` y trabaja seam por seam.
3. Después de cada unidad: `npm run typecheck` y el test correspondiente.
4. No cambies archivos fuera del alcance de la spec.
5. Al terminar, ejecuta `npm run verify` y reporta la salida.
6. Resume archivos cambiados y cómo verificarlo.
```

**`/verify`** — la única prueba de "listo".

```md
---
description: Corre los gates del proyecto y reporta
agent: build
---

Ejecuta exactamente, en este orden:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build`

No corrijas nada. Reporta el resultado de cada comando y el primer error con
archivo:línea. Si alguno falla, el trabajo no está terminado.
```

**`/review`** — revisión completa.

```md
---
description: Revisión de código y de UI
agent: build
---

Revisa los cambios actuales desde `$1`. Si no se indica, usa `git merge-base main HEAD`;
si no existe `main`, usa `HEAD~1`. No edites archivos.

Código: carga la skill `code-review`, pásale el punto fijo `$1` y como spec la ruta
`docs/specs/` correspondiente. Si no hay tracker configurado, ignora esa parte y
trabaja solo con el diff y la spec.

UI: si hay archivos de interfaz tocados, carga `web-design-guidelines` y audítalos.

Devuelve hallazgos por severidad con archivo:línea. No edites.
```

**`/relevo`** — handoff visible en el repo.

```md
---
description: Documento de relevo para la siguiente sesión
agent: build
---

Carga la skill `handoff`, pero guarda el documento en
`docs/handoffs/AAAA-MM-DD-HHmm.md` en lugar del directorio temporal.

Incluye: objetivo de la sesión, estado actual, qué se hizo, qué quedó a medias,
decisiones tomadas (enlaza ADR/spec), siguiente paso concreto con archivos,
y skills sugeridas para la próxima sesión.

No dupliques specs ni diffs: referéncialos por ruta.
```

**`/teamwork`** — trabajo paralelo con subagentes.

```md
---
description: Reparte la tarea entre subagentes en paralelo
agent: orchestrator
---

Tarea: $ARGUMENTS

1. Inspecciona el repo y divide en 2–3 frentes independientes; usa 4 solo si el
   módulo es grande y los frentes son realmente disjuntos.
2. Congela antes el contrato DTO en `packages/shared/src/<modulo>.ts` y asigna
   a cada frente archivos sin solapamiento.
3. Lanza un subagente por frente con la herramienta `subagent`, `background: true`,
   pasando rutas, criterio de aceptación y límites. Usa `implementer` para código
   y `reviewer` para revisión.
4. Cada implementador ejecuta typecheck y tests de su área; no todos ejecutan el
   `verify` completo.
5. Cuando terminen, revisa, resuelve conflictos, ejecuta `npm run verify` una vez
   y consolida. La revisión final la hace un agente distinto al implementador.
```

### 8.3 Configuración extra (`opencode.jsonc`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["docs/conventions/*.md"]
}
```

No metas `DESIGN.md` en `instructions` salvo que **todo** el repo sea UI: se pagaría en cada turno.

### 8.4 Permisos recomendados (opcional)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "read", "resource": ".env*", "effect": "deny" },
    { "action": "shell", "resource": "git push*", "effect": "ask" },
    { "action": "shell", "resource": "*deploy*", "effect": "ask" },
    { "action": "shell", "resource": "rm -rf *", "effect": "ask" }
  ]
}
```

Las reglas se evalúan en orden y **gana la última que coincide**. Pon lo general antes de las excepciones.

---

## 9. Flujo completo desde cero

### Fase 0 — Preparar

Sección 3 de este documento. No sigas hasta que `npx skills ls -g -a opencode` muestre las ocho.

### Fase 1 — Nacer

```bash
# 1. Raíz del proyecto
mkdir panel && cd panel
git init
npm init -y

# 2. Front React con Vite
mkdir -p apps
npm create vite@latest apps/web -- --template react-ts

# 3. Carpetas base (API, shared, docs, comandos, migraciones)
mkdir -p apps/api/src packages/shared/src \
         docs/{adr,specs,handoffs} .opencode/{agents,commands} \
         migrations data backups

# 4. Ignorar lo que no va al repo
printf "node_modules/\ndata/\n.env*\nbackups/\n" > .gitignore

# 5. Workspaces: sustituye el package.json raíz por el de la sección 5.2,
#    crea apps/api/package.json y packages/shared/package.json, y enlaza:
npm install

# 6. Tailwind + shadcn en el front (si aplica)
npm install -D tailwindcss @tailwindcss/vite -w apps/web
(cd apps/web && npx shadcn@latest init && npx shadcn@latest add button card table chart)

# 7. Skill de stack, solo si usas shadcn
npx skills add shadcn/ui -a opencode
```

Después crea `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` (si hay UI), los agentes y los comandos de la sección 8. Primer commit.

> Si el proyecto necesita SSR o rutas públicas, usa Next.js en vez de Vite y conserva el resto del flujo igual.

### Fase 2 — Aclarar

```text
/grill panel de cobranza con KPIs, tendencia y tabla filtrable
```

`grill-me` interroga hasta que no queden huecos. Las decisiones arquitectónicas van a un ADR; las de producto, a la spec.

**No pases a la fase 3 con requisitos ambiguos.** Es la fase que más tiempo ahorra.

### Fase 3 — Especificar

```text
/spec panel de cobranza con KPIs, tendencia y tabla filtrable
```

Revisa la spec. Debe tener criterios de aceptación verificables ("la tabla ordena por fecha descendente al cargar", no "la tabla debe ser usable").

### Fase 4 — Construir

```text
/build 001
```

Reglas:

- TDD en cada seam acordado.
- Un commit por unidad de trabajo.
- Typecheck y tests después de cada unidad, no solo al final.
- Si el alcance cambia, se actualiza la spec antes de seguir.

Trabajo separable en 2–3 frentes (máximo 4 si el módulo es grande):

```text
/teamwork implementa filtros, tabla y exportación
```

### Fase 5 — Verificar

```text
/verify
```

El agente reporta la salida real de los cuatro comandos. Si algo falla, se corrige y se vuelve a ejecutar. **No se acepta "debería pasar".**

### Fase 6 — Revisar

```text
/review
```

Código contra estándares y spec; UI contra `DESIGN.md` y `web-design-guidelines`. Los hallazgos se corrigen y se vuelve a `/verify`.

### Fase 7 — Cerrar

- Actualiza `AGENTS.md` si cambió un comando o una convención.
- Añade un ADR si hubo una decisión arquitectónica.
- Actualiza `DESIGN.md` si cambió una regla visual.
- Ejecuta `/relevo` y commitea.

### Fase 8 — Podar (cada 2–4 semanas)

```text
Carga la skill improve-codebase-architecture y revisa el repo.
```

Requiere `codebase-design` y ADRs. Genera oportunidades de refactor; elige una, no diez.

Revisa también las skills:

```bash
npx skills ls -g -a opencode
```

Lo que no usaste, fuera.

---

## 10. Subagentes: cuándo y cómo

**Estrategia por defecto:**

- **2–3 agentes en total**: coordinador, implementador y revisor.
- **Módulos cross-layer grandes**: máximo 4 agentes (coordinador, backend, UI y
  tests). La revisión va después de integrar.
- **Cambios pequeños o ambiguos**: un solo agente. No paralelices decisiones.

**Úsalos cuando:**

- Hay 2–3 frentes realmente independientes (archivos distintos); como máximo 4
  en un módulo grande.
- Necesitas investigación paralela de solo lectura.
- La tarea es larga y quieres preservar el contexto del coordinador.

**No los uses cuando:**

- El cambio es pequeño o toca un solo archivo.
- Los frentes comparten archivos (se pisan).
- No puedes describir el criterio de aceptación en cinco líneas.
- La decisión de producto o el contrato todavía son ambiguos.

**Contrato primero:**

- Define los DTOs de request/response en `packages/shared/src/<modulo>.ts` antes
  de repartir.
- API y UI importan los mismos tipos con `import type`; no dupliques formas.
- Los tipos compartidos no validan runtime: mantén esquemas de ruta y tests de
  integración.

**Verificación distribuida:**

- Cada agente ejecuta typecheck y tests de su área.
- El coordinador ejecuta `npm run verify` una sola vez al integrar.
- Un revisor distinto al implementador revisa cada área; no se revisa todo con
  todos.

**Mecánica en OpenCode:**

- La herramienta `subagent` crea una sesión hija con contexto limpio.
- `background: true` devuelve el control y notifica al terminar.
- Puedes continuar una sesión hija pasando su `sessionID`.
- `general` no puede anidar subagentes; el orquestador debe ser `primary`.
- Los permisos `subagent` del padre deciden qué agentes puede lanzar.

**Regla de oro:** un archivo, un dueño. Si dos subagentes editan el mismo archivo, el flujo falla.

---

## 11. Verificación y definición de terminado

### 11.1 Gates

```bash
npm run verify
```

Equivale a:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Sin excepciones. Si un proyecto necesita E2E, se añade `npm run test:e2e` al gate, no se ejecuta "a veces".

### 11.2 Definición de terminado

- [ ] La spec tiene criterios de aceptación y todos se cumplen.
- [ ] Los DTOs compartidos están en `packages/shared/src/<modulo>.ts` cuando el módulo cruza API y UI.
- [ ] `npm run verify` pasa y se leyó la salida.
- [ ] Hay tests para el comportamiento nuevo o modificado.
- [ ] No quedan `TODO`, `FIXME` ni `console.log` en el diff.
- [ ] La UI tiene estados vacío, cargando y error.
- [ ] `AGENTS.md`, `DESIGN.md` o ADR actualizados si cambió algo estructural.
- [ ] `/relevo` escrito si la sesión deja trabajo a medias.
- [ ] Commits con mensaje claro y alcance acotado.

### 11.3 Qué no es evidencia

- "El código se ve bien".
- "Debería funcionar".
- Un test que no se ejecutó.
- La salida de un comando de una sesión anterior.
- Un subagente diciendo que terminó sin diff ni tests.

---

## 12. Antipatrones

- Instalar dos packs que cubren TDD, review y debugging (Matt + Superpowers).
- Usar BMAD, Spec-Kit o GSD en un proyecto pequeño: ceremonia y pérdida de control.
- Instalar 20 skills "por si acaso": descripciones compitiendo en cada turno.
- Meter `DESIGN.md` en `instructions`: se paga siempre.
- Dos skills de TDD o dos de review: el agente elige mal.
- Dos librerías de charts, dos ORM o dos validadores en el mismo repo.
- Subagentes editando el mismo archivo.
- `@skill` dentro de una plantilla de comando: no se expande.
- Confundir `handoff` (táctico, temporal) con ADR (durable).
- Programar un dashboard cuando Metabase o Lightdash lo resuelven antes.
- SQLite sobre NFS, `cp` de la DB en caliente o migraciones automáticas en producción.
- Meter respuestas de API en un store global de UI.
- Aceptar "listo" sin `npm run verify`.

---

## 13. Checklist de arranque

- [ ] Ocho skills globales instaladas y verificadas.
- [ ] Skills solapadas eliminadas.
- [ ] `AGENTS.md` con stack, comandos y verificación.
- [ ] `PRODUCT.md` y `DESIGN.md` si hay UI.
- [ ] `docs/adr/`, `docs/specs/`, `docs/handoffs/`.
- [ ] Contrato compartido del primer módulo cross-layer en `packages/shared/src/<modulo>.ts`.
- [ ] Agentes `orchestrator`, `implementer`, `reviewer`.
- [ ] Comandos `/grill`, `/spec`, `/build`, `/verify`, `/review`, `/relevo`, `/teamwork`.
- [ ] `npm run verify` funcionando antes de la primera feature.
- [ ] SQLite con WAL, `busy_timeout` y `foreign_keys`.
- [ ] Respaldo de la DB probado.
- [ ] Skill de stack instalada en el repo (si aplica).
- [ ] Revisión de skills y arquitectura agendada cada 2–4 semanas.

---

## 14. Probar el flujo (piloto)

Antes de usarlo en un proyecto real, haz una prueba de humo de un día:

1. Crea un dashboard desechable con 2 KPIs, una tabla y un filtro.
2. Ejecuta el flujo completo: `/grill` → `/spec` → `/build` → `/verify` → `/review` → `/relevo`.
3. Anota la fricción real:
   - ¿`grill-me` preguntó cosas útiles o se fue por las ramas?
   - ¿La spec evitó idas y vueltas o fue burocracia?
   - ¿`/verify` atrapó algo que el agente habría dado por bueno?
   - ¿`/review` encontró problemas reales?
   - ¿Qué skill no usaste?
4. Poda: elimina una skill, un comando o un paso que no aportó. El flujo óptimo es el más corto que sigue atrapando errores.

Criterio de éxito del piloto: el segundo dashboard se construye **más rápido** y con **menos correcciones manuales** que el primero.

---

## 15. Portabilidad a otro modelo

- `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` y `docs/` son texto plano: cualquier agente los lee.
- Las skills son carpetas con `SKILL.md` y frontmatter estándar (`name`, `description`). Se copian o se instalan con `npx skills`.
- Los agentes y comandos de la sección 8 son convenciones de OpenCode; en otro harness se traducen a su equivalente (instrucciones, subagentes, prompts guardados).
- No uses funciones específicas de un proveedor en el código del proyecto. El flujo sobrevive a cambiar de modelo; el código también debe.
- Si otro agente no soporta skills, pégale el cuerpo de la skill relevante en el prompt. Es Markdown, no magia.

**Prompt de arranque para otro agente:**

```text
Lee FLUJO-DE-TRABAJO-OPENCODE.md y AGENTS.md.
Instala las skills de la sección 3 si faltan.
No empieces a implementar hasta completar /grill y /spec.
Antes de decir que algo está listo, ejecuta npm run verify y muéstrame la salida.
```

---

## 16. Fuentes

- OpenCode V2: <https://opencode.ai/v2/docs/> (agents, commands, skills, instructions)
- Matt Pocock Skills: <https://github.com/mattpocock/skills>
- Vercel Agent Skills: <https://github.com/vercel-labs/agent-skills>
- skills.sh: <https://skills.sh/>
- shadcn/ui skills: <https://ui.shadcn.com/docs/skills>
- Impeccable: <https://github.com/pbakaus/impeccable>
- Emil Kowalski skills: <https://github.com/emilkowalski/skills>
- SQLite WAL: <https://sqlite.org/wal.html>
- SQLite backup: <https://sqlite.org/backup.html>
- Drizzle ORM (SQLite): <https://orm.drizzle.team/docs/get-started-sqlite>
- TanStack Query: <https://tanstack.com/query/latest>

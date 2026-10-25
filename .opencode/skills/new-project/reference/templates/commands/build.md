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

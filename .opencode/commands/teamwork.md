---
description: Reparte la tarea entre subagentes en paralelo
agent: orchestrator
---

Tarea: $ARGUMENTS

1. Inspecciona el repo y divide en 2–4 frentes independientes.
2. Asigna a cada frente archivos disjuntos (sin solapamiento).
3. Lanza un subagente por frente con la herramienta `subagent`, `background: true`,
   pasando rutas, criterio de aceptación y límites. Usa `implementer` para código
   y `reviewer` para revisión.
4. Cuando terminen, revisa, resuelve conflictos, ejecuta `npm run verify` y consolida.

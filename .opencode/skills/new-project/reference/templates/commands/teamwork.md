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

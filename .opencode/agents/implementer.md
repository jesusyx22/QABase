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
Al terminar: `npm run verify` y un resumen de archivos cambiados.

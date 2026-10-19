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

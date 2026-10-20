---
description: Documento de relevo para la siguiente sesión
agent: build
---

Carga la skill `handoff`, pero guarda el documento en
`docs/handoffs/AAAA-MM-DD-HHmm.md` en lugar del directorio temporal.

Si existe `docs/handoffs/ACTIVE.md`, ciérralo y archívalo con la misma fecha antes
de crear el documento final. El handoff final debe incluir: objetivo de la sesión,
estado actual, qué se hizo, qué quedó a medias, decisiones tomadas (enlaza
ADR/spec), siguiente paso concreto con archivos y skills sugeridas para la próxima
sesión.

No dupliques specs ni diffs: referéncialos por ruta.

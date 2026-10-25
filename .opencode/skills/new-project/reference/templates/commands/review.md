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

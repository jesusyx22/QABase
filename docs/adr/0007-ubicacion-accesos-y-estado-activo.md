# ADR 0007 — Accesos en Principal y verde semántico para el estado Activo

- **Estado:** aceptado
- **Fecha:** 2026-10-19
- **Spec:** `docs/specs/007-accesos.md`
- **Relacionado:** ADR 0006

## Contexto

El módulo Accesos se había ubicado en **Configuración**, pero no es una pantalla
de administración general del sistema: es un catálogo operativo que el equipo
consulta para trabajar. El usuario indicó que los módulos funcionales nuevos
deben ir en **Principal** y que Configuración queda para lo transversal
(Personal QA, Usuarios y Roles).

Además, los estados Activo/Inactivo se mostraban ambos en gris. El usuario pidió
diferenciar el estado positivo con verde. Esto modifica la regla anterior de
paleta estrictamente azul marino y neutros.

## Decisión

1. El módulo **Accesos** pasa al grupo **Principal** del sidebar.
2. Los módulos funcionales nuevos se ubican en **Principal**. El grupo
   **Configuración** se reserva para administración general del sistema.
3. El estado **Activo** usa el token semántico `--success` (verde) con fondo
   tintado y borde. El estado **Inactivo** permanece neutro/gris.
4. El verde es una excepción semántica: no se usa para botones, gráficos,
   decoración ni otros estados. La paleta base sigue siendo azul marino y
   neutros.
5. La regla se aplica de forma consistente a los badges de estado de Personal
   QA, Usuarios y Accesos.

## Alternativas descartadas

- **Dejar Accesos en Configuración:** mezcla un catálogo operativo con la
  administración general y contradice la navegación pedida.
- **Mantener todos los estados en gris:** no distingue de un vistazo el estado
  positivo.
- **Usar verde en toda la interfaz:** rompe la identidad visual y convierte el
  color en decoración.
- **Usar rojo para inactivo:** sugiere error o peligro; el estado inactivo es
  neutro y reversible.

## Consecuencias

- El sidebar muestra Accesos entre los módulos principales.
- `DESIGN.md` admite el verde semántico y documenta sus tokens.
- Los badges de estado Activo en Personal QA, Usuarios y Accesos comparten el
  mismo componente y variante.
- Cualquier módulo nuevo debe declarar `group: 'principal'` salvo que sea una
  pantalla de administración general.

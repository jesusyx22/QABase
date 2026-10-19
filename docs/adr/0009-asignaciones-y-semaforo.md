# ADR 0009 — Asignaciones QA–acceso y semáforo de vencimiento

- **Estado:** aceptado
- **Fecha:** 2026-10-19
- **Spec:** `docs/specs/008-asignaciones-accesos.md`
- **Relacionado:** ADR 0006

## Contexto

Un QA puede tener varios accesos de firewall, cada uno con su propia fecha de
vencimiento. El catálogo de accesos debe seguir siendo independiente de la
persona y de la asignación. Hace falta una vista operativa por QA y una vista
inversa por acceso.

El vencimiento es una fecha operativa de Perú, no un momento técnico. El
semáforo necesita naranja y rojo, además del verde ya aceptado para “Activo”.

## Decisión

1. Se crea `access_assignments` con una fila por **QA + acceso**.
2. La fecha `expires_on` es obligatoria, sin hora, y vence al final del día en
   `America/Lima`.
3. No hay borrado ni estado “revocada”. Para cortar antes, se edita la fecha.
4. Renovar es editar la misma fila; no se crea un registro nuevo.
5. La asignación exige QA y acceso activos para crear o renovar. Inactivar
   cualquiera de los dos no altera asignaciones existentes.
6. Se permite editar QA, acceso y fecha; toda edición exige versión y deja
   auditoría.
7. El estado se deriva de la fecha:
   - `current`: más de 30 días;
   - `expiring`: 30 días o menos, no vencida;
   - `expired`: fecha pasada.
   La urgencia separa `warning` (11–30) de `critical` (0–10).
8. Se añaden tokens semánticos `--warning` (naranja) y `--danger` (rojo). El
   color siempre va acompañado de texto. No se usan para decoración.
9. La lista principal es por QA. La vista inversa acceso → QAs vive en el
   detalle del acceso.
10. Se reutilizan `accesos.ver` y `accesos.gestionar`.

## Alternativas descartadas

- **Una tabla de asignaciones dentro de `accesses`:** impediría que un mismo
  acceso se asigne a varios QAs.
- **Fecha con hora:** convierte una regla operativa en un problema de zonas
  horarias y no aporta al caso de uso.
- **Estado “revocada”:** duplica el control de la fecha y complica el historial.
- **Borrar asignaciones:** rompe la auditoría y el historial.
- **Notificaciones externas en el primer corte:** añaden infraestructura sin
  validar primero la vista y el flujo interno.
- **Lista global de asignaciones:** la necesidad principal es por QA; se puede
  añadir después.

## Consecuencias

- Cada QA puede tener muchos accesos; cada acceso puede estar en muchos QAs.
- La lista por QA debe mostrar conteos y un semáforo que priorice lo urgente.
- Los vencidos se conservan y se agrupan aparte; no desaparecen.
- Los KPIs y filtros se calculan sobre QAs activos; los inactivos se consultan
  con un filtro explícito.
- La lógica de fechas y estados vive en `packages/shared` para que API y UI
  calculen lo mismo.

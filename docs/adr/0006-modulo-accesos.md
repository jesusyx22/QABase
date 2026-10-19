# ADR 0006 — Catálogo de accesos de firewall independiente de las asignaciones

- **Estado:** aceptado
- **Fecha:** 2026-10-19
- **Spec:** `docs/specs/007-accesos.md`
- **Checkpoint:** `docs/plans/2026-10-19-accesos.md`

## Contexto

El equipo necesita saber qué accesos de firewall existen en la empresa antes de
vincularlos a cada QA. Hoy esa información no tiene una fuente consultable y se
mezclaría con la asignación y la fecha de vencimiento si se modelara en una sola
tabla.

El catálogo es pequeño (menos de 100 accesos esperados), lo administra una sola
persona y el resto del equipo solo consulta. Los accesos pueden darse de baja
por infraestructura sin que eso borre el historial ni cambie una asignación
existente.

## Decisión

1. El acceso es una entidad **independiente del QA**. La asignación QA–acceso y
   la fecha de vencimiento quedan para un módulo posterior.
2. Los campos son dirección, puerto, ambiente, protocolo opcional, detalle
   opcional, estado, versión y fechas. La dirección admite IPv4, IPv6, CIDR o
   dominio; el puerto es único y va de 1 a 65535.
3. La clave única es **dirección normalizada + puerto + ambiente**. El protocolo
   y el detalle no forman parte de la clave.
4. No hay borrado físico. Desactivar es reversible, visible por defecto y no
   modifica asignaciones futuras; reactivar conserva el mismo registro.
5. Las ediciones usan **control optimista por versión**. Una versión vieja
   devuelve 409 y no sobrescribe.
6. Los permisos son `accesos.ver` (Administrador, Editor y Consulta) y
   `accesos.gestionar` (solo Administrador). El historial también exige
   `accesos.gestionar`.
7. La UI vive en **Principal → Accesos**, sin paginación, con búsqueda por
   detalle, dirección o puerto y filtros por ambiente, estado y protocolo. La
   ubicación y el color semántico del estado se precisan en el ADR 0007.
8. No se cargan datos demo automáticamente. Los ejemplos acordados quedan solo
   como documentación.

## Alternativas descartadas

- **Una sola tabla de asignaciones con los datos del acceso:** duplica el
  catálogo, impide reutilizar un acceso y mezcla dos ciclos de vida distintos.
- **Borrado físico:** rompería el historial y las asignaciones futuras.
- **Incluir vencimiento y semáforo en este corte:** el acceso no vence; vence la
  asignación a un QA. Se pospone para no fijar una regla equivocada.
- **Carga masiva o seed de demostración:** el catálogo real lo alimenta el
  Administrador y no debe contaminarse con ejemplos.
- **Paginación:** el volumen esperado no la justifica; añadiría estado y ruido a
  una pantalla de menos de 100 filas.

## Consecuencias

- Inactivar un acceso no corta una conexión ni cambia la fecha de una asignación
  existente; solo impide nuevas asignaciones cuando ese módulo exista.
- El módulo de asignaciones deberá leer el estado del acceso y mostrar el
  semáforo de vencimiento por asignación.
- La búsqueda conserva tildes y Ñ y escapa los comodines de SQLite; el puerto se
  busca como texto parcial.
- El catálogo arranca vacío. La pantalla debe explicar el estado vacío y ofrecer
  el alta solo a quien puede gestionar.
- Toda escritura de negocio y su evento de auditoría comparten transacción.

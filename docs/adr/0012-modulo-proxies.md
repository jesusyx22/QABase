# ADR 0012 — Catálogo de Proxies publicados y puente global

- **Estado:** aceptado
- **Fecha:** 2026-10-20
- **Spec:** `docs/specs/010-proxies.md`
- **Relacionado:** ADR 0006, ADR 0011

## Contexto

El Administrador publica ciertos accesos mediante scripts de reverse proxy que
corren en su PC. Los QAs necesitan saber qué `IP:puerto` usar y qué acceso hay
detrás. QABase no debe ejecutar ni monitorear esos scripts.

## Decisión

1. Se crea el módulo **Proxies** en **Principal**.
2. Cada proxy vincula un acceso existente del catálogo de firewall; un acceso
   solo puede tener un proxy.
3. Existe una única **IP global IPv4** del puente, configurable en la misma
   página por Administrador. No se admiten hostnames ni IPv6 en este corte.
4. Cada proxy tiene un puerto único, un detalle obligatorio y único, estado
   activo/inactivo y versión optimista.
5. El endpoint se muestra como `IP:puerto`, sin esquema HTTP/HTTPS.
6. No se guardan scripts, comandos ni estado de ejecución del proxy.
7. No hay borrado físico ni pantalla de historial; sí auditoría interna.
8. La IP global es obligatoria para crear endpoints; cambiarla afecta a todos.
9. Un acceso inactivo no admite nuevos vínculos; los endpoints existentes se
   conservan con advertencia.

## Alternativas descartadas

- **Ejecutar el proxy desde QABase:** añade procesos, credenciales, fallos y
  monitoreo que no son el objetivo del catálogo.
- **Varios hosts por fila:** complica el modelo; el puente es uno.
- **Hostname/DDNS:** el usuario usa una IPv4 fija en este corte.
- **Esquema HTTP/HTTPS:** no todos los proxies son HTTP.
- **Asignar proxies a QAs:** el control de acceso por QA ya existe en
  asignaciones; este módulo es un catálogo global.
- **Historial visible:** no se necesita; la auditoría interna conserva la
  trazabilidad.
- **Borrado físico:** rompe la reserva de puerto y la auditoría.

## Consecuencias

- Si la IP del puente cambia, se actualiza una sola vez y todos los endpoints
  muestran la nueva dirección.
- Un proxy inactivo conserva su puerto reservado; para reutilizarlo se edita el
  registro.
- La ejecución del script sigue siendo manual y fuera de QABase.
- Los QAs solo necesitan copiar `IP:puerto` del listado.
- Los permisos `proxies.ver` y `proxies.gestionar` separan consulta de gestión.
- El contrato de formas (settings, vista, listado e inputs) vive en
  `packages/shared/src/proxies.ts`; API y SPA consumen la misma definición.

# ADR 0013 — Operación de proxies desde QABase

- **Estado:** aceptado
- **Fecha:** 2026-10-20
- **Spec:** `docs/specs/011-proxies-servicios.md`
- **Reemplaza parcialmente:** ADR 0012
- **Relacionado:** ADR 0006, ADR 0011

## Contexto

QABase y los reverse proxies Sentinel, GitLab y Mantis corren en la misma PC
(`10.4.24.18`). Los tres se inician a mano, escriben solo a consola y no tienen
un estado consultable. El ADR 0012 decidió, con razón para ese corte, que QABase
no ejecutara ni monitoreara proxies.

El uso real cambió: el equipo necesita ver si están activos y reiniciarlos sin
buscar la terminal o el chat donde se lanzaron. QABase sigue siendo una
aplicación local en loopback y la PC permanece encendida casi siempre.

## Decisión

1. QABase evoluciona el módulo **Proxies** de endpoints a **servicios** con
   rutas y puertos.
2. El código de cada proxy vive versionado en `scripts/proxies/<slug>/` con un
   `service.json`. La base se sincroniza desde esos manifiestos.
3. QABase puede iniciar, detener y reiniciar los servicios, pero **no** acepta
   comandos escritos en la base ni en la UI.
4. Los procesos se lanzan detached con `node <entry>`, se registran por PID y se
   reconcilian al arrancar QABase.
5. El estado exige proceso esperado y puerto escuchando; el health es opcional.
   Un puerto ocupado por otro proceso es conflicto, no un activo.
6. No hay arranque automático: la operación es manual y auditada.
7. Los logs se guardan en `data/logs/<slug>.log` y se muestran las últimas
   líneas en el detalle.
8. Los permisos se separan en `proxies.ver`, `proxies.operar` y
   `proxies.gestionar`.
9. La IP global de `proxy_settings` es también la interfaz de enlace: se pasa
   como `BIND_HOST` y los proxies escuchan solo en esa IPv4. Cambiarla exige
   reiniciar los servicios.

## Alternativas descartadas

- **Mantener solo el catálogo:** no resuelve el estado ni el reinicio.
- **Comando configurable en base:** convierte el panel en un ejecutor de
  comandos arbitrarios.
- **Servicio o tarea de Windows:** añade privilegios, instalación y un ciclo de
  vida que el producto no necesita.
- **Supervisor separado:** más robusto, pero otro proceso y protocolo para
  mantener; detached + reconciliación cubre el caso local.
- **Un motor único de reverse proxy:** habría que reproducir las rarezas de
  GitLab (cabeceras y cookies), Mantis (redirección y dos puertos) y Sentinel
  (rutas); el riesgo de regresión es alto.
- **Arranque automático:** oculta fallos y complica el diagnóstico; se pospone.

## Consecuencias

- QABase ya no es solo un catálogo: opera procesos locales. La superficie se
  limita a servicios versionados y comandos fijos.
- El módulo deja de ser útil si QABase se despliega en otra máquina; el control
  de procesos solo funciona en el host de los proxies.
- Un proxy iniciado fuera de QABase puede adoptarse, pero detenerlo exige
  confirmación.
- Enlazar a una IPv4 concreta elimina el acceso por las demás interfaces
  (incluido localhost) y falla si esa IP no está asignada al arrancar.
- La migración `010` reconstruye el modelo; no hay datos que conservar.
- El ADR 0012 sigue vigente para el catálogo de endpoints y la IP global; esta
  decisión reemplaza solo la prohibición de ejecutar y monitorear.

# ADR 0005 — Sincronización de Mesa de Ayuda desde un agente local

- **Estado:** aceptado
- **Fecha:** 2026-10-18
- **Sustituye a:** ADR 0004 (importación CSV)
- **Spec:** `docs/specs/006-sincronizacion-mesa-ayuda.md`

## Contexto

El usuario no dispone de una exportación CSV utilizable. La web institucional
(`mesadeayuda.cajalosandes.pe`) es alcanzable desde su red/Termux, pero **no
desde el VPS**: el DNS resuelve, aunque las conexiones TCP a 443 y 80 expiran.
Un scraper ejecutado en el VPS no puede funcionar.

La necesidad es mantener actualizada una copia local de los tickets **asignados
al usuario**, sin crear ni modificar tickets en producción.

## Decisión

1. **Quitar la importación CSV** de la API y de la interfaz.
2. La sincronización se ejecuta en un **agente local en Termux**, donde la web
   sí es accesible.
3. El agente inicia sesión, hace solo `GET` y extrae los tickets asignados.
4. El agente envía un JSON a `POST /api/helpdesk/ingest`, autenticado con
   `X-Sync-Token`. El token vive en `data/sync-token` (0600) y se configura en
   Termux, nunca en el repositorio.
5. QABase **no** llama a la web institucional. El VPS no necesita alcanzarla.
6. La ingesta hace upsert por `referencia`, conserva `created_at` y nunca borra
   tickets locales.
7. **Nunca se crean, editan, cierran, asignan ni comentan tickets.** El agente
   solo hace login y GET; la API no expone una ruta de creación.
8. Los tests usan JSON sintético y bases efímeras. Ningún test toca producción.

## Alternativas descartadas

- **Scraper en el VPS:** bloqueado por red; no hay ruta TCP al sitio.
- **Proxy desde Termux (SOCKS inverso):** viable, pero exige mantener el
  teléfono conectado y un proxy adicional; más frágil que ejecutar el agente allí.
- **CSV:** el usuario no tiene una exportación disponible.
- **Navegador headless en el VPS:** mismo bloqueo de red, más peso.
- **Credenciales en el repositorio o en el chat:** prohibido.

## Consecuencias

- La sincronización es manual y depende de que el agente se ejecute en la red
  correcta. No hay programación automática todavía.
- El agente usa heurísticas de tablas/cabeceras; si el HTML autenticado cambia,
  hay que ajustar selectores. El modo `--discover` guarda una copia local para
  diagnosticar.
- Los anexos siguen sin importarse; el esquema y la descarga están preparados.
- El token de sincronización es un secreto local; se debe rotar si se filtra.
- La contraseña de la web institucional se guarda solo en
  `~/.qabase/helpdesk.env` (0600) en el dispositivo del agente. Nunca se imprime.

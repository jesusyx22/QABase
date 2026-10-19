# ADR 0004 — Mesa de Ayuda por importación, sin escritura remota

> **Sustituido por ADR 0005.** Se eliminó la importación CSV porque no hay una
> exportación disponible. La copia local ahora se alimenta de un agente local
> de solo lectura que envía tickets asignados a QABase.

- **Estado:** sustituido
- **Fecha:** 2026-10-18
- **Contexto:** el acceso disponible al sistema institucional es una exportación web, no una API REST. El sistema institucional es producción.
- **Spec:** `docs/specs/005-mesa-ayuda-importacion.md`

## Decisión

1. QABase **no** llama a la Mesa de Ayuda institucional: no hay cliente HTTP, scraping, automatización de navegador ni credenciales de integración.
2. El único canal de entrada es un **CSV exportado** que una persona descarga y luego importa manualmente.
3. La importación es idempotente por `referencia`: crea o actualiza la copia local y nunca borra.
4. El módulo es de **solo lectura**: no crea, edita, asigna, cierra ni comenta tickets.
5. El **reporte rápido queda fuera de alcance**. No se simula una creación que el sistema real no puede recibir.
6. Los anexos tienen tabla y endpoint de descarga, pero la importación actual no los crea; si el archivo local no existe, la descarga devuelve 404.
7. Ningún test, script o comando toca el sistema institucional. Los tests usan CSV de ejemplo y bases efímeras.

## Alternativas descartadas

- **Scraping o navegador headless:** frágil, requiere credenciales y automatiza un sistema de producción sin necesidad.
- **Llamar a endpoints internos del portal:** sigue siendo acceso no oficial y puede crear tickets; descartado por la restricción del usuario.
- **Cola de reporte o borrador persistente:** promete una escritura que no existe.
- **Descarga remota de anexos:** mismo riesgo y sin formato confirmado.

## Consecuencias

- La copia local solo se actualiza cuando una persona importa un archivo; no hay sincronización automática.
- Un ticket que desaparece del CSV permanece en la copia local.
- El estado del ticket lo manda la exportación; QABase no lo cambia.
- Los anexos quedan pendientes hasta que se confirme un formato que los incluya.
- La interfaz debe decir explícitamente que el módulo es de solo lectura y que no crea tickets.

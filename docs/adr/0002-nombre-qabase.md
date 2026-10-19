# ADR 0002 — Nombre QABase y ruta de la base

- **Estado:** aceptado
- **Fecha:** 2026-10-18
- **Actualiza:** la nota de nombre y `BD-03` del documento de negocio

## Contexto

El documento original usaba **InternalQA** para el repositorio y **MeritosQA** para la interfaz, y dejaba la diferencia como decisión de marca. La base por defecto era `data/meritosqa.sqlite`.

## Decisión

- El producto se llama **QABase** en el repositorio, la documentación y la interfaz.
- Los paquetes son `@qabase/web`, `@qabase/api` y `@qabase/shared`.
- La base local vive en `data/qabase.sqlite` (`DATABASE_PATH` puede sustituirla).
- El documento de reglas se movió a `docs/product/qabase-reglas-de-negocio.md` y sus menciones de nombre se actualizaron.

## Consecuencias

- `BD-03` ya indica `data/qabase.sqlite`; no queda una regla obsoleta en el documento.
- No hay migración de datos porque el proyecto arranca vacío.
- El título de la pestaña, la cabecera y los textos visibles usan QABase.

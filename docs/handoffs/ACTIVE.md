# Handoff activo — QABase

Actualizado: 2026-10-20 18:13 UTC

## Objetivo

Mantener QABase como panel local del equipo de QA y dejar listo el siguiente
módulo o ajuste que se decida.

## Estado

- Rama `main`, commit `4498ff4`, sincronizada con `origin/main`.
- Working tree limpio al crear este archivo.
- Módulo **Proxies** completo: migración, API, permisos, auditoría, UI y tests.
- `npm run verify` en verde: 45 archivos, 340 tests, typecheck, lint y build.
- Base local migrada (`009-proxies.sql`); sin IP global ni proxies cargados.
- Servidor activo en `127.0.0.1:3000`; `/api/health` responde `200`.

## Decisiones vigentes

- Spec: `docs/specs/010-proxies.md`.
- ADR: `docs/adr/0012-modulo-proxies.md`.
- Contrato compartido: `packages/shared/src/proxies.ts`.
- Estrategia multiagente: `AGENTS.md`.
- Un proxy por acceso; puerto y detalle únicos; sin borrado físico.
- IP global IPv4 única, editable solo por Administrador.
- No hay historial visible; sí auditoría interna.
- Los cambios de API/UI se prueban con el gate completo.
- El handoff vivo `docs/handoffs/ACTIVE.md` se actualiza en hitos definidos en
  `AGENTS.md`; se archiva al cerrar la tarea.

## Hecho

- Módulo Proxies en el grupo Principal.
- Listado, búsqueda, filtros, copia de endpoint, alta, edición y estado.
- Permisos `proxies.ver` y `proxies.gestionar`.
- Migración `migrations/009-proxies.sql`.
- Contrato compartido entre API y SPA.
- Revisión independiente de API y UI; hallazgos corregidos.
- Regla de handoff vivo por hitos y comando `/snapshot`.

## Pendiente

- Decidir el siguiente módulo o ajuste de QABase.
- Configurar la IP global y los proxies reales desde la UI.
- Validar el flujo con datos reales de la Mesa de Ayuda.
- No hay trabajo de código pendiente conocido en `main`.

## Archivos clave

- `AGENTS.md`
- `docs/specs/010-proxies.md`
- `docs/adr/0012-modulo-proxies.md`
- `migrations/009-proxies.sql`
- `apps/api/src/modules/proxies/`
- `apps/api/src/routes/proxies.ts`
- `apps/web/src/features/proxies/`
- `apps/web/src/pages/ProxiesPage.tsx`
- `packages/shared/src/proxies.ts`

## Verificación

```text
npm run verify
Test Files  45 passed (45)
Tests       340 passed (340)
```

```text
npm run db:migrate
Migraciones aplicadas: 1.
```

```text
GET /api/health -> 200 {"status":"ok"}
```

## Siguiente paso

Esperar la decisión del usuario sobre el próximo módulo o ajuste. Antes de
implementar: grilling si hay ambigüedad, spec en `docs/specs/`, TDD por seams y
contrato compartido si cruza API/UI.

## Skills sugeridas

`grilling`/`grill-me` si hay ambigüedad, `tdd` para implementar,
`web-design-guidelines` y `vercel-react-best-practices` para UI, `code-review`
antes de cerrar y `handoff` al terminar.

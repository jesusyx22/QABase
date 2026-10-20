# Handoff activo — QABase

Actualizado: 2026-10-20 21:20 UTC

## Objetivo

Mantener QABase como panel local del equipo de QA, dejar el entorno local
sincronizado con la base del VPS y preparar el siguiente módulo o ajuste.

## Estado

- Rama `main`; este relevo se sube a `origin/main`.
- Working tree limpio al iniciar la sesión; este relevo solo añade documentación.
- Módulo **Proxies** completo: migración, API, permisos, auditoría, UI y tests.
- Base local reemplazada por un snapshot consistente de la base del VPS
  (`integrity_check: ok`, migraciones `001`–`009`, 173 accesos y 21 QAs).
- Respaldo de la base local anterior en
  `data/qabase.local-backup-20261020-153614.sqlite` (ignorado por Git).
- `npm run verify` en Windows: typecheck, lint y build en verde; **338/340 tests**;
  dos fallos POSIX conocidos (ver Pendiente).
- Web y API activas en `localhost:5173` y `127.0.0.1:3000`; `/api/health` → 200.
- Las sesiones del VPS no se reutilizan: se conservó el `session-secret` local.

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
- La base local se reemplazó con la API detenida y un snapshot SQLite
  consistente; no se versionan credenciales ni datos de acceso.
- En Windows el gate no es equivalente al de Linux hasta resolver los dos tests
  con supuestos POSIX.

## Hecho

- Módulo Proxies en el grupo Principal.
- Listado, búsqueda, filtros, copia de endpoint, alta, edición y estado.
- Permisos `proxies.ver` y `proxies.gestionar`.
- Migración `migrations/009-proxies.sql`.
- Contrato compartido entre API y SPA.
- Revisión independiente de API y UI; hallazgos corregidos.
- Regla de handoff vivo por hitos y comando `/snapshot`.
- Importación de la base del VPS y respaldo de la base local anterior.
- Notas operativas en `AGENTS.md`: TTY del setup, snapshot SQLite, SSH sin clave
  y reescritura de `package-lock.json` por npm 11.

## Pendiente

- Hacer multiplataforma `apps/api/src/config.test.ts` (separador `/`) y
  `apps/api/src/core/security/security.test.ts` (modo `0600`) o ejecutar el gate
  en Linux.
- Rotar la credencial SSH usada en la sesión (se compartió fuera del repo).
- Decidir el siguiente módulo o ajuste de QABase.
- Configurar la IP global y los proxies reales desde la UI.
- Validar el flujo con datos reales de la Mesa de Ayuda.

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
- `apps/api/src/config.test.ts` (pendiente multiplataforma)
- `apps/api/src/core/security/security.test.ts` (pendiente multiplataforma)

## Verificación

Linux/VPS (evidencia previa):

```text
npm run verify
Test Files  45 passed (45)
Tests       340 passed (340)
```

Windows (esta sesión):

```text
npm run verify
Test Files  2 failed | 43 passed (45)
Tests       2 failed | 338 passed (340)
```

Fallos: `config.test.ts` espera separador `/` y `security.test.ts` espera modo
`0600`; Windows devuelve `\` y `0666`.

```text
GET /api/health -> 200 {"status":"ok"}
GET /api/session -> setupRequired: false
```

## Siguiente paso

1. Resolver los dos tests POSIX y volver a `npm run verify` en Windows.
2. Decidir el siguiente módulo o ajuste. Antes de implementar: grilling si hay
   ambigüedad, spec en `docs/specs/`, TDD por seams y contrato compartido si
   cruza API/UI.

## Skills sugeridas

`grilling`/`grill-me` si hay ambigüedad, `tdd` para implementar,
`web-design-guidelines` y `vercel-react-best-practices` para UI, `code-review`
antes de cerrar y `handoff` al terminar.

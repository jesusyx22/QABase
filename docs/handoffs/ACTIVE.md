# Handoff activo — QABase

Actualizado: 2026-10-20 22:08 UTC

## Objetivo

Convertir Proxies en un módulo de servicios operables: catálogo con rutas y
puertos, monitoreo, arranque/parada manual y logs, sin arranque automático.

## Estado

- Rama **`feat/proxies-servicios`**, publicada en `origin`; el trabajo de esta
  sesión está commiteado y pusheado.
- `npm run verify` en verde en Windows: 45 archivos, **338 tests**, typecheck,
  lint y build.
- Migración `010-proxy-services` aplicada en la base local.
- Catálogo sincronizado desde `scripts/proxies/`: GitLab, Mantis BT y Proxy
  Sentinel, con 4 rutas y 4 puertos.
- Estado real verificado: los tres aparecen **Activo**; Sentinel con health UP.
  **Mantis ya está gestionado por QABase** (`managed=true`, PID 46116); GitLab y
  Sentinel siguen como procesos externos.
- Los proxies usan `.cjs`: el `package.json` raíz es `"type": "module"` y los
  `.js` con `require` fallaban como ESM. El antiguo `runner.js` externo de
  Mantis se retiró para que no reinicie el proceso a espaldas de QABase.
- UI Proxies: catálogo, filtros, estado, iniciar/detener/reiniciar con
  confirmación, detalle y últimas 100 líneas de log. Auto-refresh cada 10 s.
- Permisos: `proxies.ver` para los tres roles, `proxies.operar` para
  Administrador y Editor, `proxies.gestionar` solo Administrador.
- Logs en `data/logs/<slug>.log`; procesos detached con PID y reconciliación.
- Sentinel se reimplementó con `http` nativo; GitLab y Mantis se copiaron sin
  dependencias externas.

## Decisiones vigentes

- Spec: `docs/specs/011-proxies-servicios.md`.
- ADR: `docs/adr/0013-operacion-proxies.md` (reemplaza parcialmente al 0012).
- Contrato compartido: `packages/shared/src/proxies.ts`.
- Un servicio tiene varias rutas y puertos; el vínculo a `accesses` es opcional.
- El catálogo se define por carpetas `scripts/proxies/<slug>/service.json`; la
  UI no ejecuta comandos configurables.
- QABase lanza `node <entry>` detached; no hay servicio ni tarea de Windows.
- No hay arranque automático; toda operación es manual y auditada.
- Un puerto ocupado por otro proceso es conflicto y nunca se mata.
- Revisión de Codex y Agy: se corrigieron spawn asíncrono, concurrencia por
  servicio, parada durante arranque, lectura de logs, identidad de proceso,
  catálogo y los cuatro P2 de UI.

## Hecho

- Migración `010-proxy-services.sql` con servicios, puertos, rutas y runtime.
- Sincronización idempotente del catálogo y resolución de accesos de firewall.
- Inspección de estado por proceso + puerto + health opcional.
- Rutas `GET /api/proxies`, `PATCH /api/proxies/settings`,
  `POST /api/proxies/:id/{start,stop,restart}` y `GET /api/proxies/:id/logs`.
- Auditoría de inicio, parada, reinicio, fallos y cambio de IP global.
- UI y tests de página con estados, permisos y confirmaciones.
- Smoke real de arranque/parada con un proxy temporal en el puerto 3999.
- Prueba real de Mantis: detener el proceso externo, arrancarlo desde QABase,
  verificar `managed=true`, log limpio y respuestas 302/200.

## Pendiente

- Repetir con GitLab y Sentinel el mismo cambio a `managed=true`; hacerlo fuera
  de horario de uso. Mantis ya está gestionado.
- Validar la pantalla en navegador y el aviso de proceso externo.
- No volver a arrancar el antiguo `runner.js` de Mantis mientras QABase gestione
  el servicio.
- Decidir si se añade arranque automático en una rama posterior.

## Archivos clave

- `migrations/010-proxy-services.sql`
- `packages/shared/src/proxies.ts`
- `packages/shared/src/permissions.ts`
- `apps/api/src/modules/proxies/{catalog,process,control,repository,service}.ts`
- `apps/api/src/routes/proxies.ts`
- `apps/web/src/features/proxies/`
- `apps/web/src/pages/ProxiesPage.tsx`
- `scripts/proxies/{sentinel,gitlab,mantis}/`
- `docs/specs/011-proxies-servicios.md`
- `docs/adr/0013-operacion-proxies.md`

## Verificación

```text
npm run verify
Test Files  45 passed (45)
Tests       338 passed (338)
typecheck, lint y build en verde
```

```text
GET /api/health -> 200 {"status":"ok"}
```

Estado real de los tres servicios: `active`; Sentinel `health=up`;
GitLab/Mantis/Sentinel `managed=false` hasta reiniciarlos desde QABase.

## Siguiente paso

Revisar el diff completo con un agente distinto al implementador, probar la UI
en navegador y, con autorización, commitear la rama. Después, coordinar una
ventana para reiniciar los proxies desde QABase y confirmar `managed=true`.

## Skills sugeridas

`code-review` para el cierre, `web-design-guidelines` para la revisión visual y
`handoff` al terminar.

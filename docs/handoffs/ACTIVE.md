# Handoff activo — QABase

Actualizado: 2026-10-28 15:04 UTC

## Objetivo

Publicar JaegerPayment2 por reverse proxy HTTP y conservar los proxies TCP de
MongoDB y DocumentDB con allowlist identificada por responsable.

## Estado

- Rama **`feat/proxy-jaeger-payment2`**, creada desde `main` (`e7503d5`).
- `npm run verify` en verde en Windows: 45 archivos, **350 tests**, typecheck,
  lint y build.
- Migraciones `011-proxies-tcp` y `012-allowlist-labels` aplicadas:
  `protocol` y allowlist con `cidr + label`. Las entradas existentes quedaron
  con `label = 'Admin'`.
- Servicio **`mongodb-qa`** activo y gestionado por QABase (`managed=true`,
  PID 50196), escuchando solo en `10.4.24.18:27017` hacia
  `10.5.83.84:27017`.
- Servicio **`documentdb-qa`** activo y gestionado (`managed=true`, PID 66344),
  escuchando en `10.4.24.18:27018` hacia el cluster DocumentDB QA con TLS.
- Allowlist inicial de ambos: **`10.4.24.18/32`**, etiqueta `Admin`; DocumentDB
  tiene además `10.4.24.24/32`. Los archivos
  `data/proxies/<slug>.allowlist.json` solo contienen CIDR y se actualizan en vivo.
- UI: allowlist por filas `IP/CIDR + Nombre`, primera columna de numeración `#`
  y Detener/Reiniciar con el mismo ancho (rojo/azul primario).
- Prueba real: handshake TLS 1.3 contra MongoDB y DocumentDB a través de los
  proxies; allowlist vacía devuelve `ECONNRESET`; al restaurar `10.4.24.18`
  vuelve el handshake.
- GitLab, Mantis y Sentinel siguen activos y enlazados a `10.4.24.18`.
- Servicio **`jaeger-payment2`** nuevo: reverse proxy HTTP de
  `http://10.5.83.150:16686` publicado en `10.4.24.18:16687`, sin allowlist.
  Manifiesto en `scripts/proxies/jaeger-payment2/`. Todavía no está sincronizado
  en SQLite: falta reiniciar la API y arrancarlo desde la UI.
- El 16686 local está ocupado por un Jaeger en Docker (Docker Desktop y
  `wslrelay`); por eso el proxy usa 16687.

## Decisiones

- Spec: `docs/specs/012-proxies-tcp.md`.
- ADR: `docs/adr/0014-proxy-tcp.md`.
- MongoDB es TCP: no se usa un reverse proxy HTTP.
- El proxy es transparente; no termina TLS ni autentica.
- Allowlist por servicio en SQLite, IPv4/CIDR, editable solo por Administrador;
  vacía = denegar todo.
- El proxy lee la allowlist por conexión desde `data/proxies/<slug>.allowlist.json`.
- No se guardan URI, usuario, contraseña ni base de datos en QABase.
- TCP plano en la Ethernet interna; si se requiere cifrado, el cliente usa TLS.
- Sin IPv6 ni hostnames en la allowlist; QABase no administra usuarios Mongo.
- DocumentDB se conecta en modo `directConnection=true`, sin `replicaSet` ni
  `readPreference`, porque el proxy TCP no sigue la topología descubierta.

## Hecho

- Protocolo `tcp` en manifiestos, contratos y modelo de servicios.
- Migración `011` y tabla `proxy_allowlist`.
- Validación/normalización de IPv4 y CIDR; máximo 100 entradas.
- API `PATCH /api/proxies/:id/allowlist` con `{ cidr, label }`, auditoría
  `proxy.allowlist_updated` y rechazo de CIDR duplicados o nombre vacío.
- Migración `012` con `label`; entradas existentes migradas como `Admin`.
- Proxy TCP `scripts/proxies/mongodb-qa/proxy.cjs` con allowlist y logs.
- Proxy TCP `scripts/proxies/documentdb-qa/proxy.cjs` con TLS de extremo a
  extremo y allowlist.
- QABase escribe la allowlist antes de arrancar y al editarla; al proxy solo
  llegan los CIDR.
- UI: distintivo TCP/HTTP, allowlist por filas `IP/CIDR + Nombre`, numeración
  de filas visibles, Detener/Reiniciar con igual ancho y colores semánticos.
- Pruebas de API, rutas, UI y smoke real de TLS/allowlist.
- Integración en `main`; gate completo en verde.
- Revisión de Codex aplicada: la allowlist se escribe con temporal + rename
  atómico para no truncar el archivo mientras el proxy lo lee.

## Pendiente

- Reiniciar la API para que `syncProxyCatalog` cargue `jaeger-payment2` y
  arrancarlo desde la UI; comprobar `http://10.4.24.18:16687/` desde otra PC.
- Probar MongoDB y DocumentDB con Compass desde `10.4.24.18` usando un usuario
  de solo lectura.
- Asignar el nombre del responsable a cada IP; `10.4.24.24` quedó como `Admin`
  y puede renombrarse, por ejemplo, a `David`.
- Ampliar la allowlist desde la UI con las IPs reales del equipo QA.
- Rotar las credenciales de administrador que se compartieron fuera del repo.
- DocumentDB: usar `tls=true`, `tlsCAFile=global-bundle.pem`,
  `tlsAllowInvalidHostnames=true`, `directConnection=true` y `retryWrites=false`.
- No volver a arrancar el antiguo `runner.js` de Mantis mientras QABase gestione
  el servicio.

## Archivos clave

- `migrations/011-proxies-tcp.sql`
- `migrations/012-allowlist-labels.sql`
- `packages/shared/src/proxies.ts`
- `apps/api/src/modules/proxies/{catalog,repository,service,validation,control}.ts`
- `apps/api/src/routes/proxies.ts`
- `apps/web/src/features/proxies/`
- `apps/web/src/features/proxies/ProxyAllowlistDialog.tsx`
- `apps/web/src/pages/ProxiesPage.tsx`
- `scripts/proxies/mongodb-qa/{service.json,proxy.cjs}`
- `scripts/proxies/documentdb-qa/{service.json,proxy.cjs}`
- `scripts/proxies/jaeger-payment2/{service.json,proxy.cjs}`
- `docs/specs/012-proxies-tcp.md`
- `docs/adr/0014-proxy-tcp.md`

## Verificación

```text
npm run verify
Test Files  45 passed (45)
Tests       350 passed (350)
typecheck, lint y build en verde
```

```text
GET /api/health -> 200 {"status":"ok"}
```

Prueba real de `mongodb-qa` y `documentdb-qa`:

```text
listen 10.4.24.18:27017 -> 10.5.83.84:27017
listen 10.4.24.18:27018 -> DocumentDB QA:27017
TLS_OK TLSv1.3 (allowlist 10.4.24.18/32)
ECONNRESET (allowlist vacía)
```

Smoke del proxy nuevo, enlazado a loopback y detenido después:

```text
GET / -> 200 (5975 bytes, text/html)
GET /api/services -> 200 {"data":["jaeger","payment-management-b"],"total":2}
```

## Siguiente paso

Reiniciar la API, arrancar `JaegerPayment2` desde Proxies y abrir
`http://10.4.24.18:16687/` desde otra máquina. Después, validar Compass con el
usuario read-only y ampliar la allowlist del equipo.

## Skills sugeridas

`code-review` para el cierre, `web-design-guidelines` para la revisión visual y
`handoff` al terminar.

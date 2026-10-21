# 012 — Proxies TCP y allowlist por servicio

- **Estado:** aprobada
- **Fecha:** 2026-10-20
- **Rama:** `feat/proxies-tcp`
- **Depende de:** `docs/specs/011-proxies-servicios.md`

## Problema

El módulo de proxies solo entiende HTTP. Se necesita publicar un acceso
MongoDB (`10.5.83.84:27017`) a través de `10.4.24.18:27017`, con una allowlist
de IPs de origen y sin guardar credenciales en QABase.

## Alcance

### Dentro

- Protocolo `tcp` para servicios de proxy, además de `http`.
- Proxy TCP transparente para MongoDB.
- Allowlist por servicio, editable desde el detalle, solo Administrador.
- IPv4 individual y CIDR; vacía = ninguna conexión aceptada.
- Aplicación en vivo: QABase escribe un archivo local y el proxy lo lee por
  conexión, sin reiniciar.
- Servicio `mongodb-qa`: `10.4.24.18:27017` → `10.5.83.84:27017`, QA.
- Servicio `documentdb-qa`: `10.4.24.18:27018` → DocumentDB QA en
  `intqa-intinfra-primary-cluster...:27017`, con TLS de extremo a extremo.

### Fuera

- TLS terminado en QABase.
- Guardar usuario, contraseña, URI o base de datos en QABase.
- Crear o administrar usuarios de MongoDB.
- IPv6 y hostnames en la allowlist.
- Varios servidores MongoDB en este corte.
- Autenticación propia del proxy.

## Datos

Migración `011-proxies-tcp.sql`.

- `proxy_services.protocol TEXT NOT NULL DEFAULT 'http'` con
  `CHECK (protocol IN ('http','tcp'))`.
- `proxy_allowlist`:

```text
id INTEGER PRIMARY KEY
service_id INTEGER NOT NULL REFERENCES proxy_services(id) ON DELETE CASCADE
cidr TEXT NOT NULL
label TEXT NOT NULL
UNIQUE (service_id, cidr)
```

- La allowlist no se borra al sincronizar el manifiesto.
- `cidr` se normaliza a IPv4/CIDR; una IP simple se guarda como `/32`.
- `label` es obligatorio, máximo 80 caracteres y puede repetirse entre IPs.
  Identifica a quién se autoriza; no se envía al proxy.
- Las entradas existentes se migran con `label = 'Admin'`.

## Manifiesto y proxy

`scripts/proxies/mongodb-qa/service.json` declara:

```json
{
  "name": "MongoDB QA",
  "environment": "qa",
  "protocol": "tcp",
  "entry": "proxy.cjs",
  "ports": [27017],
  "primaryPort": 27017,
  "healthPath": null,
  "routes": [
    { "path": "/", "target": "tcp://10.5.83.84:27017", "detail": "MongoDB QA" }
  ]
}
```

- `protocol` es opcional en manifiestos antiguos y vale `http` por defecto.
- Para TCP, `target` debe ser `tcp://host:puerto`.
- El proxy TCP escucha en `BIND_HOST` y reenvía bytes al target.
- DocumentDB exige TLS. El cliente usa `tls=true`, `tlsCAFile`,
  `tlsAllowInvalidHostnames=true` y `directConnection=true`; sin `replicaSet` ni
  `readPreference`, porque un TCP transparente no sigue la topología descubierta.
- La allowlist se escribe en `data/proxies/<slug>.allowlist.json`; el proxy la
  lee en cada conexión. Si falta o está vacía, deniega.
- Las conexiones denegadas se registran en el log con IP de origen; no se
  guardan credenciales.

## API y permisos

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| PATCH | `/api/proxies/:id/allowlist` | `proxies.gestionar` | Reemplazar allowlist |

- `GET /api/proxies` incluye `protocol` y `allowlist` por servicio.
- `PATCH` recibe `{ entries: [{ cidr, label }] }`; valida IPv4/CIDR, nombre
  obligatorio y máximo 100 entradas. Rechaza CIDR duplicados.
- Solo se permite editar la allowlist de servicios `tcp`.
- Auditoría: `proxy.allowlist_updated` con antes/después.
- `proxies.ver` consulta; `proxies.operar` opera; `proxies.gestionar` edita.

## UI

- El listado muestra un distintivo `TCP` o `HTTP`.
- El detalle de un servicio TCP muestra:
  - endpoint `IP:puerto`;
  - destino `tcp://host:puerto`;
  - allowlist como `Nombre — CIDR`, o aviso “Sin IPs autorizadas: no se
    aceptarán conexiones”;
  - botón **Editar allowlist** solo para Administrador.
- El editor es por filas: IP/CIDR + Nombre obligatorio, agregar y quitar.
  Permite guardar la lista vacía con el aviso correspondiente.
- Los servicios HTTP no muestran allowlist.
- La tabla de Proxies numera las filas visibles desde 1; la numeración se
  reinicia al buscar o filtrar.
- Detener y Reiniciar comparten ancho fijo: Detener en rojo `--danger`,
  Reiniciar en azul primario.

## Criterios de aceptación

1. `mongodb-qa` aparece como TCP, QA, puerto 27017, destino `10.5.83.84:27017`.
2. La allowlist inicial es `10.4.24.18/32` y el servicio inicia.
3. Una conexión desde `10.4.24.18` atraviesa el proxy y completa el handshake
   TLS de MongoDB.
4. Una IP fuera de la allowlist es rechazada antes de hablar con Mongo.
5. Editar la allowlist aplica sin reiniciar el proxy y queda auditado.
6. Vaciar la allowlist bloquea todas las conexiones.
7. No hay credenciales en base, archivos, logs ni auditoría.
8. `documentdb-qa` completa el handshake TLS a través del proxy y respeta la
   allowlist.
9. Cada entrada de allowlist muestra su nombre; nombre vacío o CIDR duplicado
   se rechazan.
10. La lista de proxies numera las filas visibles y los botones Detener y
    Reiniciar tienen el mismo ancho y los colores definidos.
11. `npm run verify` queda en verde.

## Archivos previstos

```text
migrations/011-proxies-tcp.sql
migrations/012-allowlist-labels.sql
packages/shared/src/proxies.ts
apps/api/src/modules/proxies/{catalog,repository,service,validation,control}.ts
apps/api/src/routes/proxies.ts
apps/web/src/features/proxies/*
apps/web/src/pages/ProxiesPage.tsx
scripts/proxies/mongodb-qa/{service.json,proxy.cjs}
docs/adr/0014-proxy-tcp.md
```

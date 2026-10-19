# 009 — Importación de destinos de firewall y modelo extendido

- **Estado:** aprobada
- **Fecha:** 2026-10-19
- **Rama:** `feat/accesos`
- **Depende de:** `docs/specs/007-accesos.md`, `docs/specs/008-asignaciones-accesos.md`
- **Origen:** `Destinos_Firewall.md` (181 filas consolidadas, 57 destinos únicos)

## Problema

El inventario real de firewall contiene IP, rangos de red, dominios, dominios
comodín, rangos de puertos, puertos `default`, aplicaciones y URLs. El catálogo
actual solo admite una dirección, un puerto entero, un ambiente de tres valores
y un detalle de 200 caracteres. No se puede importar sin perder información o
rechazar filas.

## Decisiones de producto

1. Se añade el ambiente **`unspecified`** (“Sin clasificar”) para los registros
   que no declaran ambiente. La importación usará ese valor.
2. El acceso admite un rango de puertos: `port` es el inicio y `portEnd` el
   fin. Un puerto simple usa `portEnd = port`.
3. Se añaden los campos opcionales **`applications`** (máx. 500) y **`urls`**
   (máx. 4,000).
4. La descripción del inventario se guarda en **`detail`**.
5. Se admiten dominios comodín con la forma `*.ejemplo.com`.
6. Los duplicados del mismo destino + rango de puertos + ambiente con TCP y UDP
   se consolidan en **`protocol = 'both'`**.
7. La importación es **solo al catálogo**; no crea asignaciones QA.
8. El catálogo no se pagina en este corte, aunque supere las 100 filas.
9. El archivo fuente se mueve a `data/imports/` (ignorado por Git) y no se
   versiona.

## Modelo de datos

Migración `migrations/008-access-inventory.sql`.

```text
accesses
├── id
├── address
├── address_normalized
├── port          INTEGER 1..65535 (inicio)
├── port_end      INTEGER 1..65535 (fin, >= port)
├── environment   development|qa|production|unspecified
├── protocol      tcp|udp|both|NULL
├── detail        TEXT NULL, 1..200
├── applications  TEXT NULL, 1..500
├── urls          TEXT NULL, 1..4000
├── is_active
├── version
├── created_at
└── updated_at
```

- Clave única: `(address_normalized, port, port_end, environment)`.
- Los registros existentes se migran con `port_end = port`.
- `access_assignments` se conserva y sigue apuntando a los mismos IDs.
- La migración reconstruye `accesses` y `access_assignments` para actualizar el
  `CHECK` de ambiente y preservar las claves foráneas.

## Validación

- `port`: entero 1–65535.
- `portEnd`: entero 1–65535, mayor o igual que `port`; si se omite, toma `port`.
- `applications`: opcional, se recorta, máximo 500.
- `urls`: opcional, se recorta, máximo 4,000.
- Dominio: dominio normal o comodín `*.dominio.com`; el comodín solo se admite
  como primera etiqueta.
- Ambiente: `development`, `qa`, `production` o `unspecified`.
- Un cambio de rango o ambiente debe respetar la clave única y la versión.

## API

Se amplían los contratos existentes:

```ts
type Access = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: 'development' | 'qa' | 'production' | 'unspecified'
  protocol: 'tcp' | 'udp' | 'both' | null
  detail: string | null
  applications: string | null
  urls: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}
```

- `GET /api/accesses?q=&environment=&status=&protocol=` busca también en
  `applications` y `urls`.
- `POST` y `PATCH` aceptan `portEnd`, `applications`, `urls` y
  `environment='unspecified'`.
- Las asignaciones incluyen `access.portEnd` y muestran `puerto–puertoFin`.
- El historial muestra los nuevos campos en antes/después.

## Importación

Script único: `scripts/import-firewall-destinations.ts`.

Reglas:

1. Lee el Markdown y extrae la tabla consolidada.
2. Todas las filas se importan con `environment = 'unspecified'`.
3. `Puerto`:
   - entero → `port` y `portEnd` iguales;
   - rango `A-B` → `port=A`, `portEnd=B`;
   - `default`:
     - `10.5.81.18` con URL https → puerto 443;
     - `10.5.83.90` y `10.5.83.91` se omiten y se reportan.
4. `INTERNET (sin IP)`:
   - `*.smartbear.com` → dominio comodín;
   - `services.formiik.com` → dominio;
   - se conserva el puerto de cada fila.
5. `Aplicaciones` → `applications`.
6. `URLs / rutas` → `urls`, reemplazando `<br>` por saltos de línea.
7. `Descripción` → `detail`.
8. Si dos filas comparten dirección + rango + ambiente y una es TCP y otra UDP,
   se crea/actualiza una sola fila con `protocol='both'`, combinando
   aplicaciones, URLs y descripción.
9. Si el acceso ya existe (misma clave), se omite y se reporta; el script es
   idempotente.
10. Cada alta usa el servicio de accesos para validar y auditar.
11. El script imprime un resumen: importados, fusionados, omitidos y motivos.

## UI

- Filtro de ambiente incluye **Sin clasificar**.
- Formulario de acceso:
  - Puerto inicio y puerto fin (fin opcional; si está vacío, igual al inicio).
  - Aplicaciones.
  - URLs / rutas.
- Listado: columna de puerto muestra `443` o `3000–3099`.
- Detalle: muestra rango, ambiente, aplicaciones y URLs con saltos de línea.
- Historial: incluye los campos nuevos.
- Asignaciones: muestran el rango de puertos del acceso.
- Sin paginación en este corte.

## Criterios de aceptación

1. Un acceso simple conserva `portEnd = port`.
2. Un rango `3000-3099` se guarda como `port=3000`, `portEnd=3099` y se muestra
   como `3000–3099`.
3. `portEnd < port` se rechaza.
4. El ambiente `unspecified` se guarda y se muestra como “Sin clasificar”.
5. `*.smartbear.com` se acepta; `foo.*.com` se rechaza.
6. Se pueden guardar y mostrar aplicaciones y URLs.
7. La búsqueda encuentra por aplicación y URL.
8. Los duplicados TCP/UDP se consolidan en `both`.
9. La importación crea solo accesos, sin asignaciones.
10. Las filas `default` no resolubles se omiten con reporte.
11. La importación es idempotente.
12. `npm run verify` queda en verde.

## Archivos

```text
migrations/008-access-inventory.sql
scripts/import-firewall-destinations.ts
apps/api/src/modules/accesses/{validation,repository,service}.ts
apps/api/src/routes/accesses.ts
apps/api/src/modules/access-assignments/{repository,service}.ts
apps/web/src/features/accesses/{api,labels,AccessFormDialog,AccessDetailDialog,AccessHistoryDialog,AccessStatusDialog}.tsx/ts
apps/web/src/features/access-assignments/*
apps/web/src/pages/AccessesPage.tsx
apps/web/src/pages/AccessesQaDetailPage.tsx
docs/specs/007-accesos.md
DESIGN.md
docs/adr/0011-modelo-accesos-extendido.md
```

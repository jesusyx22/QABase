# ADR 0011 — Modelo extendido de accesos para el inventario de firewall

- **Estado:** aceptado
- **Fecha:** 2026-10-19
- **Spec:** `docs/specs/009-importacion-destinos-firewall.md`

## Contexto

El inventario real `Destinos_Firewall.md` contiene 181 filas consolidadas con
IP, CIDR, dominios, dominios comodín, rangos de puertos, puertos `default`,
aplicaciones, URLs y descripciones. No declara ambiente.

El modelo anterior exigía un puerto único y un ambiente entre Desarrollo, QA y
Producción, y no tenía campos para aplicaciones ni URLs.

## Decisión

1. Se añade el ambiente **`unspecified`** (“Sin clasificar”).
2. El puerto se modela como rango: `port` (inicio) y `portEnd` (fin). Un puerto
   simple usa `portEnd = port`.
3. Se añaden `applications` y `urls` como texto opcional.
4. `detail` conserva la descripción corta.
5. Se admiten dominios comodín `*.dominio.com`.
6. La clave única pasa a `(address_normalized, port, port_end, environment)`.
7. Los TCP/UDP del mismo destino y rango se consolidan en `protocol='both'`.
8. La importación es solo al catálogo, idempotente y ejecutada por un script
   único.

## Alternativas descartadas

- **Expandir rangos en cientos de puertos:** genera ruido y colisiones con los
  puertos exactos.
- **Guardar el rango en `detail`:** la base no podría validar ni buscar por
  puerto.
- **Usar un ambiente inventado (QA):** oculta que el origen no lo declara.
- **Crear una tabla auxiliar solo para la importación:** el catálogo seguiría
  sin representar los datos reales.
- **Guardar URLs en `detail`:** supera los 200 caracteres y mezcla descripción
  con rutas.
- **Versionar el archivo fuente:** expone direcciones reales en Git.

## Consecuencias

- La migración 008 reconstruye `accesses` y `access_assignments` conservando IDs.
- El formulario, el detalle, el historial, las asignaciones y la búsqueda deben
  entender el nuevo ambiente, el rango y los campos adicionales.
- La tabla del catálogo puede superar 100 filas; se acepta sin paginación en
  este corte.
- El script reporta filas omitidas y duplicados fusionados.
- `Destinos_Firewall.md` se mueve a `data/imports/`, que está ignorado por Git.

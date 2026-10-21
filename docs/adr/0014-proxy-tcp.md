# ADR 0014 — Proxy TCP transparente con allowlist

- **Estado:** aceptado
- **Fecha:** 2026-10-20
- **Spec:** `docs/specs/012-proxies-tcp.md`
- **Relacionado:** ADR 0013

## Contexto

El módulo de proxies nació para HTTP. MongoDB usa un protocolo binario sobre
TCP y no puede publicarse con un reverse proxy HTTP. Se necesita un túnel TCP
transparente, con control de IPs de origen y sin almacenar credenciales.

## Decisión

1. Se añade `protocol` (`http`/`tcp`) a los servicios de proxy.
2. El proxy TCP es transparente: reenvía bytes, no termina TLS ni autentica.
3. La allowlist es por servicio, se guarda en SQLite y solo la edita
   Administrador.
4. La allowlist se escribe en un archivo local que el proxy lee por conexión;
   así los cambios aplican sin reiniciar.
5. Vacía significa denegar todo. Se admiten IPv4 y CIDR; no hostnames ni IPv6.
6. No se guardan URI, usuario, contraseña ni base de datos en QABase.
7. El primer servicio es `mongodb-qa` en `10.4.24.18:27017` hacia
   `10.5.83.84:27017`, QA, con allowlist inicial `10.4.24.18/32`.

## Alternativas descartadas

- **Proxy HTTP:** no entiende el protocolo de MongoDB.
- **Terminar TLS en QABase:** añade certificados y descifrado; el túnel
  transparente conserva el cifrado de extremo a extremo si el cliente lo usa.
- **Guardar credenciales:** incumple la regla de no persistir secretos.
- **Allowlist global:** mezcla accesos y no permite reglas por servicio.
- **Hostnames:** un DNS dinámico puede abrir el acceso sin control.
- **Reiniciar al cambiar la allowlist:** interrumpe conexiones y complica la
  operación.

## Consecuencias

- El tráfico del túnel no se cifra por sí mismo; si se necesita cifrado, el
  cliente debe usar TLS contra MongoDB.
- MongoDB ve la IP de QABase, no la IP original del cliente; la allowlist se
  evalúa en el proxy.
- Un cliente detrás de NAT se identifica por la IP del NAT.
- La allowlist vacía deja el servicio inoperante hasta configurarlo.
- El servicio TCP se opera con el mismo start/stop/restart y logs que los HTTP.

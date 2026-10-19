# ADR 0003 — Núcleo de identidad

- **Estado:** aceptado
- **Fecha:** 2026-10-18
- **Contexto:** sección 8 del documento de negocio y ronda de grill del 2026-10-18
- **Spec:** `docs/specs/001-nucleo-identidad.md`

## Contexto

La sección 8 ya fija las reglas de cuentas, contraseñas, sesiones, roles, permisos, bloqueo de intentos, arranque local y recuperación. Quedaban abiertas las decisiones de implementación y una inconsistencia de producto (`RN-ID-13`).

## Decisiones

1. **Dos cortes.** La spec 001 implementa el núcleo (esquema, setup, login/logout, sesión, permisos, auditoría, cambio de contraseña propio y reinicio local de admin). La spec 002 implementa Usuarios y Roles con sus historiales.
2. **Arranque por CLI.** `npm run setup` es el único canal para crear la primera cuenta administradora. No hay ruta HTTP de onboarding. Si no hay administrador activo, el login lo indica.
3. **Argon2id con `@node-rs/argon2`.** Binarios prebuilt, sin node-gyp. Parámetros OWASP: memoria 19 456 KiB, 2 iteraciones, paralelismo 1.
4. **Claves de permisos en español.** `registros.ver`, `registros.crear`, `registros.editar`, `registros.anular`, `registros.historial`, `personal.gestionar`, `usuarios.gestionar`, `roles.gestionar`, `mesa.ver`, `mesa.crear`. Son las mismas en servidor, contratos y espejo de interfaz.
5. **Asignación del rol protegido.** `usuarios.gestionar` permite asignar cualquier rol salvo Administrador. Conceder Administrador exige además `roles.gestionar`. Actualiza `RN-ID-13`.
6. **Seeds por módulo.** El setup ejecuta migraciones y seeds insert-only. Roles y permisos pertenecen a identidad; los 21 QAs y los 10 niveles llegarán con sus módulos. El estado final es el de `RN-ID-71`.
7. **Secreto de sesión.** `SESSION_SECRET` tiene prioridad. Si falta, se lee `data/session-secret` (0600), generado por `npm run setup`. Si no existe o es corto, el arranque aborta con un mensaje que indica ejecutar el setup.
8. **CSRF con token sincronizador.** Token por sesión, guardado en la fila de sesión, devuelto por `GET /api/session` y exigido en `X-CSRF-Token` para mutaciones autenticadas. Se suma a `SameSite=Strict`, validación de `Origin` y de dirección loopback.
9. **Sesiones opacas firmadas.** El identificador vive en base; la cookie lleva `sid.hmac` con el secreto, para detectar manipulación antes de consultar. La sesión anónima existe antes del login (`BD-31`); el login rota el identificador (`BE-13`).
10. **Bloqueo en memoria.** Cinco fallos por usuario normalizado en quince minutos, sin persistencia; se reinicia con el proceso (`BE-20`, `BE-21`).

## Alternativas descartadas

- **Onboarding web:** expone una ruta sin sesión que crea un administrador; el CLI no añade superficie.
- **`argon2` de node-gyp:** no hay toolchain de compilación en el equipo.
- **`scrypt`:** no es Argon2id y contradice `BE-17`.
- **Solo `SameSite=Strict` + origen:** no cumple `BE-10`.
- **Sembrar QAs y niveles ahora:** obliga a adelantar tablas de dos módulos y mezcla propiedad de datos.
- **Generar el secreto en cada arranque:** rotaría las sesiones sin avisar y contradice `SEG-05`.

## Consecuencias

- El primer arranque exige `npm run setup`; sin él, el servidor no inicia por falta de secreto.
- La cookie no usa `Secure` porque el producto solo funciona en loopback por HTTP (`BE-16`); no debe reutilizarse en red.
- El token CSRF y el `Origin` se validan en cada mutación; el cliente HTTP de la SPA debe adjuntarlos.
- Las sesiones expiradas se eliminan al leerse; no hay proceso en segundo plano.
- El bloqueo de intentos se pierde al reiniciar (`RN-ID-35`).
- La asignación de Administrador requiere dos permisos y la interfaz debe ocultar esa opción a quien no pueda concederla.
- La integración de Mesa de Ayuda pasa a ser el ADR 0004.

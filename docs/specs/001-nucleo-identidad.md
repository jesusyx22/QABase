# 001 — Núcleo de identidad

- **Estado:** aprobada
- **Fecha:** 2026-10-18
- **ADR:** `docs/adr/0003-nucleo-identidad.md`
- **Fuente de negocio:** `docs/product/qabase-reglas-de-negocio.md`, sección 8

## Problema

QABase no tiene forma de saber quién usa el panel ni de autorizar acciones. Sin un núcleo de identidad no se puede construir Personal QA, Méritos ni Mesa de Ayuda sin inventar un actor temporal y sin violar `PERM-01`–`PERM-15`.

## Resultado esperado

Un administrador creado por un asistente local puede iniciar sesión, mantener una sesión de ocho horas, cambiar su propia contraseña y recuperar el acceso con un comando local. El servidor resuelve permisos en cada petición y deja rastro de las escrituras de identidad. La interfaz tiene login, panel mínimo y “Mi cuenta”.

## Alcance

### Dentro

- Migración y seeds de identidad (permisos, roles, concesiones iniciales).
- Asistente `npm run setup` para la primera cuenta administradora.
- Asistente `npm run reset-admin-password`.
- Login, logout, sesión anónima y sesión autenticada.
- Guardia de sesión y de permisos en el servidor.
- Token CSRF, validación de `Origin` y de dirección loopback.
- Cambio de contraseña propio.
- Auditoría de las escrituras de esta spec.
- Pantallas: login, panel mínimo y “Mi cuenta”.
- Contratos compartidos de sesión, permisos y validaciones.

### Fuera

- Pantalla Usuarios, creación/edición/desactivación de cuentas e historial visible: spec 002.
- Pantalla Roles, creación/renombrado/edición de permisos e historial visible: spec 002.
- Protección del último administrador activo y autodesactivación: spec 002.
- Personal QA, Méritos e Incidencias, Mesa de Ayuda.
- Recuperación de contraseña por la pantalla de login (`RN-ID-27`, `RN-ID-75`).
- Listado o cierre remoto de sesiones.
- Notificaciones, correo, segundo factor, red local o Internet.

## Modelo de datos

Migración `migrations/001-identidad.sql`. Marcas de tiempo en ISO-8601 UTC.

### `roles`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | INTEGER PK | Entero estable |
| `name` | TEXT NOT NULL | Único exacto; 1–100 tras recorte |
| `seed_key` | TEXT NULL UNIQUE | `admin`, `editor`, `consulta`; permite renombrar sin que el seed recree el rol |
| `is_protected` | INTEGER NOT NULL | `0/1`; índice único parcial garantiza un solo rol protegido |
| `version` | INTEGER NOT NULL | `>= 1` |
| `created_at`, `updated_at` | TEXT NOT NULL | UTC |

### `permissions`

`key TEXT PRIMARY KEY`, `description TEXT NOT NULL`. Catálogo de diez claves.

### `role_permissions`

`role_id` y `permission_key` con claves foráneas `RESTRICT`; PK compuesta. El rol protegido **no** guarda filas: sus permisos se resuelven como “todos los conocidos” (`PERM-04`, `RN-ID-64`).

### `accounts`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | INTEGER PK | |
| `username` | TEXT NOT NULL | 3–64, ASCII `[A-Za-z0-9._-]`, sin recorte |
| `username_normalized` | TEXT NOT NULL UNIQUE | `lower(username)`; CHECK de coherencia |
| `password_hash` | TEXT NOT NULL | PHC de Argon2id |
| `role_id` | INTEGER NOT NULL | FK `roles` `RESTRICT` |
| `is_active` | INTEGER NOT NULL | `0/1` |
| `version` | INTEGER NOT NULL | `>= 1` |
| `created_at`, `updated_at` | TEXT NOT NULL | UTC |

### `sessions`

`id TEXT PRIMARY KEY` (32 bytes base64url), `account_id INTEGER NULL` (FK `RESTRICT`), `csrf_token TEXT NOT NULL`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`. Índices por `account_id` y `expires_at` (`BD-51`). La fila anónima tiene `account_id` nulo (`BD-31`).

### `audit_events`

`id INTEGER PK`, `occurred_at`, `actor_account_id` (FK `RESTRICT`, nulo en canal local), `actor_username` (snapshot), `channel` (`app`/`local`), `module`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`. Índices por entidad/fecha y por fecha (`BD-50`). El repositorio solo inserta; no existen métodos de edición ni borrado.

## Seeds

Se ejecutan al arrancar y en los asistentes, después de las migraciones (`BD-19`, `BD-21`). Son insert-only:

- Permisos: inserta las claves que falten; no sobrescribe descripciones.
- Roles: inserta por `seed_key` si falta; no sobrescribe nombres.
- Concesiones: se insertan **solo cuando el rol se crea en esa ejecución**. Así, quitar un permiso desde la spec 002 no se deshace en el siguiente arranque.
- Administrador: sin filas de concesión.
- Editor y Consulta: matriz de la sección 8.7.

## Contrato HTTP

Prefijo `/api`. Todas las respuestas llevan `Cache-Control: no-store`. Los errores usan `ApiError` (`{ error: { code, message } }`).

### `GET /api/session`

Público. Si no hay cookie válida, crea una sesión anónima y la devuelve. Responde siempre `200`:

```ts
type SessionResponse =
  | {
      authenticated: false
      setupRequired: boolean
      csrfToken: string
    }
  | {
      authenticated: true
      csrfToken: string
      account: {
        id: number
        username: string
        role: { id: number; name: string }
        permissions: PermissionKey[]
      }
    }
```

`setupRequired` es `true` cuando no hay ninguna cuenta activa con el rol protegido. No permite crear nada: el setup es solo CLI.

### `POST /api/session`

Público. Cuerpo `{ "username": string, "password": string }` con lista blanca estricta. Responde `200` con `SessionResponse` autenticada y `Set-Cookie`.

- Credenciales incorrectas, usuario inexistente o cuenta inactiva: `401 unauthenticated`, mismo mensaje “Usuario o contraseña incorrectos.”
- Sexto intento en quince minutos: `429 too_many_requests`, sin evaluar la contraseña.
- Cuerpo inválido: `400 invalid_input`.
- `Origin`, si viene, debe ser permitido. Puede omitirse (`BE-11`).

### `DELETE /api/session`

Autenticado + CSRF. Invalida la sesión actual, borra la cookie y responde `204`.

### `POST /api/account/password`

Autenticado + CSRF. Cuerpo `{ "currentPassword": string, "newPassword": string }`.

- Contraseña actual incorrecta: `400 invalid_input`, “La contraseña actual no es correcta.”
- Nueva contraseña inválida: `400 invalid_input`.
- Éxito: `204`; cierra las demás sesiones de la cuenta y conserva la actual (`RN-ID-25`).

### Reglas transversales

- `401` si falta sesión autenticada; `403` si falta permiso o falla CSRF/Origen/dirección.
- El actor se reconstruye desde la sesión, nunca desde el cuerpo (`BE-27`).
- Los cuerpos y parámetros usan JSON Schema con `additionalProperties: false` (`BE-30`, `BE-31`).
- Un error inesperado responde `500 internal` genérico y se registra en el servidor (`BE-36`).

## Sesión y cookie

- Cookie `qabase_session`, valor `sid.hmac` en base64url.
- HMAC-SHA256 con `SESSION_SECRET`; comparación en tiempo constante antes de consultar la base.
- Atributos: `HttpOnly`, `SameSite=Strict`, `Path=/`, sin `Domain`, sin `Max-Age` ni `Expires` (cookie de sesión del navegador), `Secure=false` por loopback (`BE-16`).
- Expiración absoluta de 8 h desde la creación; sin renovación (`BE-14`, `RN-ID-36`).
- El login rota el identificador: elimina la sesión anónima y crea una autenticada (`BE-13`).
- Sesión expirada, firma inválida o cuenta inactiva: se elimina la fila, se borra la cookie y se trata como anónima.
- Las sesiones expiradas se limpian al crear o rotar una sesión; no hay proceso en segundo plano.

## Secreto

- `SESSION_SECRET` si existe; mínimo 32 caracteres.
- Si no, `data/session-secret` (0600) generado por `npm run setup` con 32 bytes aleatorios en hex.
- Si no hay secreto válido, el arranque aborta con un mensaje que indica ejecutar `npm run setup` (`BE-02`, `SEG-05`).

## Autorización

- Claves: `registros.ver`, `registros.crear`, `registros.editar`, `registros.anular`, `registros.historial`, `personal.gestionar`, `usuarios.gestionar`, `roles.gestionar`, `mesa.ver`, `mesa.crear`.
- El rol protegido resuelve todas las claves conocidas, incluidas las futuras.
- Los demás roles se resuelven con `role_permissions` en cada petición, sin caché (`PERM-13`).
- Guardia de ruta: `requireSession` y `requirePermission(key)`.
- Asignar el rol protegido exige `usuarios.gestionar` **y** `roles.gestionar` (`RN-ID-13` actualizada). La 001 no expone esa ruta; la regla queda en el servicio para la 002.

## CSRF y origen

- Token de 32 bytes por sesión, guardado en `sessions.csrf_token`.
- Se exige `X-CSRF-Token` en toda mutación autenticada; comparación en tiempo constante.
- `Origin` obligatorio en mutaciones autenticadas y permitido solo para `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}` y `http://[::1]:${PORT}`.
- El proxy de Vite normaliza el `Origin` al del API en desarrollo.
- La dirección remota debe ser loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`).
- Fallo: `403 forbidden`, mensaje genérico.

## Bloqueo de intentos

- Mapa en memoria por `username_normalized`.
- Ventana deslizante de 15 minutos; máximo 5 fallos; el sexto se rechaza antes de verificar.
- Éxito limpia el conteo; reinicio del proceso también (`RN-ID-35`).
- Reloj inyectable para tests.
- Usuario inexistente o inactivo se verifica contra un hash señuelo para igualar el tiempo (`BE-18`).

## Asistentes locales

### `npm run setup`

1. Resuelve configuración y secreto; genera `data/session-secret` si hace falta.
2. Abre la base, aplica migraciones y seeds.
3. Abre una transacción `BEGIN IMMEDIATE`.
4. Si existe una cuenta **activa** con rol protegido, aborta sin crear nada (`RN-ID-72`).
5. Pide usuario, contraseña y confirmación con entrada oculta; re-pide si no valida.
6. Inserta la cuenta activa con el rol protegido y registra `account.created` con actor nulo y canal `local`.
7. Confirma y sale con `0`. Cualquier fallo: mensaje claro y salida `1`.

Sin terminal interactiva, falla con un mensaje explícito. No hay ruta HTTP equivalente.

La entrada oculta usa `@inquirer/prompts`; no se implementa lectura de contraseña con eco.

### `npm run reset-admin-password`

1. Pide el nombre de usuario de una cuenta con rol protegido.
2. Pide confirmación escribiendo de nuevo el nombre.
3. Pide la nueva contraseña dos veces.
4. Actualiza el hash, incrementa la versión, elimina todas las sesiones de la cuenta y registra `account.password_reset_local` con actor nulo y canal `local`.
5. Todo en una transacción; sale con `0` o `1`.

## Interfaz

- `/login`: formulario usuario/contraseña, error genérico, aviso de demasiados intentos y, si `setupRequired`, la instrucción de ejecutar `npm run setup`.
- `/`: panel mínimo con la cuenta, su rol y un enlace a “Mi cuenta”. Sin métricas ni módulos futuros.
- `/cuenta`: cambio de contraseña con contraseña actual, nueva y confirmación.
- `AuthProvider`: carga `GET /api/session`, expone `login`, `logout`, `changePassword` y el token CSRF; guarda el token solo en memoria.
- `RequireAuth`: redirige a `/login` si no hay sesión; si hay sesión y se visita `/login`, redirige a `/`.
- Cliente HTTP con `credentials: 'same-origin'`, `Content-Type: application/json` y `X-CSRF-Token` en mutaciones. Un `401` limpia el estado y redirige.
- Estados de carga, error y vacío en cada pantalla. Componentes shadcn existentes; sin rediseño.

## Criterios de aceptación

### Datos y seeds

1. La migración crea las seis tablas, claves foráneas, CHECK e índices, y se aplica una sola vez.
2. Existe exactamente un rol con `is_protected = 1`; un segundo intento de insertarlo falla.
3. Los seeds crean 10 permisos, 3 roles y las concesiones de Editor y Consulta según la matriz.
4. Ejecutar los seeds dos veces no duplica filas ni sobrescribe nombres o descripciones.
5. Renombrar Editor y volver a ejecutar los seeds no recrea “Editor” ni reañade permisos retirados.
6. El rol Administrador no tiene filas en `role_permissions` y resuelve las 10 claves.

### Setup y recuperación

7. `npm run setup` sin administrador activo crea una cuenta activa con el rol protegido y un evento `account.created` local.
8. Con un administrador activo, el setup falla, no crea cuenta ni evento y sale con código 1.
9. El setup rechaza usuario inválido, contraseña corta y confirmación distinta; no crea nada.
10. El setup genera `data/session-secret` con modo 0600 si no hay variable de entorno.
11. `npm run reset-admin-password` solo acepta cuentas con rol protegido, invalida todas sus sesiones y deja evento local sin actor.
12. El reset exige confirmar el nombre y escribir dos veces la nueva contraseña.
13. Sin terminal interactiva, ambos asistentes fallan con un mensaje claro.

### Login y sesión

14. Login válido responde 200 con cuenta, rol, permisos y `csrfToken`, y fija `qabase_session` con `HttpOnly`, `SameSite=Strict`, `Path=/`, sin `Domain` y sin `Max-Age`.
15. Usuario inexistente, contraseña incorrecta y cuenta inactiva devuelven el mismo 401 y el mismo mensaje.
16. La verificación de un usuario inexistente usa el hash señuelo.
17. Cinco fallos en quince minutos bloquean el sexto intento con 429 sin verificar la contraseña; un login exitoso limpia el conteo.
18. La sesión expira a las 8 h exactas; una petición posterior devuelve 401 y elimina la fila. No se renueva por actividad.
19. El login rota el identificador de sesión; la cookie anónima anterior deja de ser válida.
20. Logout invalida la sesión actual y borra la cookie; reutilizarla devuelve 401.
21. Una cuenta desactivada invalida su sesión en la siguiente petición.
22. La cookie manipulada (firma inválida) se rechaza sin consultar la sesión.

### CSRF y origen

23. Una mutación autenticada sin `X-CSRF-Token` devuelve 403.
24. Un token incorrecto devuelve 403; el correcto permite la operación.
25. El token se rota al iniciar sesión y el anterior deja de servir.
26. `Origin` ausente o no permitido en una mutación autenticada devuelve 403; el permitido funciona.
27. Una dirección remota no loopback en una mutación devuelve 403.
28. El login sin `Origin` funciona; con un `Origin` no permitido devuelve 403.

### Permisos

29. Sin sesión, una ruta protegida devuelve 401; con sesión sin permiso, 403.
30. Administrador recibe las 10 claves; Editor y Consulta coinciden con la matriz.
31. Revocar un permiso en base afecta la siguiente petición sin volver a iniciar sesión.
32. Un permiso fuera del registro canónico no se concede ni rompe la resolución.

### Cambio de contraseña propio

33. Con la contraseña actual correcta, actualiza el hash, incrementa la versión y responde 204.
34. Con la actual incorrecta, responde 400 y no cambia nada.
35. La nueva contraseña se valida entre 12 y 128 caracteres, sin recorte.
36. El cambio conserva la sesión actual y elimina las demás de esa cuenta.
37. Deja un evento `account.password_changed` con actor y sin hash ni contraseña.

### Auditoría y errores

38. Las escrituras de identidad y su evento comparten transacción: si falla la auditoría, no se confirma la escritura.
39. Ningún evento, respuesta o log contiene contraseñas, hashes o tokens de sesión.
40. Un error inesperado devuelve `500 internal` sin traza ni detalle interno.
41. Los cuerpos con campos extra se rechazan con `400 invalid_input`.

### Interfaz

42. Sin sesión, `/` redirige a `/login`; con sesión, `/login` redirige a `/`.
43. El login muestra el mensaje genérico y el aviso de demasiados intentos.
44. Si no hay administrador, el login muestra la instrucción de `npm run setup`.
45. “Mi cuenta” valida la confirmación en cliente y muestra el error del servidor.
46. Logout vuelve a `/login` y limpia el estado.

## Seams de test

- **Validaciones compartidas:** usuario, contraseña y normalización, sin tocar HTTP ni base.
- **Password:** hash/verify real una vez; hasher inyectable para rutas.
- **Secreto:** resolución env/archivo, longitud y permisos.
- **Sesión:** crear, rotar, validar, expirar y firmar con reloj inyectable.
- **CSRF:** generar, comparar y rotar.
- **Throttle:** ventana deslizante con reloj inyectable.
- **Permisos:** resolución del rol protegido y de concesiones.
- **Repositorios:** SQL real contra `:memory:` con migraciones aplicadas.
- **Servicios:** login, cambio de contraseña, setup y reset con dependencias inyectadas.
- **Rutas:** `fastify.inject` con cookie, CSRF y origen reales.
- **Asistentes:** funciones `runSetup`/`runReset` con prompts inyectados, sin TTY.
- **Interfaz:** Testing Library con `fetch` simulado; guardia de rutas y formularios.

## Dependencias nuevas

- `@node-rs/argon2` (API): Argon2id prebuilt.
- `@fastify/cookie` (API): lectura y escritura de la cookie de sesión.
- `@inquirer/prompts` (API, solo CLI): entrada oculta y confirmaciones.

## Archivos probables

```text
migrations/001-identidad.sql
apps/api/src/core/errors.ts
apps/api/src/core/security/{password,session,csrf,throttle,session-secret}.ts
apps/api/src/core/permissions/{registry,resolver}.ts
apps/api/src/core/audit/repository.ts
apps/api/src/modules/identity/{repository,service,seed,validators}.ts
apps/api/src/routes/{session,account}.ts
apps/api/src/plugins/auth.ts
apps/api/src/cli/{setup,reset-admin-password,prompts}.ts
apps/api/src/{server,main,config}.ts
packages/shared/src/{session,permissions,validation}.ts
apps/web/src/lib/api.ts
apps/web/src/features/auth/{AuthProvider,RequireAuth}.tsx
apps/web/src/pages/{LoginPage,PanelPage,AccountPage}.tsx
apps/web/src/{App,main}.tsx
apps/web/vite.config.ts
```

## Riesgos

- **`@node-rs/argon2`:** si el binario prebuilt no cubre esta plataforma, hay que evaluar `argon2` con prebuild o compilar. Se verifica al inicio de la implementación.
- **`@fastify/cookie`:** confirmar compatibilidad con Fastify 5 antes de usarlo; si no, parsear la única cookie a mano.
- **Argon2 en tests:** con parámetros OWASP cada hash cuesta; usar un hasher falso en rutas y reservar el real para pruebas puntuales.
- **Origen en desarrollo:** el proxy de Vite debe normalizar `Origin`; si no, las mutaciones fallan con 403.
- **Carrera de setup:** dos procesos simultáneos podrían crear dos administradores; `BEGIN IMMEDIATE` y el chequeo dentro de la transacción lo evitan en el uso previsto.
- **Cookie sin `Secure`:** es deliberado por loopback; no debe reutilizarse en red (`BE-16`).
- **Sesiones anónimas:** cada visitante sin cookie crea una fila; se limpian al crear o rotar sesiones. Vigilar el crecimiento si se automatiza el acceso.
- **CLI con contraseña oculta:** requiere TTY; los tests usan prompts inyectados.

## Orden de implementación

1. Migración, seeds y tests de esquema.
2. Contratos y validaciones compartidas.
3. Password, secreto, sesión, CSRF y throttle.
4. Repositorio y servicio de identidad; auditoría.
5. Asistentes de setup y reset.
6. Error handler, plugin de autenticación, guardia de permisos y rutas.
7. Interfaz: AuthProvider, login, panel y cuenta.
8. `npm run verify` y smoke test de extremo a extremo.

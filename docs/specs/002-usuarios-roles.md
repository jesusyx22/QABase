# 002 — Usuarios y roles

- **Estado:** aprobada
- **Fecha:** 2026-10-18
- **Depende de:** 001
- **Fuente:** sección 8 del documento de negocio

## Alcance

Administración de cuentas y roles desde el panel. No incluye Personal QA ni registros.

### Dentro

- Listado, alta y edición de cuentas (usuario, rol, estado).
- Restablecimiento administrativo de contraseña.
- Historial de cuenta y de rol.
- Listado, alta, renombrado de roles y edición de su conjunto de permisos.
- Protección del último administrador y del rol Administrador.
- Regla `RN-ID-13`: asignar Administrador exige `usuarios.gestionar` + `roles.gestionar`.

### Fuera

- Eliminar cuentas o roles.
- Permisos por persona fuera del rol.
- Cambio de contraseña propio (ya en 001).
- Recuperación por login.

## API

Todas las rutas requieren sesión. Mutaciones con CSRF y origen.

| Método | Ruta | Permiso | Cuerpo / respuesta |
|---|---|---|---|
| GET | `/api/users?includeInactive=1&q=` | `usuarios.gestionar` | Lista completa de cuentas |
| POST | `/api/users` | `usuarios.gestionar` | `{username,password,roleId}` |
| PATCH | `/api/users/:id` | `usuarios.gestionar` | `{username?,roleId?,isActive?,version}` |
| POST | `/api/users/:id/reset-password` | `usuarios.gestionar` | `{newPassword}` |
| GET | `/api/users/:id/history` | `usuarios.gestionar` | Eventos de auditoría |
| GET | `/api/roles/options` | `usuarios.gestionar` | Roles asignables por el actor |
| GET | `/api/roles` | `roles.gestionar` | Roles con sus permisos |
| POST | `/api/roles` | `roles.gestionar` | `{name}` |
| PATCH | `/api/roles/:id` | `roles.gestionar` | `{name,version}` |
| PUT | `/api/roles/:id/permissions` | `roles.gestionar` | `{permissions: PermissionKey[]}` |
| GET | `/api/roles/:id/history` | `roles.gestionar` | Eventos de auditoría |

### Formas

```ts
type User = {
  id: number
  username: string
  role: { id: number; name: string; isProtected: boolean }
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

type Role = {
  id: number
  name: string
  isProtected: boolean
  version: number
  permissions: PermissionKey[]
}
```

Los historiales devuelven `{ occurredAt, actorUsername, channel, action, before, after }` con los JSON ya parseados.

## Reglas

- Usuario: 3–64, ASCII `[A-Za-z0-9._-]`, sin recorte, único sin distinguir mayúsculas (`RN-ID-14`–`RN-ID-18`).
- Contraseña: 12–128, sin recorte (`RN-ID-19`–`RN-ID-23`).
- Alta: cuenta activa, rol existente, evento `account.created`.
- Edición: versión obligatoria, evento `account.updated` con antes/después (sin hash).
- No se puede desactivar la propia cuenta (`RN-ID-09`).
- El último administrador activo no se desactiva ni cambia de rol (`RN-ID-10`, `RN-ID-11`).
- Asignar el rol protegido exige `roles.gestionar`; el selector lo oculta si falta (`RN-ID-13`).
- Toda edición o restablecimiento de contraseña sobre una cuenta con rol protegido exige además `roles.gestionar`, para evitar que un gestor de usuarios sin esa capacidad tome una cuenta administradora.
- Reset administrativo: cierra todas las sesiones, evento `account.password_reset`.
- Rol nuevo: nombre recortado 1–100, único exacto, sin permisos (`RN-ID-45`–`RN-ID-47`).
- Rol protegido: no se renombra ni se le editan permisos (`RN-ID-51`).
- Permisos de rol: reemplazo completo, sin versión, última escritura gana (`RN-ID-50`); claves válidas y deduplicadas; evento `role.permissions_changed`.
- No hay borrado físico (`RN-ID-48`).

## Criterios de aceptación

1. Crear una cuenta Editor permite iniciar sesión con solo los permisos de Editor.
2. Usuario duplicado con distinta capitalización devuelve 409.
3. Desactivar la propia cuenta devuelve 409.
4. Desactivar o cambiar el rol del último administrador activo devuelve 409.
5. Un gestor de usuarios sin `roles.gestionar` no puede asignar Administrador ni ve esa opción.
6. Un gestor de usuarios sin `roles.gestionar` no puede editar ni restablecer la contraseña de una cuenta administradora.
6. Reset administrativo invalida todas las sesiones de la cuenta.
7. Renombrar un rol no protegido conserva sus permisos y cuentas.
8. Renombrar el rol protegido o editar sus permisos devuelve 409.
9. Reemplazar permisos de un rol afecta la siguiente petición de las cuentas.
10. Los historiales muestran actor y antes/después sin contraseñas ni hashes.
11. Los cuerpos con campos extra se rechazan con 400.

## Archivos

```text
apps/api/src/modules/identity/users.ts       (servicio y repositorio de cuentas)
apps/api/src/modules/identity/roles.ts       (servicio y repositorio de roles)
apps/api/src/routes/users.ts
apps/api/src/routes/roles.ts
apps/web/src/pages/UsersPage.tsx
apps/web/src/pages/RolesPage.tsx
apps/web/src/features/users/*
apps/web/src/features/roles/*
```

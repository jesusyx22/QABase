import { PERMISSION_KEYS, type PermissionKey } from '@qabase/shared'
import { describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../../core/security/password'
import { createTestDatabase } from '../../test/db'
import type { Actor } from './actor'
import { findAccountById, findRoleBySeedKey } from './repository'
import {
  createRole,
  listAssignableRoles,
  listRoleHistory,
  renameRole,
  setRolePermissions,
} from './roles'
import { createFirstAdmin } from './service'
import {
  createUser,
  listAccountHistory,
  listUsers,
  resetUserPassword,
  updateUser,
} from './users'

const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'new correct horse battery'
const now = new Date('2026-10-18T12:00:00.000Z')

const hasher: PasswordHasher = {
  async hash(password) {
    return `fake:${password}`
  },
  async verify(passwordHash, password) {
    return passwordHash === `fake:${password}`
  },
}

const adminPermissions: PermissionKey[] = [...PERMISSION_KEYS]

async function createAdmin(db: ReturnType<typeof createTestDatabase>) {
  const id = await createFirstAdmin(
    { db, hasher },
    { username: 'admin', password: PASSWORD, now },
  )
  return findAccountById(db, id)!
}

function adminActor(account: ReturnType<typeof findAccountById>): Actor {
  return {
    id: account!.id,
    username: account!.username,
    permissions: adminPermissions,
  }
}

async function createActorWithRole(
  db: ReturnType<typeof createTestDatabase>,
  admin: Actor,
  input: { username: string; roleName: string; permissions: PermissionKey[] },
): Promise<Actor> {
  const role = createRole(db, admin, { name: input.roleName, now })
  setRolePermissions(db, admin, role.id, {
    permissions: input.permissions,
    now,
  })
  const user = await createUser(
    { db, hasher },
    admin,
    {
      username: input.username,
      password: PASSWORD,
      roleId: role.id,
      now,
    },
  )
  return { id: user.id, username: user.username, permissions: input.permissions }
}

describe('cuentas', () => {
  it('lista, busca y crea cuentas con auditoría', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const editor = findRoleBySeedKey(db, 'editor')!

    const user = await createUser(
      { db, hasher },
      actor,
      {
        username: 'editor.qa',
        password: PASSWORD,
        roleId: editor.id,
        now,
      },
    )

    expect(user.username).toBe('editor.qa')
    expect(user.role.name).toBe('Editor')
    expect(user.isActive).toBe(true)

    expect(listUsers(db, { includeInactive: false, search: 'editor' })).toHaveLength(1)
    expect(listUsers(db, { includeInactive: false, search: 'nadie' })).toHaveLength(0)

    expect(listAccountHistory(db, user.id)[0]).toMatchObject({
      action: 'account.created',
      actorUsername: 'admin',
    })

    db.close()
  })

  it('rechaza usuarios duplicados sin distinguir mayúsculas', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const editor = findRoleBySeedKey(db, 'editor')!

    await createUser(
      { db, hasher },
      actor,
      { username: 'Editor.QA', password: PASSWORD, roleId: editor.id, now },
    )

    await expect(
      createUser(
        { db, hasher },
        actor,
        { username: 'editor.qa', password: PASSWORD, roleId: editor.id, now },
      ),
    ).rejects.toMatchObject({ code: 'conflict' })

    db.close()
  })

  it('impide asignar el rol protegido sin gestionar roles', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const manager = await createActorWithRole(db, actor, {
      username: 'manager',
      roleName: 'Gestor de usuarios',
      permissions: ['usuarios.gestionar'],
    })
    const protectedRole = findRoleBySeedKey(db, 'admin')!

    await expect(
      createUser(
        { db, hasher },
        manager,
        {
          username: 'nuevo.admin',
          password: PASSWORD,
          roleId: protectedRole.id,
          now,
        },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })

    db.close()
  })

  it('edita con versión, detecta conflictos y audita antes/después', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const editor = findRoleBySeedKey(db, 'editor')!
    const consulta = findRoleBySeedKey(db, 'consulta')!

    const user = await createUser(
      { db, hasher },
      actor,
      { username: 'persona', password: PASSWORD, roleId: editor.id, now },
    )

    const updated = await updateUser(
      { db },
      actor,
      user.id,
      {
        username: 'persona.renombrada',
        roleId: consulta.id,
        isActive: false,
        version: user.version,
        now,
      },
    )

    expect(updated.username).toBe('persona.renombrada')
    expect(updated.role.name).toBe('Consulta')
    expect(updated.isActive).toBe(false)
    expect(updated.version).toBe(2)

    await expect(
      updateUser(
        { db },
        actor,
        user.id,
        { username: 'otra', version: user.version, now },
      ),
    ).rejects.toMatchObject({ code: 'conflict' })

    const history = listAccountHistory(db, user.id)
    expect(history.at(-1)).toMatchObject({
      action: 'account.updated',
      before: { username: 'persona', isActive: true },
      after: { username: 'persona.renombrada', isActive: false },
    })

    db.close()
  })

  it('no permite autodesactivarse ni dejar sin administradores', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const manager = await createActorWithRole(db, actor, {
      username: 'manager',
      roleName: 'Gestor con roles',
      permissions: ['usuarios.gestionar', 'roles.gestionar'],
    })

    await expect(
      updateUser(
        { db },
        actor,
        admin.id,
        { isActive: false, version: admin.version, now },
      ),
    ).rejects.toMatchObject({ code: 'conflict' })

    await expect(
      updateUser(
        { db },
        manager,
        admin.id,
        { isActive: false, version: admin.version, now },
      ),
    ).rejects.toMatchObject({ code: 'conflict' })

    db.close()
  })

  it('protege las cuentas administradoras de un gestor sin roles', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const manager = await createActorWithRole(db, actor, {
      username: 'manager',
      roleName: 'Gestor de usuarios',
      permissions: ['usuarios.gestionar'],
    })

    await expect(
      updateUser(
        { db },
        manager,
        admin.id,
        { username: 'admin2', version: admin.version, now },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })

    await expect(
      resetUserPassword(
        { db, hasher },
        manager,
        admin.id,
        { newPassword: NEW_PASSWORD, now },
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })

    db.close()
  })

  it('restablece la contraseña y cierra las sesiones de la cuenta', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const editor = findRoleBySeedKey(db, 'editor')!

    const user = await createUser(
      { db, hasher },
      actor,
      { username: 'editor', password: PASSWORD, roleId: editor.id, now },
    )
    db.prepare(
      "INSERT INTO sessions (id, account_id, csrf_token, created_at, expires_at) VALUES ('s1', ?, 'c', ?, ?)",
    ).run(user.id, now.toISOString(), new Date(now.getTime() + 1000).toISOString())

    await resetUserPassword(
      { db, hasher },
      actor,
      user.id,
      { newPassword: NEW_PASSWORD, now },
    )

    expect(findAccountById(db, user.id)!.passwordHash).toBe(`fake:${NEW_PASSWORD}`)
    expect(
      (db.prepare('SELECT COUNT(*) AS total FROM sessions').get() as { total: number })
        .total,
    ).toBe(0)
    expect(listAccountHistory(db, user.id).at(-1)).toMatchObject({
      action: 'account.password_reset',
    })

    db.close()
  })
})

describe('roles', () => {
  it('crea roles vacíos, los renombra y reemplaza permisos', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)

    const role = createRole(db, actor, { name: '  Supervisor  ', now })
    expect(role.name).toBe('Supervisor')
    expect(role.permissions).toEqual([])

    const renamed = renameRole(db, actor, role.id, {
      name: 'Supervisión',
      version: role.version,
      now,
    })
    expect(renamed.name).toBe('Supervisión')

    const withPermissions = setRolePermissions(db, actor, role.id, {
      permissions: ['registros.ver', 'registros.ver', 'mesa.ver'],
      now,
    })
    expect(withPermissions.permissions).toEqual(['registros.ver', 'mesa.ver'])

    expect(listRoleHistory(db, role.id).map((event) => event.action)).toEqual([
      'role.created',
      'role.renamed',
      'role.permissions_changed',
    ])

    db.close()
  })

  it('protege el rol Administrador y rechaza nombres duplicados', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const protectedRole = findRoleBySeedKey(db, 'admin')!

    expect(() =>
      renameRole(db, actor, protectedRole.id, {
        name: 'Root',
        version: 1,
        now,
      }),
    ).toThrow(/no se puede renombrar/)

    expect(() =>
      setRolePermissions(db, actor, protectedRole.id, {
        permissions: ['mesa.ver'],
        now,
      }),
    ).toThrow(/no se editan/)

    createRole(db, actor, { name: 'Duplicado', now })
    expect(() => createRole(db, actor, { name: 'Duplicado', now })).toThrow(
      /Ya existe un rol/,
    )

    db.close()
  })

  it('filtra el rol protegido para quien no gestiona roles', async () => {
    const db = createTestDatabase()
    const admin = await createAdmin(db)
    const actor = adminActor(admin)
    const manager = await createActorWithRole(db, actor, {
      username: 'manager',
      roleName: 'Gestor de usuarios',
      permissions: ['usuarios.gestionar'],
    })

    const options = listAssignableRoles(db, manager)
    expect(options.some((role) => role.isProtected)).toBe(false)
    expect(options.some((role) => role.name === 'Editor')).toBe(true)

    expect(
      listAssignableRoles(db, actor).some((role) => role.isProtected),
    ).toBe(true)

    db.close()
  })
})

import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { resolvePermissions } from '../../core/permissions'
import type { PasswordHasher } from '../../core/security/password'
import {
  createAnonymousSession,
  createAuthenticatedSession,
  resolveSession,
} from '../../core/sessions/service'
import { openDatabase } from '../../db/database'
import { createTestDatabase } from '../../test/db'
import { runResetAdminPassword } from './reset'
import { runSetup } from './setup'
import {
  authenticate,
  changeOwnPassword,
  createFirstAdmin,
  findAdminForLocalReset,
  resetAdminPasswordLocal,
  setupRequired,
} from './service'
import {
  countActiveAdmins,
  findAccountById,
  findAccountByNormalizedUsername,
  findProtectedRole,
  findRoleBySeedKey,
} from './repository'
import { seedIdentity } from './seed'

const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'new correct horse battery'
const DECOY = 'fake:decoy'
const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../../../migrations/', import.meta.url),
)

const hasher: PasswordHasher = {
  async hash(password) {
    return `fake:${password}`
  },
  async verify(passwordHash, password) {
    return passwordHash === `fake:${password}`
  },
}

const now = new Date('2026-10-18T12:00:00.000Z')

function count(db: ReturnType<typeof createTestDatabase>, table: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as {
      total: number
    }
  ).total
}

async function createAdmin(db: ReturnType<typeof createTestDatabase>) {
  const id = await createFirstAdmin(
    { db, hasher },
    { username: 'admin', password: PASSWORD, now },
  )
  return findAccountById(db, id)!
}

describe('seeds de identidad', () => {
  it('crean 10 permisos, 3 roles y las concesiones iniciales', () => {
    const db = createTestDatabase()

    expect(count(db, 'permissions')).toBe(12)
    expect(count(db, 'roles')).toBe(3)

    const admin = findProtectedRole(db)!
    const editor = findRoleBySeedKey(db, 'editor')!
    const consulta = findRoleBySeedKey(db, 'consulta')!

    expect(
      resolvePermissions(db, {
        id: admin.id,
        name: admin.name,
        isProtected: true,
      }),
    ).toHaveLength(12)
    expect(
      resolvePermissions(db, {
        id: editor.id,
        name: editor.name,
        isProtected: false,
      }),
    ).toEqual([
      'registros.ver',
      'registros.crear',
      'registros.editar',
      'mesa.ver',
      'mesa.crear',
      'accesos.ver',
    ])
    expect(
      resolvePermissions(db, {
        id: consulta.id,
        name: consulta.name,
        isProtected: false,
      }),
    ).toEqual(['registros.ver', 'mesa.ver', 'accesos.ver'])
    expect(count(db, 'role_permissions')).toBe(9)

    db.close()
  })

  it('son idempotentes y no recrean un rol renombrado ni reañaden permisos', () => {
    const db = createTestDatabase()
    const editor = findRoleBySeedKey(db, 'editor')!

    db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(
      'Editores',
      editor.id,
    )
    db.prepare(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_key = ?',
    ).run(editor.id, 'registros.crear')
    const grantsBefore = count(db, 'role_permissions')

    seedIdentity(db, now)

    expect(count(db, 'roles')).toBe(3)
    expect(findRoleBySeedKey(db, 'editor')?.name).toBe('Editores')
    expect(count(db, 'role_permissions')).toBe(grantsBefore)
    expect(
      db
        .prepare('SELECT id FROM roles WHERE name = ?')
        .get('Editor'),
    ).toBeUndefined()

    db.close()
  })

  it('ignora una concesión fuera del registro canónico', () => {
    const db = createTestDatabase()
    const consulta = findRoleBySeedKey(db, 'consulta')!
    db.prepare('INSERT INTO permissions (key, description) VALUES (?, ?)').run(
      'desconocido.ver',
      'Permiso de prueba',
    )
    db.prepare(
      'INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)',
    ).run(consulta.id, 'desconocido.ver')

    expect(
      resolvePermissions(db, {
        id: consulta.id,
        name: consulta.name,
        isProtected: false,
      }),
    ).toEqual(['registros.ver', 'mesa.ver', 'accesos.ver'])

    db.close()
  })
})

describe('setup de la primera cuenta', () => {
  it('crea el administrador con auditoría local y solo una vez', async () => {
    const db = createTestDatabase()
    expect(setupRequired(db)).toBe(true)

    const account = await createAdmin(db)

    expect(account.username).toBe('admin')
    expect(account.roleIsProtected).toBe(1)
    expect(countActiveAdmins(db)).toBe(1)
    expect(setupRequired(db)).toBe(false)

    const audit = db
      .prepare('SELECT action, channel, actor_account_id FROM audit_events')
      .all() as Array<{
      action: string
      channel: string
      actor_account_id: number | null
    }>
    expect(audit).toEqual([
      {
        action: 'account.created',
        channel: 'local',
        actor_account_id: null,
      },
    ])

    await expect(
      createFirstAdmin(
        { db, hasher },
        { username: 'otro', password: PASSWORD, now },
      ),
    ).rejects.toMatchObject({ code: 'conflict' })

    db.close()
  })

  it('rechaza usuario y contraseña inválidos sin crear nada', async () => {
    const db = createTestDatabase()

    await expect(
      createFirstAdmin(
        { db, hasher },
        { username: 'ab', password: PASSWORD, now },
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    await expect(
      createFirstAdmin(
        { db, hasher },
        { username: 'admin', password: 'corta', now },
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    expect(count(db, 'accounts')).toBe(0)
    db.close()
  })
})

describe('autenticación', () => {
  it('autentica una cuenta activa y devuelve el error genérico en fallos', async () => {
    const db = createTestDatabase()
    await createAdmin(db)

    const account = await authenticate(
      { db, hasher, decoyHash: DECOY },
      { username: 'ADMIN', password: PASSWORD },
    )
    expect(account.username).toBe('admin')

    await expect(
      authenticate(
        { db, hasher, decoyHash: DECOY },
        { username: 'admin', password: 'incorrecta' },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('usa el hash señuelo para usuarios inexistentes o inactivos', async () => {
    const db = createTestDatabase()
    const account = await createAdmin(db)
    const verifySpy = vi.fn(hasher.verify)

    await expect(
      authenticate(
        { db, hasher: { ...hasher, verify: verifySpy }, decoyHash: DECOY },
        { username: 'nadie', password: PASSWORD },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(verifySpy).toHaveBeenCalledWith(DECOY, PASSWORD)

    db.prepare('UPDATE accounts SET is_active = 0 WHERE id = ?').run(account.id)
    verifySpy.mockClear()

    await expect(
      authenticate(
        { db, hasher: { ...hasher, verify: verifySpy }, decoyHash: DECOY },
        { username: 'admin', password: PASSWORD },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(verifySpy).toHaveBeenCalledWith(DECOY, PASSWORD)

    db.close()
  })
})

describe('cambio de contraseña propio', () => {
  it('actualiza el hash, conserva la sesión actual y cierra las demás', async () => {
    const db = createTestDatabase()
    const account = await createAdmin(db)
    const current = createAuthenticatedSession(db, {
      accountId: account.id,
      now,
    })
    createAuthenticatedSession(db, { accountId: account.id, now })

    await changeOwnPassword(
      { db, hasher },
      {
        account: findAccountById(db, account.id)!,
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        sessionId: current.id,
        now,
      },
    )

    const updated = findAccountById(db, account.id)!
    expect(updated.version).toBe(2)
    expect(updated.passwordHash).toBe(`fake:${NEW_PASSWORD}`)
    expect(count(db, 'sessions')).toBe(1)
    expect(
      db
        .prepare('SELECT action, channel, actor_account_id FROM audit_events')
        .all(),
    ).toContainEqual({
      action: 'account.password_changed',
      channel: 'app',
      actor_account_id: account.id,
    })

    db.close()
  })

  it('rechaza una contraseña actual incorrecta', async () => {
    const db = createTestDatabase()
    const account = await createAdmin(db)

    await expect(
      changeOwnPassword(
        { db, hasher },
        {
          account,
          currentPassword: 'incorrecta',
          newPassword: NEW_PASSWORD,
          sessionId: 'x',
          now,
        },
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    db.close()
  })
})

describe('reinicio local de contraseña de administrador', () => {
  it('solo acepta el rol protegido y cierra todas las sesiones', async () => {
    const db = createTestDatabase()
    const account = await createAdmin(db)
    createAuthenticatedSession(db, { accountId: account.id, now })
    createAuthenticatedSession(db, { accountId: account.id, now })

    const found = findAdminForLocalReset(db, 'admin')
    await resetAdminPasswordLocal(
      { db, hasher },
      { account: found, newPassword: NEW_PASSWORD, now },
    )

    expect(findAccountById(db, account.id)!.passwordHash).toBe(
      `fake:${NEW_PASSWORD}`,
    )
    expect(count(db, 'sessions')).toBe(0)
    expect(
      db
        .prepare(
          "SELECT action, channel, actor_account_id FROM audit_events WHERE action = 'account.password_reset_local'",
        )
        .all(),
    ).toEqual([
      {
        action: 'account.password_reset_local',
        channel: 'local',
        actor_account_id: null,
      },
    ])

    db.close()
  })

  it('rechaza una cuenta que no es administradora', async () => {
    const db = createTestDatabase()
    const editor = findRoleBySeedKey(db, 'editor')!
    db.prepare(
      `INSERT INTO accounts
        (username, username_normalized, password_hash, role_id, is_active, version, created_at, updated_at)
       VALUES ('editor', 'editor', ?, ?, 1, 1, ?, ?)`,
    ).run(`fake:${PASSWORD}`, editor.id, now.toISOString(), now.toISOString())

    expect(() => findAdminForLocalReset(db, 'editor')).toThrow(
      /Administrador protegido/,
    )
    db.close()
  })
})

describe('sesiones', () => {
  it('crea, resuelve y expira sesiones anónimas y autenticadas', async () => {
    const db = createTestDatabase()
    const account = await createAdmin(db)

    const anonymous = createAnonymousSession(db, now)
    expect(resolveSession(db, anonymous.id, now)?.kind).toBe('anonymous')

    const authenticated = createAuthenticatedSession(db, {
      accountId: account.id,
      now,
    })
    const resolved = resolveSession(db, authenticated.id, now)
    expect(resolved?.kind).toBe('authenticated')

    const later = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    expect(resolveSession(db, authenticated.id, later)).toBeNull()
    expect(count(db, 'sessions')).toBe(1) // solo la anónima sigue vigente

    db.close()
  })

  it('elimina la sesión de una cuenta desactivada', async () => {
    const db = createTestDatabase()
    const account = await createAdmin(db)
    const session = createAuthenticatedSession(db, {
      accountId: account.id,
      now,
    })

    db.prepare('UPDATE accounts SET is_active = 0 WHERE id = ?').run(account.id)

    expect(resolveSession(db, session.id, now)).toBeNull()
    expect(count(db, 'sessions')).toBe(0)
    db.close()
  })
})

describe('asistentes locales', () => {
  function setupConfig() {
    const root = mkdtempSync(join(tmpdir(), 'qabase-setup-'))
    return {
      root,
      config: {
        rootDir: root,
        host: '127.0.0.1',
        port: 3000,
        databasePath: join(root, 'data/test.sqlite'),
        migrationsPath: MIGRATIONS_DIR,
        webDistPath: join(root, 'web-dist'),
      },
    }
  }

  it('runSetup crea la cuenta, genera el secreto y falla la segunda vez', async () => {
    const { root, config } = setupConfig()
    const prompts = {
      text: async () => 'admin',
      secret: async () => PASSWORD,
    }

    const id = await runSetup({ config, env: {}, prompts, hasher, clock: () => now })
    expect(id).toBeGreaterThan(0)
    expect(existsSync(join(root, 'data/session-secret'))).toBe(true)

    await expect(
      runSetup({ config, env: {}, prompts, hasher, clock: () => now }),
    ).rejects.toMatchObject({ code: 'conflict' })

    const db = openDatabase(config.databasePath)
    expect(findAccountByNormalizedUsername(db, 'admin')?.username).toBe('admin')
    db.close()
  })

  it('runResetAdminPassword cierra sesiones y cambia el hash', async () => {
    const { config } = setupConfig()
    const setupPrompts = {
      text: async () => 'admin',
      secret: async () => PASSWORD,
    }
    await runSetup({
      config,
      env: {},
      prompts: setupPrompts,
      hasher,
      clock: () => now,
    })

    const db = openDatabase(config.databasePath)
    const account = findAccountByNormalizedUsername(db, 'admin')!
    createAuthenticatedSession(db, { accountId: account.id, now })
    db.close()
    const resetPrompts = {
      text: async (message: string) =>
        message.includes('confirma') ? 'admin' : 'admin',
      secret: async () => NEW_PASSWORD,
    }

    await runResetAdminPassword({
      config,
      prompts: resetPrompts,
      hasher,
      clock: () => now,
    })

    const after = openDatabase(config.databasePath)
    expect(findAccountByNormalizedUsername(after, 'admin')!.passwordHash).toBe(
      `fake:${NEW_PASSWORD}`,
    )
    expect(count(after, 'sessions')).toBe(0)
    after.close()
  })
})

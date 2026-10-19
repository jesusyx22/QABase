import { PERMISSIONS, type PermissionKey } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { inTransaction } from '../../core/transaction'
import {
  findRoleBySeedKey,
  insertSeedRole,
  insertSeedRolePermission,
} from './repository'

type SeedRole = {
  seedKey: string
  name: string
  isProtected: boolean
  permissions: PermissionKey[]
}

const SEED_ROLES: SeedRole[] = [
  {
    seedKey: 'admin',
    name: 'Administrador',
    isProtected: true,
    permissions: [],
  },
  {
    seedKey: 'editor',
    name: 'Editor',
    isProtected: false,
    permissions: [
      'registros.ver',
      'registros.crear',
      'registros.editar',
      'mesa.ver',
      'mesa.crear',
    ],
  },
  {
    seedKey: 'consulta',
    name: 'Consulta',
    isProtected: false,
    permissions: ['registros.ver', 'mesa.ver'],
  },
]

/**
 * Seeds insert-only (BD-17, BD-18, BD-19). Las concesiones se insertan solo
 * cuando el rol se crea en esta ejecución: retirar un permiso desde la
 * aplicación no debe deshacerse en el siguiente arranque.
 */
export function seedIdentity(db: DatabaseSync, now: Date): void {
  const timestamp = now.toISOString()

  inTransaction(db, () => {
    const insertPermission = db.prepare(
      `INSERT INTO permissions (key, description)
       VALUES (?, ?)
       ON CONFLICT (key) DO NOTHING`,
    )

    for (const permission of PERMISSIONS) {
      insertPermission.run(permission.key, permission.description)
    }

    for (const role of SEED_ROLES) {
      if (findRoleBySeedKey(db, role.seedKey)) {
        continue
      }

      insertSeedRole(db, {
        name: role.name,
        seedKey: role.seedKey,
        isProtected: role.isProtected,
        now: timestamp,
      })

      const created = findRoleBySeedKey(db, role.seedKey)
      if (!created) {
        continue
      }

      for (const permissionKey of role.permissions) {
        insertSeedRolePermission(db, created.id, permissionKey)
      }
    }
  })
}

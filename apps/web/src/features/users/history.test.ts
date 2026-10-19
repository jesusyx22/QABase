import { describe, expect, it } from 'vitest'
import { historyActionLabel, historyFields } from './history'

describe('historyActionLabel', () => {
  it('traduce las acciones conocidas', () => {
    expect(historyActionLabel('account.created')).toBe('Cuenta creada')
    expect(historyActionLabel('account.updated')).toBe('Cuenta actualizada')
    expect(historyActionLabel('account.password_reset')).toBe(
      'Contraseña restablecida',
    )
    expect(historyActionLabel('role.permissions_changed')).toBe(
      'Permisos actualizados',
    )
  })

  it('conserva las acciones desconocidas', () => {
    expect(historyActionLabel('account.archived')).toBe('account.archived')
  })
})

describe('historyFields', () => {
  it('devuelve una lista vacía cuando no hay snapshot', () => {
    expect(historyFields(null)).toEqual([])
    expect(historyFields(undefined)).toEqual([])
  })

  it('oculta el id de rol cuando ya hay nombre de rol', () => {
    const fields = historyFields({
      username: 'ana',
      roleId: 2,
      roleName: 'Editor',
      isActive: false,
    })

    expect(fields).toEqual([
      { key: 'username', label: 'Usuario', value: 'ana' },
      { key: 'roleName', label: 'Rol', value: 'Editor' },
      { key: 'isActive', label: 'Estado', value: 'Inactivo' },
    ])
  })

  it('traduce las claves de permisos a sus etiquetas', () => {
    const fields = historyFields({
      permissions: ['registros.ver', 'usuarios.gestionar'],
    })

    expect(fields).toEqual([
      {
        key: 'permissions',
        label: 'Permisos',
        value: 'Ver registros, Gestionar usuarios',
      },
    ])
  })

  it('indica un conjunto de permisos vacío', () => {
    expect(historyFields({ permissions: [] })).toEqual([
      { key: 'permissions', label: 'Permisos', value: 'Sin permisos' },
    ])
  })

  it('convierte valores anidados en JSON legible', () => {
    const fields = historyFields({ extra: { a: 1 } })

    expect(fields).toEqual([
      { key: 'extra', label: 'extra', value: '{"a":1}' },
    ])
  })
})

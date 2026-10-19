import { describe, expect, it } from 'vitest'
import { usersQuery } from './api'

describe('usersQuery', () => {
  it('omite los parámetros por defecto', () => {
    expect(usersQuery({ includeInactive: false, search: '' })).toBe('')
  })

  it('incluye inactivos y codifica la búsqueda', () => {
    expect(
      usersQuery({ includeInactive: true, search: 'ana perez' }),
    ).toBe('?includeInactive=1&q=ana+perez')
  })
})

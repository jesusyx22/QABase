import { describe, expect, it } from 'vitest'
import { validateRoleName } from './validation'

describe('validateRoleName', () => {
  it('acepta nombres que quedan entre 1 y 100 tras recortar', () => {
    expect(validateRoleName('Editor')).toBeNull()
    expect(validateRoleName('  Editor  ')).toBeNull()
    expect(validateRoleName('a'.repeat(100))).toBeNull()
  })

  it('rechaza nombres vacíos o demasiado largos', () => {
    expect(validateRoleName('   ')).not.toBeNull()
    expect(validateRoleName('')).not.toBeNull()
    expect(validateRoleName('a'.repeat(101))).not.toBeNull()
  })
})

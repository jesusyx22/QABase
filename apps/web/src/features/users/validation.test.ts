import { describe, expect, it } from 'vitest'
import {
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
} from './validation'

describe('validateUsername', () => {
  it('acepta usuarios ASCII de 3 a 64 caracteres', () => {
    expect(validateUsername('ana.qa')).toBeNull()
    expect(validateUsername('A_1-b')).toBeNull()
    expect(validateUsername('a'.repeat(64))).toBeNull()
  })

  it('rechaza longitudes fuera de rango sin recortar', () => {
    expect(validateUsername('ab')).not.toBeNull()
    expect(validateUsername(' a ')).not.toBeNull()
    expect(validateUsername('a'.repeat(65))).not.toBeNull()
  })

  it('rechaza caracteres no permitidos', () => {
    expect(validateUsername('ana qa')).not.toBeNull()
    expect(validateUsername('ana@qa')).not.toBeNull()
    expect(validateUsername('jose.perez')).toBeNull()
  })
})

describe('validatePassword', () => {
  it('exige entre 12 y 128 caracteres sin recortar', () => {
    expect(validatePassword('a'.repeat(11))).not.toBeNull()
    expect(validatePassword('a'.repeat(12))).toBeNull()
    expect(validatePassword('a'.repeat(128))).toBeNull()
    expect(validatePassword('            ')).toBeNull()
    expect(validatePassword('a'.repeat(129))).not.toBeNull()
  })
})

describe('validatePasswordConfirmation', () => {
  it('detecta la confirmación distinta', () => {
    expect(validatePasswordConfirmation('secreto-largo-1', 'secreto-largo-2')).not.toBeNull()
    expect(validatePasswordConfirmation('secreto-largo-1', 'secreto-largo-1')).toBeNull()
  })
})

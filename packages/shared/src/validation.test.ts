import { describe, expect, it } from 'vitest'
import {
  escapeLikePattern,
  isValidPassword,
  isValidUsername,
  normalizeSearchText,
  normalizeUsername,
} from './validation'

describe('validación de usuario', () => {
  it('acepta 3–64 caracteres ASCII permitidos', () => {
    expect(isValidUsername('jhon.cutipa')).toBe(true)
    expect(isValidUsername('A_1-b')).toBe(true)
    expect(isValidUsername('abc')).toBe(true)
    expect(isValidUsername('a'.repeat(64))).toBe(true)
  })

  it('rechaza nombres cortos, largos, con espacios o símbolos', () => {
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('a'.repeat(65))).toBe(false)
    expect(isValidUsername(' jhon')).toBe(false)
    expect(isValidUsername('jhon ')).toBe(false)
    expect(isValidUsername('jhon@qa')).toBe(false)
    expect(isValidUsername('muñoz')).toBe(false)
  })

  it('normaliza para unicidad sin recortar', () => {
    expect(normalizeUsername('Jhon.Cutipa')).toBe('jhon.cutipa')
    expect(normalizeUsername(' jhon')).toBe(' jhon')
  })
})

describe('validación de contraseña', () => {
  it('exige entre 12 y 128 caracteres sin recortar', () => {
    expect(isValidPassword('a'.repeat(11))).toBe(false)
    expect(isValidPassword('a'.repeat(12))).toBe(true)
    expect(isValidPassword('a'.repeat(128))).toBe(true)
    expect(isValidPassword('a'.repeat(129))).toBe(false)
    expect(isValidPassword('  con espacios  ')).toBe(true)
  })
})

describe('búsqueda', () => {
  it('normaliza a minúsculas conservando tildes y Ñ', () => {
    expect(normalizeSearchText('MUÑOZ')).toBe('muñoz')
    expect(normalizeSearchText('Mérito')).toBe('mérito')
  })

  it('escapa comodines de LIKE', () => {
    expect(escapeLikePattern('100%_\\')).toBe('100\\%\\_\\\\')
  })
})

import { describe, expect, it } from 'vitest'
import { MODULES, visibleModules } from './registry'

describe('registro de módulos', () => {
  it('ubica Accesos en Principal', () => {
    const accesses = MODULES.find((module) => module.id === 'accesses')
    expect(accesses?.group).toBe('principal')
    expect(accesses?.path).toBe('accesos')
    expect(accesses?.permission).toBe('accesos.ver')
  })

  it('solo muestra Accesos con el permiso de lectura', () => {
    expect(visibleModules(['accesos.ver']).map((module) => module.id)).toContain(
      'accesses',
    )
    expect(visibleModules([]).map((module) => module.id)).not.toContain(
      'accesses',
    )
  })
})

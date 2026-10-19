import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  it('resuelve rutas desde la raíz del repo, no desde apps/', () => {
    const config = loadConfig({})

    expect(config.databasePath.endsWith('/data/qabase.sqlite')).toBe(true)
    expect(config.databasePath.includes('/apps/data/')).toBe(false)
    expect(config.webDistPath.endsWith('/apps/web/dist')).toBe(true)
    expect(config.migrationsPath.endsWith('/migrations')).toBe(true)
  })

  it('usa loopback y el puerto 3000 por defecto', () => {
    const config = loadConfig({})

    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(3000)
  })

  it('rechaza una dirección que no sea loopback', () => {
    expect(() => loadConfig({ HOST: '0.0.0.0' })).toThrow(/loopback/)
  })

  it('rechaza un puerto inválido', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT inválido/)
  })
})

import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export function allowedOriginsForPort(port: number): ReadonlySet<string> {
  return new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`,
  ])
}

export type AppConfig = {
  rootDir: string
  host: string
  port: number
  databasePath: string
  migrationsPath: string
  webDistPath: string
}

/**
 * Configuración de arranque (BE-03, 14.12).
 *
 * La raíz del repo se resuelve desde este archivo: tanto `src/config.ts`
 * como `dist/server.js` están tres niveles por debajo de la raíz.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rootDir = fileURLToPath(new URL('../../../', import.meta.url))

  const host = env.HOST ?? '127.0.0.1'
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`HOST debe ser una dirección loopback; recibido: ${host}`)
  }

  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválido: ${env.PORT}`)
  }

  const databasePath = env.DATABASE_PATH
    ? resolve(env.DATABASE_PATH)
    : join(rootDir, 'data/qabase.sqlite')

  return {
    rootDir,
    host,
    port,
    databasePath,
    migrationsPath: join(rootDir, 'migrations'),
    webDistPath: join(rootDir, 'apps/web/dist'),
  }
}

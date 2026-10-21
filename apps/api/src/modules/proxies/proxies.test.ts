import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERMISSION_KEYS } from '@qabase/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestDatabase } from '../../test/db'
import type { Actor } from '../identity/actor'
import { createFirstAdmin } from '../identity/service'
import { createAccess } from '../accesses/service'
import {
  getProxyLogs,
  getProxySettings,
  listProxies,
  restartProxy,
  startProxy,
  stopProxy,
  updateProxyAllowlist,
  updateProxySettings,
} from './service'
import { syncProxyCatalog } from './catalog'
import type { PortListener, ProcessInspector } from './process'
import type { ProxyProcessController, StartProcessInput } from './control'

const now = new Date('2026-10-20T12:00:00.000Z')
const root = fileURLToPath(
  new URL('../../../../../scripts/proxies/', import.meta.url),
)
const databases: ReturnType<typeof createTestDatabase>[] = []
let actor: Actor

async function setup() {
  const db = createTestDatabase()
  databases.push(db)
  const id = await createFirstAdmin(
    {
      db,
      hasher: {
        async hash(value) {
          return value
        },
        async verify(hash, value) {
          return hash === value
        },
      },
    },
    {
      username: 'admin',
      password: 'correct horse battery staple',
      now,
    },
  )
  actor = { id, username: 'admin', permissions: [...PERMISSION_KEYS] }
  return db
}

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close()
  }
})

function nodeListener(
  port: number,
  slug: string,
  entry: string,
  managed = true,
  pid = 1000 + port,
): PortListener {
  return {
    port,
    address: '0.0.0.0',
    pid,
    processName: 'node.exe',
    commandLine: managed
      ? `node C:\\repo\\scripts\\proxies\\${slug}\\${entry}`
      : 'node proxy.js',
  }
}

function inspectorWith(
  listeners: PortListener[],
  canBind = true,
): ProcessInspector {
  return {
    async listListeners() {
      return listeners
    },
    async isProcessAlive() {
      return true
    },
    async canBindPort() {
      return canBind
    },
    async describeProcess(pid) {
      return {
        pid,
        processName: 'node.exe',
        commandLine: 'node C:\\repo\\scripts\\proxies\\demo\\proxy.js',
      }
    },
  }
}

function mutableInspector(initial: PortListener[] = []) {
  let listeners = initial
  return {
    inspector: {
      async listListeners() {
        return listeners
      },
      async isProcessAlive() {
        return true
      },
      async canBindPort() {
        return true
      },
      async describeProcess(pid) {
        return {
          pid,
          processName: 'node.exe',
          commandLine: 'node C:\\repo\\scripts\\proxies\\demo\\proxy.js',
        }
      },
    } satisfies ProcessInspector,
    set(next: PortListener[]) {
      listeners = next
    },
    current() {
      return listeners
    },
  }
}

function fakeController(
  onStarted?: () => void,
  onStopped?: () => void,
): ProxyProcessController & { started: StartProcessInput[]; stopped: number[] } {
  const started: StartProcessInput[] = []
  const stopped: number[] = []
  return {
    started,
    stopped,
    async start(input) {
      started.push(input)
      onStarted?.()
      return { pid: 4242 }
    },
    async stop(pid) {
      stopped.push(pid)
      onStopped?.()
    },
  }
}

function manifestsDir(
  services: Record<string, unknown>,
): string {
  const dir = mkdtempSync(join(tmpdir(), 'qabase-proxies-'))
  for (const [slug, manifest] of Object.entries(services)) {
    mkdirSync(join(dir, slug))
    writeFileSync(
      join(dir, slug, 'service.json'),
      JSON.stringify(manifest),
    )
    const entry =
      typeof (manifest as { entry?: unknown }).entry === 'string'
        ? (manifest as { entry: string }).entry
        : 'proxy.js'
    writeFileSync(join(dir, slug, entry), '')
  }
  return dir
}

const baseManifest = {
  name: 'Servicio',
  environment: 'qa',
  entry: 'proxy.js',
  ports: [9000],
  primaryPort: 9000,
  healthPath: null,
  routes: [{ path: '/', target: 'http://10.0.0.1:80' }],
}

describe('catálogo de servicios de proxy', () => {
  it('sincroniza los manifiestos reales con rutas, puertos y accesos', async () => {
    const db = await setup()
    createAccess(db, actor, {
      address: '10.5.5.201',
      port: 80,
      environment: 'qa',
      now,
    })

    const result = syncProxyCatalog(db, root, now)
    expect(result).toEqual({ services: 5, routes: 6, ports: 6 })
    expect(
      db
        .prepare('SELECT slug, entry FROM proxy_services ORDER BY slug')
        .all(),
    ).toEqual([
      { slug: 'documentdb-qa', entry: 'proxy.cjs' },
      { slug: 'gitlab', entry: 'proxy.cjs' },
      { slug: 'mantis', entry: 'proxy.cjs' },
      { slug: 'mongodb-qa', entry: 'proxy.cjs' },
      { slug: 'sentinel', entry: 'server.cjs' },
    ])

    const response = await listProxies(db, {
      inspector: inspectorWith([]),
      healthCheck: async () => true,
      now,
    })
    expect(response.services.map((service) => service.slug)).toEqual([
      'documentdb-qa',
      'gitlab',
      'mantis',
      'mongodb-qa',
      'sentinel',
    ])
    const gitlab = response.services.find((service) => service.slug === 'gitlab')
    expect(gitlab).toMatchObject({
      name: 'GitLab',
      environment: 'qa',
      ports: [{ port: 8081, isPrimary: true }],
      routes: [
        {
          path: '/',
          target: 'http://10.5.5.201:80',
          access: { address: '10.5.5.201', port: 80 },
        },
      ],
      runtime: { status: 'stopped' },
    })
    const sentinel = response.services.find(
      (service) => service.slug === 'sentinel',
    )
    expect(sentinel?.routes).toHaveLength(2)
    expect(sentinel?.routes[1]?.access).toBeNull()
    const mantis = response.services.find((service) => service.slug === 'mantis')
    expect(mantis?.ports.map((port) => port.port)).toEqual([80, 8080])
    const mongo = response.services.find(
      (service) => service.slug === 'mongodb-qa',
    )
    expect(mongo).toMatchObject({
      protocol: 'tcp',
      ports: [{ port: 27017, isPrimary: true }],
      routes: [{ target: 'tcp://10.5.83.84:27017' }],
      allowlist: [],
    })
  })

  it('rechaza puertos duplicados, entries inseguros y manifiestos inválidos', async () => {
    const db = await setup()
    expect(() =>
      syncProxyCatalog(
        db,
        manifestsDir({
          uno: { ...baseManifest, ports: [9000], primaryPort: 9000 },
          dos: { ...baseManifest, ports: [9000], primaryPort: 9000 },
        }),
        now,
      ),
    ).toThrow(/repetido/)

    expect(() =>
      syncProxyCatalog(
        db,
        manifestsDir({
          uno: { ...baseManifest, entry: '../server.js' },
        }),
        now,
      ),
    ).toThrow(/archivo simple/)

    const invalid = mkdtempSync(join(tmpdir(), 'qabase-proxies-'))
    mkdirSync(join(invalid, 'roto'))
    writeFileSync(join(invalid, 'roto', 'service.json'), '{')
    expect(() => syncProxyCatalog(db, invalid, now)).toThrow(
      /No se pudo leer/,
    )
  })

  it('marca inactivos los servicios que ya no tienen manifiesto', async () => {
    const db = await setup()
    const dir = manifestsDir({ uno: baseManifest })
    syncProxyCatalog(db, dir, now)
    const response = await listProxies(db, {
      inspector: inspectorWith([]),
      now,
    })
    expect(response.services[0]?.isActive).toBe(true)

    syncProxyCatalog(db, manifestsDir({}), now)
    const after = await listProxies(db, {
      inspector: inspectorWith([]),
      now,
    })
    expect(after.services[0]?.isActive).toBe(false)
  })
})

describe('estado de servicios', () => {
  it('marca activo, iniciando, detenido, conflicto y error', async () => {
    const db = await setup()
    syncProxyCatalog(db, root, now)

    const active = await listProxies(db, {
      inspector: inspectorWith([
        nodeListener(8081, 'gitlab', 'proxy.cjs'),
        nodeListener(80, 'mantis', 'proxy.cjs'),
        nodeListener(8080, 'mantis', 'proxy.cjs'),
        nodeListener(27017, 'mongodb-qa', 'proxy.cjs'),
        nodeListener(27018, 'documentdb-qa', 'proxy.cjs'),
        nodeListener(3500, 'sentinel', 'server.cjs'),
      ]),
      healthCheck: async () => true,
      now,
    })
    expect(active.services.every((service) => service.runtime.status === 'active')).toBe(true)
    expect(
      active.services.find((service) => service.slug === 'gitlab')?.runtime
        .managed,
    ).toBe(false)

    const conflict = await listProxies(db, {
      inspector: inspectorWith(
        [
          {
            port: 8081,
            address: '::',
            pid: 99,
            processName: 'com.docker.backend.exe',
            commandLine: '',
          },
        ],
        false,
      ),
      now,
    })
    expect(
      conflict.services.find((service) => service.slug === 'gitlab')?.runtime
        .status,
    ).toBe('conflict')

    const healthDown = await listProxies(db, {
      inspector: inspectorWith([
        nodeListener(3500, 'sentinel', 'server.cjs'),
      ]),
      healthCheck: async () => false,
      now,
    })
    expect(
      healthDown.services.find((service) => service.slug === 'sentinel')?.runtime,
    ).toMatchObject({ status: 'error', health: 'down' })
  })

  it('usa la IP global como host del health check', async () => {
    const db = await setup()
    updateProxySettings(db, actor, { host: '10.4.24.18', now })
    syncProxyCatalog(db, root, now)
    let seen: { host: string; port: number; path: string } | null = null
    await listProxies(db, {
      inspector: inspectorWith([
        {
          ...nodeListener(3500, 'sentinel', 'server.cjs'),
          address: '10.4.24.18',
        },
      ]),
      healthCheck: async (host, port, path) => {
        seen = { host, port, path }
        return true
      },
      now,
    })
    expect(seen).toEqual({
      host: '10.4.24.18',
      port: 3500,
      path: '/bridge-health',
    })
  })

  it('normaliza y guarda la allowlist TCP, la escribe para el proxy y la audita', async () => {
    const db = await setup()
    const base = mkdtempSync(join(tmpdir(), 'qabase-allowlist-'))
    const logs = join(base, 'logs')
    mkdirSync(logs)
    syncProxyCatalog(db, root, now)
    const mongo = (
      await listProxies(db, { inspector: inspectorWith([]), now })
    ).services.find((service) => service.slug === 'mongodb-qa')!

    const updated = await updateProxyAllowlist(
      db,
      actor,
      mongo.id,
      [
        { cidr: '10.4.24.18', label: 'Admin' },
        { cidr: '10.4.24.0/24', label: 'Equipo QA' },
      ],
      { logsPath: logs, inspector: inspectorWith([]), now },
    )
    expect(updated.allowlist).toEqual([
      { cidr: '10.4.24.0/24', label: 'Equipo QA' },
      { cidr: '10.4.24.18/32', label: 'Admin' },
    ])
    const file = join(base, 'proxies', 'mongodb-qa.allowlist.json')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      cidrs: ['10.4.24.18/32', '10.4.24.0/24'],
    })
    const auditRow = db
      .prepare(
        "SELECT action, after_json FROM audit_events WHERE action = 'proxy.allowlist_updated'",
      )
      .get() as { action: string; after_json: string }
    expect(JSON.parse(auditRow.after_json)).toEqual({
      allowlist: [
        { cidr: '10.4.24.18/32', label: 'Admin' },
        { cidr: '10.4.24.0/24', label: 'Equipo QA' },
      ],
    })

    await expect(
      updateProxyAllowlist(
        db,
        actor,
        mongo.id,
        [
          { cidr: '10.4.24.18', label: 'Admin' },
          { cidr: '10.4.24.18/32', label: 'Duplicado' },
        ],
        { logsPath: logs, inspector: inspectorWith([]), now },
      ),
    ).rejects.toThrow(/repetido/i)

    await expect(
      updateProxyAllowlist(
        db,
        actor,
        mongo.id,
        [{ cidr: '10.4.24.18', label: '   ' }],
        { logsPath: logs, inspector: inspectorWith([]), now },
      ),
    ).rejects.toThrow(/nombre/i)

    for (const invalid of [
      '::1',
      'mongo.local',
      '10.4.24.300',
      '10.4.24.0/33',
    ]) {
      await expect(
        updateProxyAllowlist(
          db,
          actor,
          mongo.id,
          [{ cidr: invalid, label: 'Inválido' }],
          {
            logsPath: logs,
            inspector: inspectorWith([]),
            now,
          },
        ),
      ).rejects.toThrow(/no es válido|prefijo/i)
    }

    const gitlab = (
      await listProxies(db, { inspector: inspectorWith([]), now })
    ).services.find((service) => service.slug === 'gitlab')!
    await expect(
      updateProxyAllowlist(
        db,
        actor,
        gitlab.id,
        [{ cidr: '10.4.24.18', label: 'Admin' }],
        {
          logsPath: logs,
          inspector: inspectorWith([]),
          now,
        },
      ),
    ).rejects.toThrow(/solo aplica a servicios TCP/i)

    const cleared = await updateProxyAllowlist(db, actor, mongo.id, [], {
      logsPath: logs,
      inspector: inspectorWith([]),
      now,
    })
    expect(cleared.allowlist).toEqual([])
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ cidrs: [] })
  })

  it('inicia un TCP con el archivo de allowlist', async () => {
    const db = await setup()
    const base = mkdtempSync(join(tmpdir(), 'qabase-tcp-start-'))
    const logs = join(base, 'logs')
    mkdirSync(logs)
    const dir = manifestsDir({
      tcpdemo: {
        ...baseManifest,
        name: 'TCP Demo',
        protocol: 'tcp',
        ports: [9300],
        primaryPort: 9300,
        routes: [{ path: '/', target: 'tcp://10.0.0.1:27017' }],
      },
    })
    syncProxyCatalog(db, dir, now)
    const service = (
      await listProxies(db, { inspector: inspectorWith([]), now })
    ).services[0]!
    const controller = fakeController()
    const updated = await updateProxyAllowlist(
      db,
      actor,
      service.id,
      [{ cidr: '10.4.24.18', label: 'Admin' }],
      { logsPath: logs, inspector: inspectorWith([]), now },
    )
    expect(updated.allowlist).toEqual([
      { cidr: '10.4.24.18/32', label: 'Admin' },
    ])

    await startProxy(db, actor, service.id, {
      proxiesPath: dir,
      logsPath: logs,
      inspector: inspectorWith([]),
      controller,
      healthCheck: async () => true,
      now,
    })
    const allowlistFile = controller.started[0]!.allowlistFile
    expect(allowlistFile).toBe(
      join(base, 'proxies', 'tcpdemo.allowlist.json'),
    )
    expect(JSON.parse(readFileSync(allowlistFile!, 'utf8'))).toEqual({
      cidrs: ['10.4.24.18/32'],
    })
  })

  it('configura la IP global con versión y audita el cambio', async () => {
    const db = await setup()
    expect(getProxySettings(db)).toEqual({ host: null, version: null })
    expect(
      updateProxySettings(db, actor, { host: '10.4.24.18', now }),
    ).toEqual({ host: '10.4.24.18', version: 1 })
    expect(
      updateProxySettings(db, actor, {
        host: '10.4.24.19',
        version: 1,
        now,
      }),
    ).toEqual({ host: '10.4.24.19', version: 2 })
    expect(() =>
      updateProxySettings(db, actor, {
        host: '10.4.24.20',
        version: 1,
        now,
      }),
    ).toThrow(/cambió/)

    const rows = db
      .prepare(
        "SELECT action, before_json, after_json FROM audit_events WHERE module = 'proxies'",
      )
      .all() as Array<{
      action: string
      before_json: string | null
      after_json: string | null
    }>
    expect(rows.map((row) => row.action)).toEqual([
      'proxy.settings_updated',
      'proxy.settings_updated',
    ])
    expect(JSON.parse(rows[0]!.after_json!)).toMatchObject({
      host: '10.4.24.18',
    })
  })
})

describe('operación de servicios', () => {
  it('inicia, detiene y reinicia con auditoría', async () => {
    const db = await setup()
    const dir = manifestsDir({
      demo: {
        ...baseManifest,
        name: 'Demo',
        ports: [9200],
        primaryPort: 9200,
      },
    })
    syncProxyCatalog(db, dir, now)
    updateProxySettings(db, actor, { host: '10.4.24.18', now })
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    const inspector = mutableInspector()
    const controller = fakeController(
      () =>
        inspector.set([nodeListener(9200, 'demo', 'proxy.js', true, 4242)]),
      () => inspector.set([]),
    )
    const options = {
      proxiesPath: dir,
      logsPath: logs,
      inspector: inspector.inspector,
      controller,
      healthCheck: async () => true,
      now,
    }
    const service = (
      await listProxies(db, { inspector: inspector.inspector, now })
    ).services[0]!

    const started = await startProxy(db, actor, service.id, options)
    expect(started.runtime.status).toBe('active')
    expect(started.runtime.managed).toBe(true)
    expect(controller.started[0]).toMatchObject({
      entry: 'proxy.js',
      ports: [9200],
      primaryPort: 9200,
      host: '10.4.24.18',
    })
    expect(controller.started[0]!.serviceDir).toContain('demo')

    await expect(
      startProxy(db, actor, service.id, options),
    ).rejects.toThrow(/ya está activo/)

    const restarted = await restartProxy(db, actor, service.id, options)
    expect(restarted.runtime.status).toBe('active')
    expect(controller.stopped).toEqual([4242])

    const stopped = await stopProxy(db, actor, service.id, options)
    expect(stopped.runtime.status).toBe('stopped')
    expect(controller.stopped).toEqual([4242, 4242])

    const actions = (
      db
        .prepare(
          "SELECT action FROM audit_events WHERE module = 'proxies' ORDER BY id",
        )
        .all() as Array<{ action: string }>
    ).map((row) => row.action)
    expect(actions).toContain('proxy.started')
    expect(actions).toContain('proxy.stopped')
    expect(actions).toContain('proxy.restarted')
  })

  it('exige confirmación para detener un proceso externo', async () => {
    const db = await setup()
    const dir = manifestsDir({ demo: baseManifest })
    syncProxyCatalog(db, dir, now)
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    const inspector = mutableInspector([
      nodeListener(9000, 'demo', 'proxy.js', false),
    ])
    const controller = fakeController(undefined, () => inspector.set([]))
    const options = {
      proxiesPath: dir,
      logsPath: logs,
      inspector: inspector.inspector,
      controller,
      healthCheck: async () => true,
      now,
    }
    const service = (
      await listProxies(db, { inspector: inspector.inspector, now })
    ).services[0]!

    await expect(
      stopProxy(db, actor, service.id, options),
    ).rejects.toThrow(/fuera de QABase/)
    expect(controller.stopped).toEqual([])

    await stopProxy(db, actor, service.id, {
      ...options,
      confirmExternal: true,
    })
    expect(controller.stopped).toEqual([10000])
  })

  it('permite iniciar si Docker/WSL espejan el puerto en IPv6 pero IPv4 está libre', async () => {
    const db = await setup()
    const dir = manifestsDir({ demo: baseManifest })
    syncProxyCatalog(db, dir, now)
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    const inspector = mutableInspector([
      {
        port: 9000,
        address: '::',
        pid: 31164,
        processName: 'wslrelay.exe',
        commandLine: '',
      },
    ])
    const controller = fakeController(
      () => inspector.set([nodeListener(9000, 'demo', 'proxy.js')]),
      () => inspector.set([]),
    )
    const options = {
      proxiesPath: dir,
      logsPath: logs,
      inspector: inspector.inspector,
      controller,
      healthCheck: async () => true,
      now,
    }
    const service = (
      await listProxies(db, { inspector: inspector.inspector, now })
    ).services[0]!
    const started = await startProxy(db, actor, service.id, options)
    expect(started.runtime.status).toBe('active')
    expect(controller.started).toHaveLength(1)
  })

  it('serializa inicios concurrentes y no duplica procesos', async () => {
    const db = await setup()
    const dir = manifestsDir({ demo: baseManifest })
    syncProxyCatalog(db, dir, now)
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    const inspector = mutableInspector()
    const controller = fakeController(
      () => inspector.set([nodeListener(9000, 'demo', 'proxy.js')]),
      () => inspector.set([]),
    )
    const options = {
      proxiesPath: dir,
      logsPath: logs,
      inspector: inspector.inspector,
      controller,
      healthCheck: async () => true,
      now,
    }
    const service = (
      await listProxies(db, { inspector: inspector.inspector, now })
    ).services[0]!

    const results = await Promise.allSettled([
      startProxy(db, actor, service.id, options),
      startProxy(db, actor, service.id, options),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(controller.started).toHaveLength(1)
  })

  it('detiene un proceso que aún no escucha y verifica su identidad', async () => {
    const db = await setup()
    const dir = manifestsDir({ demo: baseManifest })
    syncProxyCatalog(db, dir, now)
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    const stopped: number[] = []
    const controller = {
      async start() {
        return { pid: 5555 }
      },
      async stop(pid: number) {
        stopped.push(pid)
      },
    }
    const inspector = {
      async listListeners() {
        return []
      },
      async isProcessAlive() {
        return true
      },
      async canBindPort() {
        return true
      },
      async describeProcess(pid: number) {
        return {
          pid,
          processName: 'node.exe',
          commandLine: 'node C:\\repo\\scripts\\proxies\\demo\\proxy.js',
        }
      },
    }
    const options = {
      proxiesPath: dir,
      logsPath: logs,
      inspector,
      controller,
      healthCheck: async () => true,
      now,
    }
    const service = (
      await listProxies(db, { inspector, now })
    ).services[0]!

    const started = await startProxy(db, actor, service.id, options)
    expect(started.runtime.status).toBe('starting')
    const stoppedView = await stopProxy(db, actor, service.id, {
      ...options,
      now: new Date(now.getTime() + 2000),
    })
    expect(stoppedView.runtime.status).toBe('stopped')
    expect(stopped).toEqual([5555])
  })

  it('audita un fallo de arranque y deja el runtime en error', async () => {
    const db = await setup()
    const dir = manifestsDir({ demo: baseManifest })
    syncProxyCatalog(db, dir, now)
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    const controller = {
      async start() {
        throw new Error('spawn falló')
      },
      async stop() {},
    }
    const options = {
      proxiesPath: dir,
      logsPath: logs,
      inspector: inspectorWith([]),
      controller,
      healthCheck: async () => true,
      now,
    }
    const service = (
      await listProxies(db, { inspector: inspectorWith([]), now })
    ).services[0]!

    await expect(
      startProxy(db, actor, service.id, options),
    ).rejects.toThrow(/No se pudo iniciar/)

    const runtime = db
      .prepare('SELECT last_error FROM proxy_runtime WHERE service_id = ?')
      .get(service.id) as { last_error: string | null }
    expect(runtime.last_error).toBe('spawn falló')
    const actions = (
      db
        .prepare(
          "SELECT action FROM audit_events WHERE module = 'proxies' ORDER BY id",
        )
        .all() as Array<{ action: string }>
    ).map((row) => row.action)
    expect(actions).toContain('proxy.start_failed')
  })

  it('lee las últimas líneas del log', async () => {
    const db = await setup()
    const dir = manifestsDir({ demo: baseManifest })
    syncProxyCatalog(db, dir, now)
    const logs = mkdtempSync(join(tmpdir(), 'qabase-logs-'))
    writeFileSync(join(logs, 'demo.log'), 'uno\ndos\ntres\n')
    const service = (
      await listProxies(db, { inspector: inspectorWith([]), now })
    ).services[0]!
    expect(getProxyLogs(db, service.id, logs, 2)).toEqual({
      lines: ['dos', 'tres'],
    })
  })
})

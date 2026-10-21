import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ProxyListResponse,
  ProxyLogsResponse,
  ProxyRoute,
  ProxyServiceView,
  ProxySettings,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent } from '../../core/audit'
import { conflict, invalidInput, notFound } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import type { Actor } from '../identity/actor'
import {
  findRouteAccess,
  findRuntime,
  findService,
  findSettings,
  listAllowlistRows,
  listPortRows,
  listRouteRows,
  listRuntimeRows,
  listServiceRows,
  replaceAllowlist,
  saveRuntime,
  saveSettings,
  type RuntimeRow,
  type ServiceRow,
} from './repository'
import {
  createSystemProcessInspector,
  defaultHealthCheck,
  inspectService,
  selectRelevantListeners,
  type ProcessInspector,
  type ProxyHealthCheck,
} from './process'
import {
  allowlistPathFor,
  createSystemProcessController,
  logPathFor,
  readLogTail,
  writeAllowlistFile,
  type ProxyProcessController,
} from './control'
import {
  normalizeAllowlist,
  validateHost,
  validateVersion,
} from './validation'

export function getProxySettings(db: DatabaseSync): ProxySettings {
  return findSettings(db) ?? { host: null, version: null }
}

function audit(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  entityType: string,
  id: number,
  now: Date,
  before: unknown,
  after: unknown,
): void {
  insertAuditEvent(
    db,
    {
      actorAccountId: actor.id,
      actorUsername: actor.username,
      channel: 'app',
      module: 'proxies',
      entityType,
      entityId: String(id),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

export function updateProxySettings(
  db: DatabaseSync,
  actor: Actor,
  input: UpdateProxySettingsInput & { now: Date },
): ProxySettings {
  const host = validateHost(input.host)
  if (input.version !== undefined) {
    validateVersion(input.version)
  }
  return inTransaction(db, () => {
    const before = getProxySettings(db)
    if (!saveSettings(db, host, input.version, input.now.toISOString())) {
      throw conflict()
    }
    const after = getProxySettings(db)
    audit(
      db,
      actor,
      'proxy.settings_updated',
      'proxy_settings',
      1,
      input.now,
      before,
      after,
    )
    return after
  })
}

function mapRoute(
  db: DatabaseSync,
  route: ReturnType<typeof listRouteRows>[number],
): ProxyRoute {
  const access = route.accessId ? findRouteAccess(db, route.accessId) : undefined
  return {
    id: route.id,
    path: route.path,
    target: route.target,
    detail: route.detail,
    access: access
      ? {
          id: access.id,
          address: access.address,
          port: access.port,
          portEnd: access.portEnd,
          environment: access.environment,
          detail: access.detail,
          isActive: access.isActive === 1,
        }
      : null,
  }
}

export type ListProxiesOptions = {
  inspector?: ProcessInspector
  healthCheck?: ProxyHealthCheck
  now?: Date
}

export async function listProxies(
  db: DatabaseSync,
  options: ListProxiesOptions = {},
): Promise<ProxyListResponse> {
  const settings = getProxySettings(db)
  const services = listServiceRows(db)
  const ports = listPortRows(db)
  const routes = listRouteRows(db)
  const allowlists = listAllowlistRows(db)
  const runtimes = new Map(
    listRuntimeRows(db).map((row) => [row.serviceId, row] as const),
  )
  const inspector = options.inspector ?? createSystemProcessInspector()
  const healthCheck = options.healthCheck ?? defaultHealthCheck
  const now = options.now ?? new Date()
  const bindHost = settings.host ?? '0.0.0.0'
  const allPorts = [...new Set(ports.map((row) => row.port))]
  const listeners = await inspector.listListeners(allPorts)
  const listening = new Set(listeners.map((listener) => listener.port))
  const alive = new Map<number, boolean>()
  for (const [serviceId, runtime] of runtimes) {
    if (runtime.pid) {
      alive.set(serviceId, await inspector.isProcessAlive(runtime.pid))
    }
  }

  const views: ProxyServiceView[] = []
  for (const service of services) {
    const servicePorts = ports
      .filter((row) => row.serviceId === service.id)
      .map((row) => ({
        port: row.port,
        isPrimary: row.isPrimary === 1,
        listening: listening.has(row.port),
      }))
    const runtime: RuntimeRow | undefined = runtimes.get(service.id)
    const serviceRuntime = await inspectService({
      service,
      ports: ports.filter((row) => row.serviceId === service.id),
      runtime,
      listeners,
      alive: alive.get(service.id) ?? false,
      now,
      bindHost,
      healthCheck,
      canBindPort: (host, port) => inspector.canBindPort(host, port),
    })
    views.push({
      id: service.id,
      slug: service.slug,
      name: service.name,
      environment: service.environment,
      protocol: service.protocol,
      healthPath: service.healthPath,
      isActive: service.isActive === 1,
      routes: routes
        .filter((route) => route.serviceId === service.id)
        .map((route) => mapRoute(db, route)),
      ports: servicePorts,
      allowlist: allowlists
        .filter((row) => row.serviceId === service.id)
        .map((row) => row.cidr),
      runtime: serviceRuntime,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    })
  }

  return { settings, services: views }
}

export function requireService(db: DatabaseSync, id: number) {
  const service = findService(db, id)
  if (!service) {
    throw notFound('El servicio de proxy no existe.')
  }
  return service
}

export type ProxyControlOptions = {
  proxiesPath: string
  logsPath: string
  inspector: ProcessInspector
  controller: ProxyProcessController
  healthCheck?: ProxyHealthCheck
  now: Date
}

const serviceLocks = new Map<number, Promise<unknown>>()

/**
 * Serializa iniciar/detener/reiniciar por servicio. Sin esto, dos peticiones
 * simultáneas pueden lanzar dos procesos o pisar el PID guardado.
 */
async function withServiceLock<T>(
  id: number,
  work: () => Promise<T>,
): Promise<T> {
  const previous = serviceLocks.get(id) ?? Promise.resolve()
  const run = previous.then(work, work)
  serviceLocks.set(
    id,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

function isManagedCommand(
  service: ServiceRow,
  commandLine: string,
): boolean {
  const marker = `scripts/proxies/${service.slug}/${service.entry}`
  return commandLine.replaceAll('\\', '/').includes(marker)
}

type ProxyViewOptions = {
  inspector: ProcessInspector
  healthCheck?: ProxyHealthCheck
  now: Date
}

async function serviceView(
  db: DatabaseSync,
  id: number,
  options: ProxyViewOptions,
): Promise<ProxyServiceView> {
  const response = await listProxies(db, {
    inspector: options.inspector,
    healthCheck: options.healthCheck,
    now: options.now,
  })
  const service = response.services.find((item) => item.id === id)
  if (!service) {
    throw notFound('El servicio de proxy no existe.')
  }
  return service
}

function servicePorts(db: DatabaseSync, serviceId: number) {
  return listPortRows(db).filter((row) => row.serviceId === serviceId)
}

async function waitForPortsReleased(
  inspector: ProcessInspector,
  ports: readonly number[],
  bindHost: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listeners = await inspector.listListeners(ports)
    if (selectRelevantListeners(listeners, bindHost).length === 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

function markRuntimeError(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions,
  message: string,
): void {
  inTransaction(db, () => {
    saveRuntime(
      db,
      id,
      {
        pid: null,
        startedAt: null,
        startedByQabase: false,
        lastExitCode: null,
        lastError: message,
      },
      options.now.toISOString(),
    )
    audit(db, actor, 'proxy.start_failed', 'proxy', id, options.now, undefined, {
      error: message,
    })
  })
}

function markStopError(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions,
  message: string,
  runtime: RuntimeRow | undefined,
): void {
  inTransaction(db, () => {
    saveRuntime(
      db,
      id,
      {
        pid: runtime?.pid ?? null,
        startedAt: runtime?.startedAt ?? null,
        startedByQabase: runtime?.startedByQabase === 1,
        lastExitCode: null,
        lastError: message,
      },
      options.now.toISOString(),
    )
    audit(db, actor, 'proxy.stop_failed', 'proxy', id, options.now, undefined, {
      error: message,
    })
  })
}

async function startProxyUnlocked(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions,
): Promise<ProxyServiceView> {
  const service = requireService(db, id)
  if (service.isActive !== 1) {
    throw conflict('El servicio está desactivado.')
  }
  const ports = servicePorts(db, id)
  if (ports.length === 0) {
    throw conflict('El servicio no tiene puertos configurados.')
  }
  const bindHost = getProxySettings(db).host ?? '0.0.0.0'
  const listeners = await options.inspector.listListeners(
    ports.map((row) => row.port),
  )
  const runtime = findRuntime(db, id)
  const relevant = selectRelevantListeners(
    listeners,
    bindHost,
    runtime?.pid ?? null,
  )
  if (relevant.length > 0) {
    throw conflict('El servicio ya está activo.')
  }
  if (listeners.length > 0) {
    let blockedPort: number | null = null
    for (const row of ports) {
      if (!(await options.inspector.canBindPort(bindHost, row.port))) {
        blockedPort = row.port
        break
      }
    }
    if (blockedPort !== null) {
      const blocker = listeners.find(
        (listener) => listener.port === blockedPort,
      )
      throw conflict(
        `El puerto ${blockedPort} está ocupado por ${
          blocker?.processName || 'otro proceso'
        }.`,
      )
    }
  }

  if (
    runtime?.pid &&
    runtime.startedByQabase === 1 &&
    (await options.inspector.isProcessAlive(runtime.pid))
  ) {
    const info = await options.inspector.describeProcess(runtime.pid)
    if (info && isManagedCommand(service, info.commandLine)) {
      throw conflict(
        'El proceso sigue vivo aunque aún no escuche. Deténlo antes de iniciar otro.',
      )
    }
  }

  const serviceDir = join(options.proxiesPath, service.slug)
  const entryPath = join(serviceDir, service.entry)
  if (!existsSync(entryPath)) {
    throw notFound(`No existe ${service.slug}/${service.entry}.`)
  }
  const primaryPort =
    ports.find((row) => row.isPrimary === 1)?.port ?? ports[0]!.port
  let allowlistFile: string | undefined
  if (service.protocol === 'tcp') {
    allowlistFile = allowlistPathFor(options.logsPath, service.slug)
    writeAllowlistFile(
      allowlistFile,
      listAllowlistRows(db)
        .filter((row) => row.serviceId === service.id)
        .map((row) => row.cidr),
    )
  }
  let pid: number
  try {
    const started = await options.controller.start({
      serviceDir,
      entry: service.entry,
      ports: ports.map((row) => row.port),
      primaryPort,
      logFile: logPathFor(options.logsPath, service.slug),
      host: bindHost,
      allowlistFile,
    })
    pid = started.pid
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo iniciar el proceso.'
    markRuntimeError(db, actor, id, options, message)
    throw conflict('No se pudo iniciar el servicio.')
  }

  try {
    inTransaction(db, () => {
      saveRuntime(
        db,
        id,
        {
          pid,
          startedAt: options.now.toISOString(),
          startedByQabase: true,
          lastExitCode: null,
          lastError: null,
        },
        options.now.toISOString(),
      )
      audit(
        db,
        actor,
        'proxy.started',
        'proxy',
        id,
        options.now,
        undefined,
        { pid, ports: ports.map((row) => row.port) },
      )
    })
  } catch (error) {
    await options.controller.stop(pid).catch(() => undefined)
    throw error
  }
  return serviceView(db, id, options)
}

async function stopProxyUnlocked(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions & { confirmExternal?: boolean },
): Promise<ProxyServiceView> {
  const service = requireService(db, id)
  const ports = servicePorts(db, id)
  const runtime = findRuntime(db, id)
  const bindHost = getProxySettings(db).host ?? '0.0.0.0'
  const listeners = await options.inspector.listListeners(
    ports.map((row) => row.port),
  )
  const relevant = selectRelevantListeners(
    listeners,
    bindHost,
    runtime?.pid ?? null,
  )

  if (relevant.length === 0) {
    if (
      runtime?.pid &&
      runtime.startedByQabase === 1 &&
      (await options.inspector.isProcessAlive(runtime.pid))
    ) {
      const info = await options.inspector.describeProcess(runtime.pid)
      if (!info || !isManagedCommand(service, info.commandLine)) {
        throw conflict(
          'No se pudo verificar que el proceso sea el proxy esperado; no se detiene.',
        )
      }
      try {
        await options.controller.stop(runtime.pid)
        await waitForPortsReleased(
          options.inspector,
          ports.map((row) => row.port),
          bindHost,
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'No se pudo detener el proceso.'
        markStopError(db, actor, id, options, message, runtime)
        throw conflict('No se pudo detener el servicio.')
      }
    }
    inTransaction(db, () => {
      saveRuntime(
        db,
        id,
        {
          pid: null,
          startedAt: null,
          startedByQabase: false,
          lastExitCode: 0,
          lastError: null,
        },
        options.now.toISOString(),
      )
      audit(
        db,
        actor,
        'proxy.stopped',
        'proxy',
        id,
        options.now,
        { pid: runtime?.pid ?? null },
        { status: 'stopped' },
      )
    })
    return serviceView(db, id, options)
  }

  const node = relevant[0]!
  if (node.pid <= 0) {
    throw conflict(
      `El puerto ${node.port} está ocupado por un proceso no identificado; no se detiene.`,
    )
  }

  const managed =
    runtime?.pid === node.pid && runtime.startedByQabase === 1
  if (!managed && !options.confirmExternal) {
    throw conflict(
      'El servicio fue iniciado fuera de QABase. Confirma para detenerlo.',
    )
  }

  try {
    await options.controller.stop(node.pid)
    await waitForPortsReleased(
      options.inspector,
      ports.map((row) => row.port),
      bindHost,
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo detener el proceso.'
    markStopError(db, actor, id, options, message, runtime)
    throw conflict('No se pudo detener el servicio.')
  }

  inTransaction(db, () => {
    saveRuntime(
      db,
      id,
      {
        pid: null,
        startedAt: null,
        startedByQabase: false,
        lastExitCode: 0,
        lastError: null,
      },
      options.now.toISOString(),
    )
    audit(
      db,
      actor,
      'proxy.stopped',
      'proxy',
      id,
      options.now,
      { pid: node.pid, managed },
      { status: 'stopped' },
    )
  })
  return serviceView(db, id, options)
}

export function startProxy(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions,
): Promise<ProxyServiceView> {
  return withServiceLock(id, () => startProxyUnlocked(db, actor, id, options))
}

export function stopProxy(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions & { confirmExternal?: boolean },
): Promise<ProxyServiceView> {
  return withServiceLock(id, () => stopProxyUnlocked(db, actor, id, options))
}

export function restartProxy(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  options: ProxyControlOptions & { confirmExternal?: boolean },
): Promise<ProxyServiceView> {
  return withServiceLock(id, async () => {
    const ports = servicePorts(db, id)
    const bindHost = getProxySettings(db).host ?? '0.0.0.0'
    const listeners = await options.inspector.listListeners(
      ports.map((row) => row.port),
    )
    const runtime = findRuntime(db, id)
    const relevant = selectRelevantListeners(
      listeners,
      bindHost,
      runtime?.pid ?? null,
    )
    const alive =
      runtime?.pid !== null &&
      runtime?.pid !== undefined &&
      (await options.inspector.isProcessAlive(runtime.pid))
    if (relevant.length > 0 || alive) {
      await stopProxyUnlocked(db, actor, id, options)
    }
    const view = await startProxyUnlocked(db, actor, id, options)
    audit(
      db,
      actor,
      'proxy.restarted',
      'proxy',
      id,
      options.now,
      undefined,
      { pid: view.runtime.pid },
    )
    return view
  })
}

export function getProxyLogs(
  db: DatabaseSync,
  id: number,
  logsPath: string,
  lines: number,
): ProxyLogsResponse {
  const service = requireService(db, id)
  return {
    lines: readLogTail(logPathFor(logsPath, service.slug), lines),
  }
}

export type ProxyAllowlistOptions = ProxyViewOptions & {
  logsPath: string
}

export async function updateProxyAllowlist(
  db: DatabaseSync,
  actor: Actor,
  id: number,
  cidrs: string[],
  options: ProxyAllowlistOptions,
): Promise<ProxyServiceView> {
  const service = requireService(db, id)
  if (service.protocol !== 'tcp') {
    throw invalidInput('La allowlist solo aplica a servicios TCP.')
  }
  const normalized = normalizeAllowlist(cidrs)
  const before = listAllowlistRows(db)
    .filter((row) => row.serviceId === id)
    .map((row) => row.cidr)
  inTransaction(db, () => {
    replaceAllowlist(db, id, normalized)
    audit(
      db,
      actor,
      'proxy.allowlist_updated',
      'proxy',
      id,
      options.now,
      { allowlist: before },
      { allowlist: normalized },
    )
  })
  writeAllowlistFile(allowlistPathFor(options.logsPath, service.slug), normalized)
  return serviceView(db, id, options)
}

export function systemProxyDependencies() {
  return {
    inspector: createSystemProcessInspector(),
    controller: createSystemProcessController(),
    healthCheck: defaultHealthCheck,
  }
}

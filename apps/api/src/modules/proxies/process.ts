import { execFile } from 'node:child_process'
import { connect, createServer } from 'node:net'
import { promisify } from 'node:util'
import type { ProxyHealth, ProxyStatus } from '@qabase/shared'
import type { PortRow, RuntimeRow, ServiceRow } from './repository'

const execFileAsync = promisify(execFile)

export type PortListener = {
  port: number
  address: string
  pid: number
  processName: string
  commandLine: string
}

export type ProcessInfo = {
  pid: number
  processName: string
  commandLine: string
}

export interface ProcessInspector {
  listListeners(ports: readonly number[]): Promise<PortListener[]>
  isProcessAlive(pid: number): Promise<boolean>
  describeProcess(pid: number): Promise<ProcessInfo | null>
  canBindPort(host: string, port: number): Promise<boolean>
}

export type ProxyHealthCheck = (
  host: string,
  port: number,
  path: string,
) => Promise<boolean>

/**
 * Un listener cuenta si está enlazado exactamente a la interfaz configurada o
 * pertenece al proceso que QABase lanzó. Esto evita confundir los espejos
 * `0.0.0.0`/IPv6 de Docker/WSL con el proxy real.
 */
export function selectRelevantListeners(
  listeners: readonly PortListener[],
  bindHost: string,
  runtimePid: number | null = null,
): PortListener[] {
  const exact = listeners.filter((listener) => listener.address === bindHost)
  if (exact.length > 0) {
    return exact
  }
  if (runtimePid !== null) {
    const managed = listeners.filter((listener) => listener.pid === runtimePid)
    if (managed.length > 0) {
      return managed
    }
  }
  if (bindHost === '0.0.0.0') {
    return listeners.filter((listener) => !listener.address.includes(':'))
  }
  return []
}

export function canBindPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true))
    })
  })
}

export type ServiceRuntime = {
  status: ProxyStatus
  pid: number | null
  managed: boolean
  health: ProxyHealth
  detail: string | null
  startedAt: string | null
}

function parseLocalAddress(
  value: string,
): { host: string; port: number } | null {
  const text = value.trim()
  if (text === '') {
    return null
  }
  const separator = text.lastIndexOf(':')
  if (separator <= 0) {
    return null
  }
  const rawHost = text.slice(0, separator)
  const host =
    rawHost.startsWith('[') && rawHost.endsWith(']')
      ? rawHost.slice(1, -1)
      : rawHost
  const port = Number(text.slice(separator + 1))
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null
  }
  return { host, port }
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (value: boolean) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function listWindowsListeners(
  ports: readonly number[],
): Promise<PortListener[]> {
  const { stdout } = await execFileAsync('netstat', ['-ano'], {
    timeout: 5000,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  })
  const wanted = new Set(ports)
  const rows: PortListener[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (
      parts.length < 5 ||
      parts[0] !== 'TCP' ||
      parts[3] !== 'LISTENING'
    ) {
      continue
    }
    const local = parseLocalAddress(parts[1]!)
    if (!local || !wanted.has(local.port)) {
      continue
    }
    const pid = Number(parts[4])
    if (!Number.isInteger(pid) || pid <= 0) {
      continue
    }
    rows.push({
      port: local.port,
      address: local.host,
      pid,
      processName: '',
      commandLine: '',
    })
  }
  return rows
}

export function createSystemProcessInspector(): ProcessInspector {
  return {
    async listListeners(ports) {
      if (ports.length === 0) {
        return []
      }
      if (process.platform === 'win32') {
        try {
          return await listWindowsListeners(ports)
        } catch {
          // Si netstat falla, se degrada a comprobación de puerto.
        }
      }
      const listeners: PortListener[] = []
      for (const port of ports) {
        if (await probePort(port)) {
          listeners.push({
            port,
            address: '127.0.0.1',
            pid: 0,
            processName: '',
            commandLine: '',
          })
        }
      }
      return listeners
    },
    async isProcessAlive(pid) {
      if (!Number.isInteger(pid) || pid <= 0) {
        return false
      }
      try {
        process.kill(pid, 0)
        return true
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM'
      }
    },
    async canBindPort(host, port) {
      return canBindPort(host, port)
    },
    async describeProcess(pid) {
      if (!Number.isInteger(pid) || pid <= 0) {
        return null
      }
      if (process.platform !== 'win32') {
        return null
      }
      try {
        const script = `
$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue
if ($p) {
  [pscustomobject]@{
    pid = [int]$p.ProcessId
    processName = [string]$p.Name
    commandLine = [string]$p.CommandLine
  } | ConvertTo-Json -Compress
}
`
        const { stdout } = await execFileAsync(
          'powershell.exe',
          [
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            script,
          ],
          { timeout: 5000, windowsHide: true, maxBuffer: 64 * 1024 },
        )
        const text = stdout.trim()
        if (text === '') {
          return null
        }
        const parsed = JSON.parse(text) as ProcessInfo
        return {
          pid: Number(parsed.pid),
          processName: String(parsed.processName ?? ''),
          commandLine: String(parsed.commandLine ?? ''),
        }
      } catch {
        return null
      }
    },
  }
}

export async function defaultHealthCheck(
  host: string,
  port: number,
  path: string,
): Promise<boolean> {
  const target = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host
  try {
    const response = await fetch(`http://${target}:${port}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(1500),
    })
    return response.status >= 200 && response.status < 400
  } catch {
    return false
  }
}

export type InspectServiceInput = {
  service: ServiceRow
  ports: PortRow[]
  runtime: RuntimeRow | undefined
  listeners: PortListener[]
  alive: boolean
  now: Date
  bindHost: string
  healthCheck: ProxyHealthCheck
  canBindPort: (host: string, port: number) => Promise<boolean>
}

export async function inspectService(
  input: InspectServiceInput,
): Promise<ServiceRuntime> {
  const {
    service,
    ports,
    runtime,
    listeners,
    alive,
    now,
    bindHost,
    healthCheck,
    canBindPort,
  } = input
  const expectedPorts = new Set(ports.map((row) => row.port))
  const serviceListeners = listeners.filter((listener) =>
    expectedPorts.has(listener.port),
  )

  if (serviceListeners.length === 0) {
    const startedAt = runtime?.startedAt ?? null
    if (runtime?.pid && !alive) {
      return {
        status: 'error',
        pid: runtime.pid,
        managed: runtime.startedByQabase === 1,
        health: 'skipped',
        detail: 'El proceso terminó.',
        startedAt,
      }
    }
    if (startedAt !== null) {
      const elapsed = now.getTime() - Date.parse(startedAt)
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 15000) {
        return {
          status: 'starting',
          pid: runtime?.pid ?? null,
          managed: runtime?.startedByQabase === 1,
          health: 'skipped',
          detail: 'El proceso está arrancando.',
          startedAt,
        }
      }
    }
    if (runtime?.lastError) {
      return {
        status: 'error',
        pid: runtime?.pid ?? null,
        managed: runtime?.startedByQabase === 1,
        health: 'skipped',
        detail: runtime.lastError,
        startedAt,
      }
    }
    return {
      status: 'stopped',
      pid: null,
      managed: false,
      health: 'skipped',
      detail: null,
      startedAt,
    }
  }

  const relevant = selectRelevantListeners(
    serviceListeners,
    bindHost,
    runtime?.pid ?? null,
  )

  if (relevant.length === 0) {
    const blocker = serviceListeners[0]!
    const startedAt = runtime?.startedAt ?? null
    if (runtime?.pid && alive && startedAt !== null) {
      const elapsed = now.getTime() - Date.parse(startedAt)
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 15000) {
        return {
          status: 'starting',
          pid: runtime.pid,
          managed: runtime.startedByQabase === 1,
          health: 'skipped',
          detail: 'El proceso está arrancando.',
          startedAt,
        }
      }
    }
    if (await canBindPort(bindHost, blocker.port)) {
      return {
        status: 'stopped',
        pid: null,
        managed: false,
        health: 'skipped',
        detail: null,
        startedAt,
      }
    }
    return {
      status: 'conflict',
      pid: blocker.pid > 0 ? blocker.pid : null,
      managed: false,
      health: 'skipped',
      detail: `El puerto ${blocker.port} está ocupado por ${
        blocker.processName || `el PID ${blocker.pid}`
      }.`,
      startedAt,
    }
  }

  const portsWithRelevant = new Set(relevant.map((item) => item.port))
  const missing = [...expectedPorts].filter(
    (port) => !portsWithRelevant.has(port),
  )
  if (missing.length > 0) {
    const startedAt = runtime?.startedAt ?? null
    const elapsed =
      startedAt === null
        ? Number.POSITIVE_INFINITY
        : now.getTime() - Date.parse(startedAt)
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 15000) {
      return {
        status: 'starting',
        pid: relevant[0]!.pid > 0 ? relevant[0]!.pid : null,
        managed: runtime?.startedByQabase === 1,
        health: 'skipped',
        detail: `Esperando el puerto ${missing[0]}.`,
        startedAt,
      }
    }
    return {
      status: 'error',
      pid: relevant[0]!.pid > 0 ? relevant[0]!.pid : null,
      managed: runtime?.startedByQabase === 1,
      health: 'skipped',
      detail: `Sin listener en el puerto ${missing[0]}.`,
      startedAt,
    }
  }

  const listener = relevant[0]!
  const managed =
    runtime?.pid === listener.pid && runtime.startedByQabase === 1
  const primary =
    ports.find((row) => row.isPrimary === 1)?.port ?? ports[0]!.port

  if (service.healthPath) {
    const healthy = await healthCheck(bindHost, primary, service.healthPath)
    return {
      status: healthy ? 'active' : 'error',
      pid: listener.pid > 0 ? listener.pid : null,
      managed,
      health: healthy ? 'up' : 'down',
      detail: healthy ? null : 'El health del proxy no responde.',
      startedAt: runtime?.startedAt ?? null,
    }
  }

  return {
    status: 'active',
    pid: listener.pid > 0 ? listener.pid : null,
    managed,
    health: 'skipped',
    detail: null,
    startedAt: runtime?.startedAt ?? null,
  }
}

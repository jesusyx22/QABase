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
  canBindPort(port: number): Promise<boolean>
}

export function canBindPort(port: number, host = '0.0.0.0'): Promise<boolean> {
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

const WINDOWS_INSPECT_SCRIPT = (ports: readonly number[]) => `
$ports = @(${ports.join(',')})
$conns = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $ports -contains $_.LocalPort })
$pids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
$procs = @(Get-CimInstance Win32_Process |
  Where-Object { $pids -contains $_.ProcessId })
$result = @(foreach ($c in $conns) {
  $p = $procs | Where-Object { $_.ProcessId -eq $c.OwningProcess } |
    Select-Object -First 1
  [pscustomobject]@{
    port = [int]$c.LocalPort
    address = [string]$c.LocalAddress
    pid = [int]$c.OwningProcess
    processName = [string]$p.Name
    commandLine = [string]$p.CommandLine
  }
})
$result | ConvertTo-Json -Compress
`

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
  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      WINDOWS_INSPECT_SCRIPT(ports),
    ],
    { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 },
  )
  const text = stdout.trim()
  if (text === '') {
    return []
  }
  const parsed = JSON.parse(text) as
    | PortListener
    | PortListener[]
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.map((row) => ({
    port: Number(row.port),
    address: String(row.address ?? ''),
    pid: Number(row.pid),
    processName: String(row.processName ?? ''),
    commandLine: String(row.commandLine ?? ''),
  }))
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
          // Si PowerShell falla, se degrada a comprobación de puerto.
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
    async canBindPort(port) {
      return canBindPort(port)
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
  port: number,
  path: string,
): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
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
  healthCheck: (port: number, path: string) => Promise<boolean>
  canBindPort: (port: number) => Promise<boolean>
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

  const nodeListeners = serviceListeners.filter((listener) =>
    /^node(\.exe)?$/i.test(listener.processName),
  )

  if (nodeListeners.length === 0) {
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
    if (await canBindPort(blocker.port)) {
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
      detail: `El puerto ${blocker.port} lo ocupa ${blocker.processName || 'un proceso no identificado'}.`,
      startedAt,
    }
  }

  const portsWithNode = new Set(nodeListeners.map((item) => item.port))
  const missing = [...expectedPorts].filter((port) => !portsWithNode.has(port))
  if (missing.length > 0) {
    const startedAt = runtime?.startedAt ?? null
    const elapsed =
      startedAt === null ? Number.POSITIVE_INFINITY : now.getTime() - Date.parse(startedAt)
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 15000) {
      return {
        status: 'starting',
        pid: nodeListeners[0]!.pid > 0 ? nodeListeners[0]!.pid : null,
        managed: runtime?.startedByQabase === 1,
        health: 'skipped',
        detail: `Esperando el puerto ${missing[0]}.`,
        startedAt,
      }
    }
    return {
      status: 'conflict',
      pid: nodeListeners[0]!.pid > 0 ? nodeListeners[0]!.pid : null,
      managed: runtime?.startedByQabase === 1,
      health: 'skipped',
      detail: `Sin proceso Node en el puerto ${missing[0]}.`,
      startedAt,
    }
  }

  const listener = nodeListeners[0]!
  const marker = `scripts/proxies/${service.slug}/${service.entry}`
  const normalizedCommand = listener.commandLine.replaceAll('\\', '/')
  const managed = normalizedCommand.includes(marker)
  const primary =
    ports.find((row) => row.isPrimary === 1)?.port ?? ports[0]!.port

  if (service.healthPath) {
    const healthy = await healthCheck(primary, service.healthPath)
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

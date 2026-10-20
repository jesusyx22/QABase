import { execFile, spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  statSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_LOG_BYTES = 5 * 1024 * 1024

export type StartProcessInput = {
  serviceDir: string
  entry: string
  ports: number[]
  primaryPort: number
  logFile: string
}

export interface ProxyProcessController {
  start(input: StartProcessInput): Promise<{ pid: number }>
  stop(pid: number): Promise<void>
}

function rotateLog(logFile: string): void {
  if (!existsSync(logFile)) {
    return
  }
  try {
    if (statSync(logFile).size < MAX_LOG_BYTES) {
      return
    }
    const previous = `${logFile}.1`
    if (existsSync(previous)) {
      renameSync(previous, `${previous}.old`)
    }
    renameSync(logFile, previous)
  } catch {
    // Si no se puede rotar, se sigue anexando al archivo actual.
  }
}

export function logPathFor(logsPath: string, slug: string): string {
  return join(logsPath, `${slug}.log`)
}

export function readLogTail(logFile: string, lines: number): string[] {
  if (!existsSync(logFile)) {
    return []
  }
  const limit = Math.min(Math.max(Math.trunc(lines), 1), 500)
  const maxBytes = 256 * 1024
  let fd: number | undefined
  try {
    fd = openSync(logFile, 'r')
    const size = fstatSync(fd).size
    const start = Math.max(0, size - maxBytes)
    const buffer = Buffer.alloc(size - start)
    readSync(fd, buffer, 0, buffer.length, start)
    const text = buffer.toString('utf8')
    const rows = text.split(/\r?\n/)
    if (start > 0) {
      rows.shift()
    }
    return rows.filter(Boolean).slice(-limit)
  } catch {
    return []
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
}

export function createSystemProcessController(): ProxyProcessController {
  return {
    async start(input) {
      mkdirSync(input.serviceDir, { recursive: true })
      mkdirSync(dirname(input.logFile), { recursive: true })
      rotateLog(input.logFile)

      const logFd = openSync(input.logFile, 'a')
      const entryPath = join(input.serviceDir, input.entry)
      return await new Promise<{ pid: number }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [entryPath, ...input.ports.map(String)],
          {
            cwd: input.serviceDir,
            detached: true,
            windowsHide: true,
            stdio: ['ignore', logFd, logFd],
            env: {
              ...process.env,
              PORT: String(input.primaryPort),
            },
          },
        )
        let settled = false
        const fail = (error: Error) => {
          if (settled) return
          settled = true
          closeSync(logFd)
          reject(error)
        }
        child.once('error', fail)
        child.once('spawn', () => {
          if (settled || !child.pid) {
            fail(new Error('No se pudo obtener el PID del proxy.'))
            return
          }
          settled = true
          closeSync(logFd)
          child.unref()
          resolve({ pid: child.pid })
        })
      })
    },
    async stop(pid) {
      if (process.platform === 'win32') {
        try {
          await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
            timeout: 10000,
            windowsHide: true,
          })
        } catch (error) {
          const code = (error as { code?: number | string }).code
          const stderr = String(
            (error as { stderr?: string }).stderr ?? '',
          ).toLowerCase()
          const notFound =
            code === 128 ||
            stderr.includes('not found') ||
            stderr.includes('no se encontr')
          if (!notFound) {
            throw error
          }
        }
        return
      }

      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        process.kill(pid, 'SIGTERM')
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          // El proceso ya terminó.
        }
      }
    },
  }
}

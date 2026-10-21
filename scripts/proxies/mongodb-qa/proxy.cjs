const fs = require('fs')
const net = require('net')
const path = require('path')

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'service.json'), 'utf8'),
)
const PORT = Number(process.env.PORT || manifest.primaryPort)
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0'
const ALLOWLIST_FILE = process.env.ALLOWLIST_FILE || ''

const target = new URL(manifest.routes[0].target)
const TARGET_HOST = target.hostname
const TARGET_PORT = Number(target.port || 27017)

function normalizeIp(value) {
  if (!value) return ''
  return value.startsWith('::ffff:') ? value.slice(7) : value
}

function ipv4ToInt(value) {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const number = Number(part)
    if (number < 0 || number > 255) return null
    result = (result << 8) | number
  }
  return result >>> 0
}

function parseCidr(value) {
  const [address, prefixText] = String(value).trim().split('/')
  const base = ipv4ToInt(address)
  if (base === null) return null
  const prefix = prefixText === undefined ? 32 : Number(prefixText)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return { base: (base & mask) >>> 0, mask }
}

function isAllowed(ip, cidrs) {
  const numeric = ipv4ToInt(ip)
  if (numeric === null) return false
  for (const cidr of cidrs) {
    const parsed = parseCidr(cidr)
    if (parsed && ((numeric & parsed.mask) >>> 0) === parsed.base) {
      return true
    }
  }
  return false
}

function readAllowlist() {
  if (!ALLOWLIST_FILE) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8'))
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.cidrs)) return parsed.cidrs
    return []
  } catch {
    return []
  }
}

const server = net.createServer((client) => {
  const source = normalizeIp(client.remoteAddress)
  const cidrs = readAllowlist()
  if (!isAllowed(source, cidrs)) {
    console.warn(
      `[${new Date().toISOString()}] DENY ${source} -> ${TARGET_HOST}:${TARGET_PORT}`,
    )
    client.destroy()
    return
  }

  const upstream = net.connect(
    { host: TARGET_HOST, port: TARGET_PORT },
    () => {
      console.log(
        `[${new Date().toISOString()}] ALLOW ${source} -> ${TARGET_HOST}:${TARGET_PORT}`,
      )
      client.setNoDelay(true)
      upstream.setNoDelay(true)
      client.pipe(upstream)
      upstream.pipe(client)
    },
  )

  upstream.on('error', (error) => {
    console.error(
      `[${new Date().toISOString()}] TARGET_ERROR ${source}: ${error.message}`,
    )
    client.destroy()
    upstream.destroy()
  })
  client.on('error', () => {
    upstream.destroy()
  })
  client.on('close', () => {
    upstream.destroy()
  })
  upstream.on('close', () => {
    client.destroy()
  })
})

server.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] LISTEN_ERROR ${error.message}`)
  process.exitCode = 1
})

server.listen(PORT, BIND_HOST, () => {
  console.log(
    `MongoDB QA proxy escuchando en ${BIND_HOST}:${PORT} -> ${TARGET_HOST}:${TARGET_PORT}`,
  )
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

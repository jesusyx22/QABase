const http = require('http')
const https = require('https')
const os = require('os')
const { readFileSync } = require('fs')
const { join } = require('path')

const manifest = JSON.parse(
  readFileSync(join(__dirname, 'service.json'), 'utf8'),
)
const PORT = Number(process.env.PORT || manifest.primaryPort || 3500)

function writeJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(body))
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, ChannelIdentification, MessageIdentification, OriginatorIdentificationNumber',
  )
}

function matchingRoute(url) {
  var pathname = url.split('?')[0]
  return manifest.routes
    .filter(function (route) {
      return pathname === route.path || pathname.startsWith(route.path + '/')
    })
    .sort(function (a, b) {
      return b.path.length - a.path.length
    })[0]
}

function joinPaths(base, path) {
  if (!base || base === '/') return path
  return base.replace(/\/$/, '') + path
}

const server = http.createServer(function (req, res) {
  cors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/bridge-health') {
    writeJson(res, 200, {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
    return
  }

  const route = matchingRoute(req.url)
  if (!route) {
    writeJson(res, 404, {
      error: 'Not Found',
      message: 'The requested path is not mapped in this bridge.',
      path: req.url,
    })
    return
  }

  const target = new URL(route.target)
  const clientIp = req.socket.remoteAddress || 'unknown'
  const headers = Object.assign({}, req.headers)
  headers.host = target.host
  headers['x-forwarded-for'] = req.headers['x-forwarded-for']
    ? req.headers['x-forwarded-for'] + ', ' + clientIp
    : clientIp
  headers['x-forwarded-proto'] = 'http'
  headers['x-forwarded-host'] = req.headers.host || ''

  const transport = target.protocol === 'https:' ? https : http
  const proxyReq = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: joinPaths(target.pathname, req.url),
      method: req.method,
      headers: headers,
      timeout: 30000,
      rejectUnauthorized: false,
    },
    function (targetRes) {
      res.writeHead(targetRes.statusCode, targetRes.headers)
      targetRes.pipe(res)
      console.log(
        '[' + new Date().toLocaleTimeString() + '] ' + req.method + ' ' + req.url + ' -> ' + targetRes.statusCode,
      )
    },
  )

  proxyReq.on('timeout', function () {
    proxyReq.destroy()
    if (!res.headersSent) {
      writeJson(res, 504, {
        error: 'Gateway Timeout',
        message: 'El destino ' + route.target + ' no respondió a tiempo.',
      })
    }
  })

  proxyReq.on('error', function (error) {
    console.error(
      '[' + new Date().toLocaleTimeString() + '] Error ' + req.url + ': ' + error.message,
    )
    if (!res.headersSent) {
      writeJson(res, 502, {
        error: 'Bad Gateway',
        message: 'No se pudo conectar con ' + route.target + '.',
      })
    }
  })

  req.pipe(proxyReq)
})

server.listen(PORT, '0.0.0.0', function () {
  console.log('Proxy Sentinel escuchando en 0.0.0.0:' + PORT)
  const interfaces = os.networkInterfaces()
  Object.keys(interfaces).forEach(function (name) {
    interfaces[name].forEach(function (iface) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log('- http://' + iface.address + ':' + PORT)
      }
    })
  })
})

server.on('error', function (error) {
  console.error('[Error] ' + error.message)
  process.exitCode = 1
})

function shutdown() {
  server.close(function () {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

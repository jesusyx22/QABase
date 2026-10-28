const http = require('http');

const TARGET_HOST = process.env.TARGET_HOST || '10.5.83.150';
const TARGET_PORT = parseInt(process.env.TARGET_PORT || '16686', 10);
const cliPorts = process.argv.slice(2).map(p => parseInt(p, 10)).filter(p => !isNaN(p));
const PORTS = cliPorts.length > 0 ? cliPorts : [16687];
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';
// Las consultas de trazas largas pueden tardar; el resto de proxies usa 60s.
const TIMEOUT_MS = 120000;

function requestHandler(clientReq, clientRes) {
    const startTime = Date.now();
    const clientIp = clientReq.socket.remoteAddress
        ? clientReq.socket.remoteAddress.replace(/^.*:/, '')
        : 'desconocida';
    const hostHeader = clientReq.headers.host || 'localhost';

    const forwardHeaders = { ...clientReq.headers };
    forwardHeaders['x-forwarded-for'] = clientReq.headers['x-forwarded-for']
        ? `${clientReq.headers['x-forwarded-for']}, ${clientIp}`
        : clientIp;
    forwardHeaders['x-forwarded-host'] = hostHeader;
    forwardHeaders['x-forwarded-proto'] = 'http';
    forwardHeaders['host'] = `${TARGET_HOST}:${TARGET_PORT}`;

    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: clientReq.url,
        method: clientReq.method,
        headers: forwardHeaders,
        timeout: TIMEOUT_MS
    };

    const proxyReq = http.request(options, (targetRes) => {
        const resHeaders = { ...targetRes.headers };

        // Jaeger no deberia redirigir a su IP interna, pero si lo hace se reescribe al host publico.
        if (resHeaders['location']) {
            resHeaders['location'] = resHeaders['location'].replace(
                new RegExp(`https?:\\/\\/${TARGET_HOST}(?::${TARGET_PORT})?`, 'gi'),
                `http://${hostHeader}`
            );
        }

        if (resHeaders['set-cookie']) {
            resHeaders['set-cookie'] = resHeaders['set-cookie'].map(cookie =>
                cookie.replace(new RegExp(`domain=${TARGET_HOST};?`, 'gi'), '')
            );
        }

        clientRes.writeHead(targetRes.statusCode, resHeaders);
        targetRes.pipe(clientRes);

        const duration = Date.now() - startTime;
        console.log(`[${new Date().toLocaleTimeString()}] ${clientIp} -> ${clientReq.method} ${clientReq.url} [${targetRes.statusCode}] (${duration}ms)`);
    });

    proxyReq.on('timeout', () => {
        console.error(`[${new Date().toLocaleTimeString()}] TIMEOUT: ${clientReq.method} ${clientReq.url} tras ${TIMEOUT_MS}ms`);
        proxyReq.destroy();
        if (!clientRes.headersSent) {
            clientRes.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`504 Gateway Timeout: ${TARGET_HOST}:${TARGET_PORT} no respondio a tiempo.`);
        }
    });

    proxyReq.on('error', (err) => {
        console.error(`[${new Date().toLocaleTimeString()}] ERROR [${clientReq.url}]: ${err.message}`);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`502 Bad Gateway: no se pudo conectar con http://${TARGET_HOST}:${TARGET_PORT}/ (${err.message})`);
        }
    });

    clientReq.pipe(proxyReq);
}

console.log('='.repeat(65));
console.log(` REVERSE PROXY ACTIVO PARA: http://${TARGET_HOST}:${TARGET_PORT}/`);
console.log('='.repeat(65));

for (const port of PORTS) {
    const server = http.createServer(requestHandler);

    server.listen(port, BIND_HOST, () => {
        console.log(`[OK] Escuchando en http://${BIND_HOST}:${port}/`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Aviso] Puerto ${port} ya esta en uso por otro proceso (omitido).`);
        } else {
            console.error(`[Error] Puerto ${port}: ${err.message}`);
        }
    });
}

console.log('\nDeten el servicio desde QABase o con Ctrl + C.');

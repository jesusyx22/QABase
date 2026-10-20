const http = require('http');

const TARGET_HOST = '10.20.22.50';
const TARGET_PORT = 80;
const PORTS = [80, 8080]; // Listen on both 80 and 8080

function requestHandler(clientReq, clientRes) {
    const clientIp = clientReq.socket.remoteAddress || 'unknown';
    const hostHeader = clientReq.headers.host || 'localhost';

    // 1. Redirect root to Mantis login to avoid static index.html hardcoded IP
    if (clientReq.url === '/' || clientReq.url === '/index.html') {
        console.log(`[${new Date().toLocaleTimeString()}] Redirecting root to /SistemaMantis/login_page.php for ${clientIp}`);
        clientRes.writeHead(302, {
            'Location': '/SistemaMantis/login_page.php',
            'Content-Type': 'text/plain'
        });
        clientRes.end('Redirecting to Mantis...');
        return;
    }

    // 2. Prepare forward headers
    const forwardHeaders = { ...clientReq.headers };
    forwardHeaders['x-forwarded-for'] = clientReq.headers['x-forwarded-for']
        ? `${clientReq.headers['x-forwarded-for']}, ${clientIp}`
        : clientIp;
    forwardHeaders['x-forwarded-host'] = hostHeader;
    forwardHeaders['x-forwarded-proto'] = 'http';

    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: clientReq.url,
        method: clientReq.method,
        headers: forwardHeaders,
        timeout: 30000
    };

    const proxyReq = http.request(options, (targetRes) => {
        const resHeaders = { ...targetRes.headers };

        // Rewrite Location header if target redirects with absolute URL containing TARGET_HOST
        if (resHeaders['location']) {
            resHeaders['location'] = resHeaders['location'].replace(
                new RegExp(`http://${TARGET_HOST}(?::${TARGET_PORT})?`, 'gi'),
                `http://${hostHeader}`
            );
        }

        // Rewrite cookie domains if necessary
        if (resHeaders['set-cookie']) {
            resHeaders['set-cookie'] = resHeaders['set-cookie'].map(cookie =>
                cookie.replace(new RegExp(`domain=${TARGET_HOST};?`, 'gi'), '')
            );
        }

        clientRes.writeHead(targetRes.statusCode, resHeaders);
        targetRes.pipe(clientRes);

        console.log(`[${new Date().toLocaleTimeString()}] ${clientReq.method} ${clientReq.url} -> ${targetRes.statusCode}`);
    });

    proxyReq.on('timeout', () => {
        console.error(`[${new Date().toLocaleTimeString()}] Timeout requesting ${clientReq.url}`);
        proxyReq.destroy();
        if (!clientRes.headersSent) {
            clientRes.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end('504 Gateway Timeout: El servidor destino 10.20.22.50 no respondió a tiempo.');
        }
    });

    proxyReq.on('error', (err) => {
        console.error(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`502 Bad Gateway: No se pudo conectar a 10.20.22.50 (${err.message})`);
        }
    });

    clientReq.pipe(proxyReq);
}

// Start listeners
for (const port of PORTS) {
    const server = http.createServer(requestHandler);
    server.listen(port, '0.0.0.0', () => {
        console.log(`> Reverse Proxy activo escuchando en 0.0.0.0:${port}`);
    });
    server.on('error', (err) => {
        console.warn(`[Aviso] No se pudo escuchar en el puerto ${port}: ${err.message}`);
    });
}

const http = require('http');
const net = require('net');

// ==========================================
// CONFIGURACIÓN DEL PROXY REVERSO
// ==========================================
const TARGET_HOST = process.env.TARGET_HOST || '10.5.5.201';
const TARGET_PORT = parseInt(process.env.TARGET_PORT || '80', 10);

// Puertos donde intentará escuchar (configurable por argumento o variable de entorno)
// Si el puerto 80 está ocupado (ej. por Mantis u otro servicio), el proxy continuará en el 8081
const DEFAULT_PORTS = [8081, 80];
const cliPorts = process.argv.slice(2).map(p => parseInt(p, 10)).filter(p => !isNaN(p));
const PORTS = cliPorts.length > 0 ? cliPorts : DEFAULT_PORTS;
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

/**
 * Manejador de peticiones HTTP estándar
 */
function requestHandler(clientReq, clientRes) {
    const startTime = Date.now();
    const clientIp = clientReq.socket.remoteAddress ? clientReq.socket.remoteAddress.replace(/^.*:/, '') : 'desconocida';
    const hostHeader = clientReq.headers.host || 'localhost';

    // Preparar encabezados para reenviar
    const forwardHeaders = { ...clientReq.headers };
    
    forwardHeaders['x-forwarded-for'] = clientReq.headers['x-forwarded-for']
        ? `${clientReq.headers['x-forwarded-for']}, ${clientIp}`
        : clientIp;
    forwardHeaders['x-forwarded-host'] = hostHeader;
    forwardHeaders['x-forwarded-proto'] = 'http';
    // Mantenemos el Host enviado por el cliente para que GitLab/aplicación genere URLs acordes
    forwardHeaders['host'] = hostHeader;

    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: clientReq.url,
        method: clientReq.method,
        headers: forwardHeaders,
        timeout: 60000 // 60 segundos de timeout
    };

    const proxyReq = http.request(options, (targetRes) => {
        const resHeaders = { ...targetRes.headers };

        // 1. Reescribir redirecciones 301/302 si apuntan directamente a la IP interna inaccesible
        if (resHeaders['location']) {
            resHeaders['location'] = resHeaders['location'].replace(
                new RegExp(`https?:\\/\\/${TARGET_HOST}(?::${TARGET_PORT})?`, 'gi'),
                `http://${hostHeader}`
            );
        }

        // 2. Reescribir dominios de cookies si vinieran fijados a la IP destino
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
        const duration = Date.now() - startTime;
        console.error(`[${new Date().toLocaleTimeString()}] TIMEOUT: ${clientReq.method} ${clientReq.url} tras ${duration}ms`);
        proxyReq.destroy();
        if (!clientRes.headersSent) {
            clientRes.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`504 Gateway Timeout: El servidor destino http://${TARGET_HOST}:${TARGET_PORT}/ no respondió a tiempo.`);
        }
    });

    proxyReq.on('error', (err) => {
        console.error(`[${new Date().toLocaleTimeString()}] ERROR [${clientReq.url}]: ${err.message}`);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`502 Bad Gateway: No se pudo conectar con http://${TARGET_HOST}:${TARGET_PORT}/ (${err.message})`);
        }
    });

    // Reenviar el cuerpo de la petición del cliente (soporta POST, PUT, Git push, uploads, etc.)
    clientReq.pipe(proxyReq);
}

/**
 * Reenvío transparente de WebSockets (HTTP Upgrade)
 */
function upgradeHandler(req, socket, head) {
    console.log(`[${new Date().toLocaleTimeString()}] Conexión WebSocket detectada hacia: ${req.url}`);
    
    const forwardHeaders = { ...req.headers };
    forwardHeaders['x-forwarded-for'] = socket.remoteAddress ? socket.remoteAddress.replace(/^.*:/, '') : '';
    forwardHeaders['x-forwarded-proto'] = 'http';

    const proxySocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
        let reqData = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
        for (const [key, value] of Object.entries(forwardHeaders)) {
            reqData += `${key}: ${value}\r\n`;
        }
        reqData += '\r\n';

        proxySocket.write(reqData);
        if (head && head.length > 0) {
            proxySocket.write(head);
        }

        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
    });

    proxySocket.on('error', (err) => {
        console.error(`[WebSocket Error]: ${err.message}`);
        socket.destroy();
    });

    socket.on('error', () => {
        proxySocket.destroy();
    });
}

// ==========================================
// INICIALIZACIÓN DE SERVIDORES
// ==========================================
const activeServers = [];

console.log('='.repeat(65));
console.log(` REVERSE PROXY ACTIVO PARA: http://${TARGET_HOST}:${TARGET_PORT}/`);
console.log('='.repeat(65));

for (const port of PORTS) {
    const server = http.createServer(requestHandler);
    server.on('upgrade', upgradeHandler);

    server.listen(port, BIND_HOST, () => {
        const portStr = port === 80 ? '' : `:${port}`;
        console.log(`[OK] Escuchando en http://${BIND_HOST}${portStr}/`);
        activeServers.push(server);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Aviso] Puerto ${port} ya está en uso por otro proceso (omitido).`);
        } else {
            console.error(`[Error] Puerto ${port}: ${err.message}`);
        }
    });
}

console.log('\nPresiona Ctrl + C en esta ventana para detener el proxy.');
console.log('='.repeat(65) + '\n');

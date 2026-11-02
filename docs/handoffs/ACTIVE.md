# Handoff activo — QABase

Actualizado: 2026-11-02 15:10 UTC

## Objetivo

Dejar QABase levantándose solo después de reiniciar la PC y publicar
JaegerPayment2 por reverse proxy HTTP.

## Estado

- Rama **`feat/proxy-jaeger-payment2`**; el árbol de trabajo incluye ahora el
  arranque automático (commit pendiente al cerrar este hito).
- **Tarea programada `QABase` registrada** (SYSTEM, disparador *Al iniciar el
  sistema* con 30 s de retardo + comprobación repetida cada 5 minutos).
  Verificada: `LastTaskResult=0`, `node dist/server.js` corriendo como
  `NT AUTHORITY\SYSTEM`, `GET /api/health` → 200 y el vigilante dejando su
  pasada en el log sin lanzar una segunda instancia.
- `npm run verify` en verde tras el cambio (sin tocar código de la app).
- Los proxies están **detenidos**: tras el reinicio nadie los arrancó, así que
  GitLab, Mantis, Sentinel, MongoDB, DocumentDB y Jaeger no escuchan en
  `10.4.24.18`.
- Jaeger, además, apunta a `10.5.83.150:16686`, que responde `ECONNREFUSED`
  desde esta PC.

## Decisiones

- ADR `docs/adr/0015-arranque-automatico-windows.md`: tarea programada como
  SYSTEM, lanzador idempotente, sin compilar en el arranque y sin arrancar
  proxies desde el lanzador.
- Los proxies se siguen arrancando desde la pantalla **Proxies**; si se quiere
  arranque automático, va como columna y migración dentro de la app, no como
  script paralelo.
- Sigue vigente: MongoDB es TCP, proxy transparente, allowlist por servicio.

## Hecho

- `scripts/windows/start-qabase.ps1`: lanzador idempotente con chequeo de
  puerto y de `/api/health`, rotación de log a 5 MB, aviso si el build es más
  antiguo que el código y códigos de salida claros.
- `scripts/windows/install-qabase-task.ps1` y `uninstall-qabase-task.ps1`:
  registro y baja de la tarea, con guardia de elevación y verificación
  posterior.
- Logs separados: `data/logs/qabase.log` (lanzador y vigilante) y
  `data/logs/qabase-app.log` (salida del proceso). Con un solo archivo el
  vigilante no podía escribir: quien redirige la salida lo mantiene abierto.
- Scripts npm `service:install`, `service:uninstall` y `service:start`.
- README con la sección de arranque automático y el ADR 0015.

## Pendiente

- Reiniciar la PC y confirmar en `data/logs/qabase.log` el arranque por
  disparador de sistema (el camino SYSTEM ya se probó a mano).
- Arrancar los proxies desde la UI y comprobar `http://10.4.24.18:16687/`.
- Probar MongoDB y DocumentDB con Compass desde `10.4.24.18` con un usuario de
  solo lectura; ampliar la allowlist con las IPs del equipo QA y poner nombres
  de responsable.
- Rotar las credenciales de administrador que se compartieron fuera del repo.
- No volver a arrancar el antiguo `runner.js` de Mantis mientras QABase gestione
  el servicio.

## Archivos clave

- `scripts/windows/start-qabase.ps1`
- `scripts/windows/install-qabase-task.ps1`
- `scripts/windows/uninstall-qabase-task.ps1`
- `docs/adr/0015-arranque-automatico-windows.md`
- `package.json` (scripts `service:*`)
- `data/logs/qabase.log` y `data/logs/qabase-app.log` (ignorados por Git)

## Verificación

```text
powershell -File scripts\windows\start-qabase.ps1
2026-11-02 14:57:37 Arranque solicitado (raiz=D:\Deploy\QABase puerto=3000).
2026-11-02 14:57:40 OK QABase escuchando en http://127.0.0.1:3000 (pid 30384).

Start-ScheduledTask -TaskName 'QABase'   # desde consola elevada
Task LastRunTime=02/11/2026 10:18:00 LastTaskResult=0 NextRunTime=02/11/2026 10:20:11
Proceso 20368 ejecuta como NT AUTHORITY\SYSTEM ::
  "C:\Program Files\nodejs\node.exe" "D:\Deploy\QABase\apps\api\dist\server.js"
GET /api/health -> 200 {"status":"ok"}

# Pasada del vigilante (disparador de 5 minutos), sin duplicar el proceso
2026-11-02 15:20:13 OK QABase ya respondia en http://127.0.0.1:3000/api/health;
                    no se inicia otro proceso.
```

## Siguiente paso

Reiniciar la PC sin abrir sesión y comprobar que QABase vuelve solo en
`http://127.0.0.1:3000`; después, arrancar los proxies desde la UI.

## Skills sugeridas

`code-review` para el cierre, `web-design-guidelines` para la revisión visual y
`handoff` al terminar.

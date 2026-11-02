# ADR 0015 — Arranque automático de QABase en Windows

- **Estado:** aceptado
- **Fecha:** 2026-11-02
- **Relacionado:** ADR 0001, ADR 0013

## Contexto

QABase es un panel local que el equipo usa a diario contra
`http://127.0.0.1:3000`. Hasta ahora se levantaba a mano (`npm start` o
`npm run dev:api`). Cada reinicio de la PC, o un cierre por corte de energía,
dejaba el panel caído hasta que alguien entraba a la máquina y lo arrancaba.

Restricciones reales de la máquina:

- El API solo escucha en loopback (BE-03, SEG-01); no hay que abrir puertos.
- SQLite con `node:sqlite` en modo WAL: **un solo proceso** puede ser dueño de
  la base, así que no se puede arrancar dos instancias.
- Los proxies (GitLab, Mantis, Sentinel, MongoDB, DocumentDB, Jaeger) se
  operan desde la app, con auditoría y estado en SQLite; su arranque no es
  parte de este ADR.
- La cuenta de despliegue no tiene privilegios de administrador en el uso
  diario; elevarla es una acción puntual y consciente.

## Decisión

1. El arranque es una **tarea programada de Windows** llamada `QABase`, que
   corre como `SYSTEM` (sin sesión abierta) con el disparador *Al iniciar el
   sistema*, 30 s de retardo y una repetición cada 5 minutos que actúa como
   vigilante.
2. La tarea ejecuta `scripts/windows/start-qabase.ps1`, un lanzador
   **idempotente**: si el puerto 3000 ya responde, termina con código 0 sin
   lanzar un segundo proceso.
3. El lanzador arranca `node apps/api/dist/server.js` (un solo proceso sirve
   la SPA y `/api`), con salida a `data/logs/qabase.log` y rotación a 5 MB.
4. El lanzador **no compila**. Si falta el build o es más antiguo que el
   código, lo registra en el log y sale con código 1. Compilar al arrancar
   haría el inicio lento, dependiente de la red y difícil de diagnosticar.
5. La instalación y la baja son scripts del repo (`install-qabase-task.ps1`,
   `uninstall-qabase-task.ps1`) expuestos como `npm run service:install` y
   `npm run service:uninstall`; ambos exigen una sesión elevada.
6. La tarea se puede lanzar a demanda con `Start-ScheduledTask -TaskName
   'QABase'` desde una consola elevada.

## Alternativas descartadas

- **Carpeta de inicio / clave `Run` de HKCU:** solo arranca cuando alguien
  inicia sesión, y la PC puede reiniciarse sin que nadie entre.
- **Servicio de Windows (NSSM, `sc.exe`, WinSW):** añade un binario de terceros
  o un envoltorio propio para un proceso Node que ya funciona; la tarea
  programada cubre el mismo caso sin dependencias nuevas.
- **PM2 u otro supervisor:** otra capa que instalar, con su propio estado y
  logs, fuera del stack del repo.
- **Tarea como el usuario con credenciales guardadas:** obliga a almacenar la
  contraseña de la cuenta y a rotarla cuando cambie.
- **Compilar en el arranque:** el build depende de `node_modules` completos y
  puede fallar sin que nadie lo vea; se compila a propósito, antes de reiniciar.
- **Que el lanzador arranque también los proxies:** duplicaría la lógica de
  `proxies/control.ts` y dejaría procesos fuera de la tabla `proxy_runtime`,
  sin auditoría y con el estado que la UI no sabe gobernar.

## Consecuencias

- Registrar o quitar la tarea exige una consola elevada; una cuenta sin
  privilegios no ve la tarea en `Get-ScheduledTask`.
- El proceso de QABase corre como `SYSTEM` en la sesión 0. Cualquier sesión de
  usuario alcanza `127.0.0.1:3000`, pero para detenerlo o reiniciarlo hay que
  hacerlo desde una consola elevada (`Stop-Process`, `taskkill` o
  `Stop-ScheduledTask`).
- El propietario de los archivos que cree la app pasa a ser `SYSTEM`; las ACL
  heredadas de `D:\Deploy\QABase` ya dan escritura a los usuarios del equipo.
- Si dos instancias compitieran por el puerto, la segunda falla al enlazar y
  el lanzador lo detecta antes: el control es el puerto, no un archivo de
  bloqueo.
- Tras cambiar código hay que ejecutar `npm run build` y reiniciar el proceso;
  el lanzador avisa en el log cuando detecta un build viejo.
- Los proxies siguen arrancándose desde la pantalla **Proxies**; si se quiere
  que también suban solos, la decisión correcta es una columna de arranque
  automático en la app con su migración, no un script paralelo.
- La tarea reintenta hasta 3 veces con 1 minuto de espera si el lanzador falla,
  y no se detiene por batería ni por límite de tiempo de ejecución.

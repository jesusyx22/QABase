# Agente local de Mesa de Ayuda

QABase **no** llama a la web institucional. Este agente corre en el equipo o
teléfono desde donde la web sí es accesible, inicia sesión, lee los tickets
asignados y los envía a QABase por el túnel SSH.

Es de **solo lectura**:

- solo hace `GET` después del login;
- no crea, edita, cierra, asigna ni comenta tickets;
- no descarga ni ejecuta nada del sitio;
- nunca imprime la contraseña ni las cookies.

## Requisitos en Termux

```bash
pkg install python
pip install requests beautifulsoup4
```

## Configuración segura

Crea el archivo local con permisos restringidos:

```bash
mkdir -p ~/.qabase
cp helpdesk.env.example ~/.qabase/helpdesk.env
chmod 600 ~/.qabase/helpdesk.env
nano ~/.qabase/helpdesk.env
```

Completa:

- `HELPDESK_USER` y `HELPDESK_PASSWORD`: tu cuenta de la Mesa de Ayuda.
- `HELPDESK_ASSIGNED_TO`: tu nombre tal como aparece en la columna de analista,
  para no ingerir tickets de otras personas.
- `QABASE_SYNC_TOKEN`: el contenido de `data/sync-token` en el VPS. Léelo allí
  con `cat data/sync-token`; no lo pegues en chats ni en el repositorio.

El agente carga `~/.qabase/helpdesk.env` automáticamente y avisa si los permisos
son demasiado amplios.

## Túnel SSH

En otra sesión de Termux:

```bash
IP=145.223.95.143
ssh -N -L 3000:127.0.0.1:3000 jesusyx@$IP
```

El agente usa `http://127.0.0.1:3000` a través de ese túnel.

## Primer paso: descubrir la estructura

```bash
python helpdesk_agent.py --discover
```

Esto:

- inicia sesión;
- guarda el HTML en `~/.qabase/helpdesk-dump.html` con permisos `0600`;
- muestra formularios, nombres de campos, tablas y cabeceras, **sin valores**;
- lista enlaces candidatos a la bandeja de tickets.

No compartas el HTML completo si contiene datos personales, cookies o tokens.
Comparte solo la lista de cabeceras y la estructura.

## Sincronizar

Cuando la tabla de tickets esté identificada:

```bash
python helpdesk_agent.py --sync
```

El agente envía los tickets a:

```text
POST http://127.0.0.1:3000/api/helpdesk/ingest
X-Sync-Token: <token>
```

QABase valida, hace upsert por referencia y actualiza el estado de
sincronización. Nunca borra tickets locales.

## Si el login o la tabla no se detectan

El agente usa heurísticas porque no conocemos el HTML autenticado. Si `--discover`
no encuentra el formulario o la tabla:

1. Revisa `~/.qabase/helpdesk-dump.html` localmente.
2. Ajusta en `helpdesk.env`:
   - `HELPDESK_USERNAME_FIELD`
   - `HELPDESK_PASSWORD_FIELD`
   - `HELPDESK_TICKETS_URL`
3. Si el sitio exige JavaScript, captcha o un flujo distinto, habrá que añadir
   un adaptador con navegador headless; el agente actual no lo incluye.

## Por qué no corre en el VPS

Desde el VPS, `mesadeayuda.cajalosandes.pe` resuelve pero la conexión TCP a
443/80 expira. Por eso el scraper debe ejecutarse donde la web sea alcanzable
(tu red/Termux) y enviar los datos a QABase por el túnel.

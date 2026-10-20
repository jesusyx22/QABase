# Scripts de proxies

Cada servicio vive en una carpeta con su slug y declara `service.json`.

```text
scripts/proxies/<slug>/
├── service.json
└── proxy.cjs
```

- El `slug` debe coincidir con `^[a-z][a-z0-9-]{0,31}$`.
- `entry` es el archivo que QABase ejecuta con Node dentro de esa carpeta. Usa
  `.cjs` porque el `package.json` raíz declara `"type": "module"`; un `.js` con
  `require` falla como ESM.
- `ports` y `primaryPort` deben ser enteros entre 1 y 65535.
- `routes[].path` empieza con `/`; `routes[].target` es una URL `http(s)`.
- `routes[].access` es opcional y solo sirve para vincular el destino con el
  catálogo de firewall.
- QABase sincroniza este manifiesto al arrancar. No se edita desde la UI.

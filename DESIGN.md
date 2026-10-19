# Diseño

## Principios

1. **Paleta base de dos colores:** azul marino `oklch(0.24 0.045 255)` y blanco/gris neutro. El negro se reserva para texto. Sin azul claro. Los colores semánticos se reservan para estados: verde **Activo**, naranja **por vencer** y rojo **urgente**. No se usan como decoración.
2. El sidebar y las cabeceras de tabla usan azul marino con texto claro, para contrastar con el cuerpo blanco.
3. El estado se comunica con texto, peso, icono y borde; el color distingue **Activo** (verde), **Inactivo** (gris) y el semáforo de vencimientos (naranja/rojo/gris). Nunca se usa solo el color.
4. Máximo 4 KPIs por fila.
5. Cifras con `font-variant-numeric: tabular-nums`.
6. Bordes de 1px; sombras muy sutiles en cards y capas flotantes para separar superficies.
7. **Sin bordes redondeados:** radio 0 en todos los componentes. Esquinas rectas, reglas de 1px y densidad.
8. Sin degradados, glassmorphism, emojis como iconos ni 3D.
9. Movimiento de 120–200ms y respeto a `prefers-reduced-motion`.
10. Contraste mínimo 4.5:1 y foco visible.
11. Toda vista de datos tiene estados: cargando, vacío, error y con datos.
12. El azul marino participa en sidebar, cabeceras de tabla, totales y cabecera móvil; el cuerpo principal sigue claro.

## Navegación y tablas

- Sidebar fijo a la izquierda en escritorio; en pantallas pequeñas se pliega en un menú bajo la cabecera.
- Cabeceras de tabla en azul marino con texto claro, micro-tipografía en mayúsculas y `letter-spacing`.
- Filas alternas con un gris muy sutil (zebra) para escanear tablas largas.
- El ítem activo del sidebar usa un tono más claro del mismo azul marino.
- El foco visible se mantiene también sobre fondo oscuro.

## Referencias

- **IBM Carbon Design System — Data table:** esquinas rectas, cabecera con capa de acento, filas de 40–48px, zebra opcional y cifras tabulares.
- **Dashboards operativos de alta densidad:** reglas de 1px y sombras muy sutiles para separar superficies, etiquetas micro en mayúsculas y jerarquía por contraste, no por decoración.

## Tipografía

- Familia: **IBM Plex Sans Variable**, la familia del sistema Carbon. Transmite un tono corporativo y ejecutivo sin decoración.
- Título de página: 20–24px.
- Título de sección: 14–16px.
- Etiqueta: 12px.
- Cuerpo: 14px.

## Densidad

- Filas de tabla: 36–40px.
- Padding de card: 16–24px.
- Gap entre cards: 16–24px.

## Componentes

- shadcn/ui con preset `base-nova` sobre Base UI.
- Iconos Lucide, tamaño 16px por defecto.
- Botón por defecto `h-8`; acciones destructivas solo con confirmación.
- Formularios con `label` visible; nunca placeholder como única etiqueta.
- Botones, cards, inputs, badges y diálogos con esquinas rectas (radio 0).
- Las cards de módulo llevan un borde izquierdo de 4px: azul marino en reposo, azul de acento al pasar el cursor.
- Las cards son blancas sobre un fondo `--background` ligeramente más oscuro y usan `--shadow-card` para una elevación sutil. No se usan sombras fuertes ni efecto 3D.

## Movimiento

- Duración rápida: **120 ms**; base: **160 ms**. Curva estándar:
  `cubic-bezier(0.2, 0, 0, 1)`.
- Entrada de página: `fade` + desplazamiento vertical de **4 px**.
- Cards de módulo y KPIs clicables: elevación de **0.5 px** y sombra mayor al
  pasar el cursor.
- Botones: color, borde, sombra y transformación. Filas, inputs, selects y tabs:
  solo color.
- No usar `transition: all`, rebotes, parallax, 3D ni animaciones de más de
  200 ms.
- `prefers-reduced-motion: reduce` reduce animaciones y transiciones a 0.01 ms y
  desactiva el scroll suave.

## Superficies y elevación

El patrón es **card-based UI con elevación sutil** (*elevated surfaces*): el fondo general se oscurece un poco, las cards se mantienen blancas y una sombra corta las separa del fondo. No es neumorfismo ni glassmorphism: no hay luces internas, degradados, desenfoques ni bordes dobles.

## Charts

- Máximo 5–7 series.
- Sin doble eje.
- Unidades en el título.
- Barras con base cero.
- Una serie destacada; el resto en gris.

## Estados

- **Cargando:** esqueleto con la forma del contenido, sin spinner de página completa.
- **Vacío:** explicación breve y la acción principal si existe.
- **Error:** mensaje comprensible y opción de reintentar; nunca una traza.
- **Con datos:** tabla o tarjetas, con totales separados por tipo.
- **Activo:** badge con el token semántico `--success` (verde) y fondo tintado.
- **Inactivo:** badge neutro en gris, sin color de estado adicional.
- **Semáforo de vencimientos:** verde `--success` para más de 30 días, naranja `--warning` para 11–30 días y rojo `--danger` para 10 días o menos. Vencido se muestra en gris.
- El color siempre va acompañado de texto (“Vence en 12 días”, “Vencido hace 3 días”).
- Los colores semánticos no se usan para botones, gráficos ni decoración.

## Tema

La versión 1 es solo clara. El sidebar, las cabeceras de tabla, los totales y la cabecera móvil usan azul marino; el resto del cuerpo es claro. Los tokens oscuros existen en `apps/web/src/index.css` pero no se exponen todavía.

## Tokens

```css
:root {
  --background: oklch(0.96 0 0);
  --foreground: oklch(0.20 0 0);
  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.48 0 0);
  --border: oklch(0.90 0 0);
  --primary: oklch(0.24 0.045 255);
  --primary-foreground: oklch(0.99 0 0);
  --destructive: oklch(0.20 0 0);
  --success: oklch(0.45 0.12 150);
  --success-foreground: oklch(0.99 0 0);
  --warning: oklch(0.55 0.14 65);
  --warning-foreground: oklch(0.99 0 0);
  --danger: oklch(0.52 0.18 25);
  --danger-foreground: oklch(0.99 0 0);
  --ring: oklch(0.24 0.045 255);
  --chart-1: oklch(0.24 0.045 255);
  --chart-2: oklch(0.40 0 0);
  --chart-3: oklch(0.55 0 0);
  --chart-4: oklch(0.70 0 0);
  --chart-5: oklch(0.85 0 0);
  --radius: 0px;
  --shadow-card: 0 1px 2px oklch(0.20 0 0 / 0.06), 0 2px 8px oklch(0.20 0 0 / 0.05);
  --duration-fast: 120ms;
  --duration-base: 160ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --sidebar: oklch(0.24 0.045 255);
  --sidebar-foreground: oklch(0.97 0.01 255);
  --sidebar-primary: oklch(0.42 0.06 255);
  --sidebar-accent: oklch(0.33 0.05 255);
  --sidebar-border: oklch(0.36 0.04 255);
  --sidebar-ring: oklch(0.99 0 0);
}
```

## Accesibilidad

- `label` en cada campo y foco visible.
- Navegación completa por teclado.
- Contraste mínimo 4.5:1.
- Los estados se refuerzan con texto, no con color.

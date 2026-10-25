# Diseño

## Principios
1. Un solo acento. Grises neutros + un color de marca.
2. Verde/rojo/ámbar solo para estado, nunca decorativos.
3. Máximo 4 KPIs por fila.
4. Cifras con `font-variant-numeric: tabular-nums`.
5. Bordes de 1px; sombras solo para capas flotantes.
6. Radio 8–12px. Escala de espaciado de 8pt.
7. Sin degradados, glassmorphism, emojis como iconos ni 3D.
8. Movimiento 120–200ms y respetar `prefers-reduced-motion`.
9. Contraste mínimo 4.5:1 y foco visible.
10. Cada vista tiene estados: vacío, cargando y error.

## Jerarquía
- Título de página: 20–24px
- Título de sección: 14–16px
- Etiqueta: 12px
- Cuerpo: 14px

## Densidad
- Filas de tabla: 36–40px
- Padding de card: 16–24px
- Gap entre cards: 16–24px

## Charts
- Máximo 5–7 series.
- Sin doble eje.
- Unidades en el título.
- Barras con base cero.
- Una serie destacada; el resto en gris.

## Tokens
```css
:root {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.20 0 0);
  --muted: oklch(0.96 0 0);
  --border: oklch(0.90 0 0);
  --primary: oklch(0.55 0.16 255);
  --radius: 10px;
}
```

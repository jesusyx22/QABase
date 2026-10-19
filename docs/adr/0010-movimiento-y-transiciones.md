# ADR 0010 — Movimiento rápido y elevación sutil

- **Estado:** aceptado
- **Fecha:** 2026-10-19
- **Relacionado:** `DESIGN.md`, ADR 0008

## Contexto

La interfaz ya tenía transiciones de color en botones, filas y enlaces, pero
carecía de una entrada de página y de una respuesta visual al pasar sobre cards
interactivas. El usuario pidió animaciones y transiciones rápidas, sin convertir
el panel en una interfaz llamativa o lenta.

## Decisión

1. La duración base es **160 ms**; la rápida, **120 ms**. La curva estándar es
   `cubic-bezier(0.2, 0, 0, 1)`.
2. Las páginas entran con un `fade` y un desplazamiento vertical de **4 px**.
3. Las cards de módulo y los KPIs clicables se elevan **0.5 px** y aumentan la
   sombra al pasar el cursor. No se aplica a cards de solo lectura.
4. Los botones transicionan color, borde, sombra y transformación; las filas de
   tabla, inputs, selects y tabs transicionan solo color.
5. No se usa `transition: all`.
6. `prefers-reduced-motion: reduce` reduce animaciones y transiciones a 0.01 ms
   y desactiva el desplazamiento suave.
7. No hay rebotes, parallax, 3D, glassmorphism ni animaciones de más de 200 ms.

## Alternativas descartadas

- **Animaciones lentas o con rebote:** distraen en un panel operativo.
- **Animar todas las cards:** las cards de tablas no son interactivas y el
  movimiento constante añade ruido.
- **Entrada por cada elemento:** multiplica animaciones y puede provocar
  cascadas; una entrada por página es suficiente.
- **Ignorar reduced motion:** incumple accesibilidad.

## Consecuencias

- La navegación se siente más fluida sin retrasar la lectura.
- Los KPIs y las cards de módulo comunican que son interactivos.
- Las tablas y formularios mantienen transiciones discretas.
- Los tests no dependen de tiempos de animación.

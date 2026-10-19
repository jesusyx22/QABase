# ADR 0008 — Superficies elevadas para destacar cards

- **Estado:** aceptado
- **Fecha:** 2026-10-19
- **Relacionado:** `DESIGN.md`

## Contexto

Con el fondo casi blanco (`oklch(0.99 0 0)`) las cards blancas se distinguían
solo por el borde. El usuario pidió destacarlas sutilmente: oscurecer un poco el
fondo general y añadir una sombra suave a las cards, sin convertirlo en un
diseño 3D ni en neumorfismo.

## Decisión

1. El token `--background` pasa de `oklch(0.99 0 0)` a `oklch(0.96 0 0)`.
2. Las cards conservan `--card: oklch(1 0 0)` para mantener el contraste.
3. Se añade el token `--shadow-card` con dos capas muy suaves:
   `0 1px 2px` y `0 2px 8px`, ambas con baja opacidad.
4. El componente `Card` aplica `shadow-card`. Las capas flotantes siguen usando
   sus propias sombras.
5. No se aplican sombras a filas de tabla, botones, inputs ni badges. El efecto
   busca separar superficies, no decorar cada elemento.

## Alternativas descartadas

- **Solo borde de 1px:** era el estado anterior; no separa suficiente las cards
  del fondo.
- **Sombra fuerte o difusa:** rompe la densidad del panel y se acerca al
  neumorfismo.
- **Fondo oscuro completo:** cambia la identidad de la aplicación y reduce el
  contraste del texto.
- **Gradientes o glassmorphism:** prohibidos por `DESIGN.md`.

## Consecuencias

- Las cards y los módulos del panel se leen como superficies elevadas sobre un
  fondo gris muy claro.
- El patrón se documenta como **card-based UI con elevación sutil**.
- Cualquier card nueva que use el componente compartido hereda el mismo efecto.
- El contraste de texto se mantiene porque el cuerpo de las cards sigue blanco.

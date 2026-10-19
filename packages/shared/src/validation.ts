export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 64
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * El nombre de usuario no se recorta (RN-ID-17).
 * La normalización solo sirve para unicidad y búsqueda.
 */
export function isValidUsername(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  )
}

export function normalizeUsername(username: string): string {
  return username.toLowerCase()
}

/**
 * La contraseña no se recorta ni normaliza (RN-ID-20).
 */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  )
}

/**
 * Normalización de búsqueda: minúsculas, conservando tildes y Ñ
 * (BD-44, BD-45, RN-QA-18, RN-CON-17).
 */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase()
}

/**
 * Escapa los comodines de LIKE para que se busquen como texto literal
 * (BD-46). Se usa con `ESCAPE '\'` en SQL.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

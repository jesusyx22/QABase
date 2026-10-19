export const ROLE_NAME_MAX_LENGTH = 100

export function validateRoleName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > ROLE_NAME_MAX_LENGTH) {
    return 'El nombre del rol debe tener entre 1 y 100 caracteres.'
  }
  return null
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 64
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export function validateUsername(value: string): string | null {
  if (
    value.length < USERNAME_MIN_LENGTH ||
    value.length > USERNAME_MAX_LENGTH
  ) {
    return 'El usuario debe tener entre 3 y 64 caracteres.'
  }
  if (!USERNAME_PATTERN.test(value)) {
    return 'El usuario solo admite letras ASCII, números, punto, guion o guion bajo.'
  }
  return null
}

export function validatePassword(value: string): string | null {
  if (
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    return 'La contraseña debe tener entre 12 y 128 caracteres.'
  }
  return null
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (password !== confirmation) {
    return 'La confirmación no coincide con la contraseña.'
  }
  return null
}

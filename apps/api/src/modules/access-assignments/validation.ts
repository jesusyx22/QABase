import { isValidDateOnly } from '@qabase/shared'
import { invalidInput } from '../../core/errors'

export function validateEntityId(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw invalidInput(`${label} inválido.`)
  }
  return value
}

export function validateVersion(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw invalidInput('La versión no es válida.')
  }
  return value
}

export function validateExpiresOn(value: string): string {
  if (typeof value !== 'string' || !isValidDateOnly(value)) {
    throw invalidInput('La fecha de vencimiento debe ser AAAA-MM-DD.')
  }
  return value
}

export function validateCreateExpiresOn(
  value: string,
  today: string,
): string {
  const expiresOn = validateExpiresOn(value)
  if (expiresOn < today) {
    throw invalidInput('La fecha de vencimiento no puede ser anterior a hoy.')
  }
  return expiresOn
}

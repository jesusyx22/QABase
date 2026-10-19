/**
 * Contrato de errores del API (BE-34, BE-35).
 *
 * Este paquete solo contiene tipos, límites y formas compartidas.
 * No accede a datos ni ejecuta lógica de negocio (BE-56).
 */

export * from './access-assignments'
export * from './permissions'
export * from './session'
export * from './validation'

export const API_PREFIX = '/api'

export const ERROR_CODES = [
  'invalid_input',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'too_many_requests',
  'internal',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ApiError = {
  error: {
    code: ErrorCode
    message: string
  }
}

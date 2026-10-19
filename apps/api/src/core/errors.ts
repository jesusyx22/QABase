import type { ErrorCode } from '@qabase/shared'

/**
 * Error de dominio que el manejador global traduce al contrato ApiError.
 * No expone detalles internos en el mensaje.
 */
export class HttpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function invalidInput(message = 'Entrada inválida.'): HttpError {
  return new HttpError('invalid_input', 400, message)
}

export function unauthenticated(
  message = 'Usuario o contraseña incorrectos.',
): HttpError {
  return new HttpError('unauthenticated', 401, message)
}

export function sessionRequired(): HttpError {
  return new HttpError('unauthenticated', 401, 'Debes iniciar sesión.')
}

export function forbidden(message = 'No tienes permiso para esta acción.'): HttpError {
  return new HttpError('forbidden', 403, message)
}

export function notFound(message = 'No encontrado.'): HttpError {
  return new HttpError('not_found', 404, message)
}

export function conflict(message = 'El recurso cambió. Recarga e inténtalo de nuevo.'): HttpError {
  return new HttpError('conflict', 409, message)
}

export function tooManyRequests(
  message = 'Demasiados intentos. Inténtalo de nuevo más tarde.',
): HttpError {
  return new HttpError('too_many_requests', 429, message)
}

import { isIPv4 } from 'node:net'
import { invalidInput } from '../../core/errors'
export { validatePort } from '../accesses/validation'
export { validateEntityId, validateVersion } from '../access-assignments/validation'

export function validateHost(value: string): string {
  const host = value.trim()
  if (!isIPv4(host)) throw invalidInput('La IP global debe ser una IPv4 válida.')
  return host
}
export function validateDetail(value: string): string {
  const detail = value.trim()
  if (!detail || detail.length > 200) throw invalidInput('El detalle debe tener entre 1 y 200 caracteres.')
  return detail
}

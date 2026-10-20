import { isIPv4 } from 'node:net'
import { invalidInput } from '../../core/errors'

export { validateEntityId, validateVersion } from '../access-assignments/validation'

export function validateHost(value: string): string {
  const host = value.trim()
  if (!isIPv4(host)) {
    throw invalidInput('La IP global debe ser una IPv4 válida.')
  }
  return host
}

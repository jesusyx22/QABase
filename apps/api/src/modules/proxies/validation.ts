import { isIPv4 } from 'node:net'
import type { ProxyAllowlistEntry } from '@qabase/shared'
import { invalidInput } from '../../core/errors'

export { validateEntityId, validateVersion } from '../access-assignments/validation'

export function validateHost(value: string): string {
  const host = value.trim()
  if (!isIPv4(host)) {
    throw invalidInput('La IP global debe ser una IPv4 válida.')
  }
  return host
}

function ipv4ToInt(value: string): number | null {
  const parts = value.split('.')
  if (parts.length !== 4) {
    return null
  }
  let result = 0
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
      return null
    }
    const number = Number(part)
    if (number > 255) {
      return null
    }
    result = (result << 8) | number
  }
  return result >>> 0
}

export function normalizeCidr(value: string): string {
  if (typeof value !== 'string') {
    throw invalidInput('Cada entrada de la allowlist debe ser texto.')
  }
  const text = value.trim()
  const [address, prefixText] = text.split('/')
  const base = ipv4ToInt(address ?? '')
  if (base === null) {
    throw invalidInput(
      `La IP o CIDR no es válido: ${text}. Usa IPv4, por ejemplo 10.4.24.18 o 10.4.24.0/24.`,
    )
  }
  const prefix = prefixText === undefined ? 32 : Number(prefixText)
  if (
    !/^\d{1,2}$/.test(prefixText ?? '32') ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    throw invalidInput(`El prefijo CIDR no es válido: ${text}.`)
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const network = (base & mask) >>> 0
  const octets = [
    (network >>> 24) & 255,
    (network >>> 16) & 255,
    (network >>> 8) & 255,
    network & 255,
  ]
  return `${octets.join('.')}/${prefix}`
}

export function normalizeAllowlistEntries(
  entries: ProxyAllowlistEntry[],
): ProxyAllowlistEntry[] {
  if (!Array.isArray(entries)) {
    throw invalidInput('La allowlist debe ser una lista de entradas.')
  }
  if (entries.length > 100) {
    throw invalidInput('La allowlist no puede superar 100 entradas.')
  }
  const seen = new Set<string>()
  const normalized: ProxyAllowlistEntry[] = []
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) {
      throw invalidInput('Cada entrada de la allowlist debe ser un objeto.')
    }
    const cidr = normalizeCidr(entry.cidr)
    if (seen.has(cidr)) {
      throw invalidInput(`La IP o CIDR ${cidr} está repetido en la allowlist.`)
    }
    seen.add(cidr)
    if (typeof entry.label !== 'string') {
      throw invalidInput('Cada entrada de la allowlist necesita un nombre.')
    }
    const label = entry.label.trim()
    if (label.length < 1 || label.length > 80) {
      throw invalidInput('El nombre debe tener entre 1 y 80 caracteres.')
    }
    if (
      [...label].some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      })
    ) {
      throw invalidInput('El nombre contiene caracteres no válidos.')
    }
    normalized.push({ cidr, label })
  }
  return normalized
}

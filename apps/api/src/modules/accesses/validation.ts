import { isIP } from 'node:net'
import { invalidInput } from '../../core/errors'

export type AccessEnvironment =
  | 'development'
  | 'qa'
  | 'production'
  | 'unspecified'
export type AccessProtocol = 'tcp' | 'udp' | 'both'

const ENVIRONMENTS: AccessEnvironment[] = [
  'development',
  'qa',
  'production',
  'unspecified',
]
const PROTOCOLS: AccessProtocol[] = ['tcp', 'udp', 'both']

// Etiquetas internas alineadas con el catálogo de la API.
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase()
}

function isValidCidr(value: string): boolean {
  const separator = value.lastIndexOf('/')
  if (separator <= 0) {
    return false
  }
  const base = value.slice(0, separator)
  const prefixText = value.slice(separator + 1)
  if (!/^\d{1,3}$/.test(prefixText)) {
    return false
  }
  const version = isIP(base)
  const prefix = Number(prefixText)
  if (version === 4) {
    return prefix >= 0 && prefix <= 32
  }
  if (version === 6) {
    return prefix >= 0 && prefix <= 128
  }
  return false
}

export function validateAddress(value: string): {
  address: string
  addressNormalized: string
} {
  const address = value.trim()
  if (address.length < 1 || address.length > 255) {
    throw invalidInput('La dirección debe tener entre 1 y 255 caracteres.')
  }

  const valid =
    isIP(address) !== 0 ||
    isValidCidr(address) ||
    DOMAIN_PATTERN.test(address)

  if (!valid) {
    throw invalidInput(
      'La dirección debe ser IPv4, IPv6, CIDR o un dominio válido.',
    )
  }

  return {
    address,
    addressNormalized: normalizeAddress(address),
  }
}

export function validatePort(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw invalidInput('El puerto debe ser un entero entre 1 y 65535.')
  }
  return value
}

export function validatePortEnd(
  value: number | null | undefined,
  port: number,
): number {
  if (value === undefined || value === null) {
    return port
  }
  const portEnd = validatePort(value)
  if (portEnd < port) {
    throw invalidInput('El puerto final no puede ser menor que el inicial.')
  }
  return portEnd
}

export function validateEnvironment(value: string): AccessEnvironment {
  if (!ENVIRONMENTS.includes(value as AccessEnvironment)) {
    throw invalidInput('El ambiente no es válido.')
  }
  return value as AccessEnvironment
}

export function validateProtocol(
  value: string | null | undefined,
): AccessProtocol | null {
  if (value === undefined || value === null) {
    return null
  }
  if (!PROTOCOLS.includes(value as AccessProtocol)) {
    throw invalidInput('El protocolo no es válido.')
  }
  return value as AccessProtocol
}

export function validateDetail(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const detail = value.trim()
  if (detail === '') {
    return null
  }
  if (detail.length > 200) {
    throw invalidInput('El detalle no puede superar los 200 caracteres.')
  }
  return detail
}

export function validateApplications(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const applications = value.trim()
  if (applications === '') {
    return null
  }
  if (applications.length > 500) {
    throw invalidInput('Las aplicaciones no pueden superar los 500 caracteres.')
  }
  return applications
}

export function validateUrls(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const urls = value.trim()
  if (urls === '') {
    return null
  }
  if (urls.length > 4000) {
    throw invalidInput('Las URLs no pueden superar los 4000 caracteres.')
  }
  return urls
}

export function isAccessEnvironment(value: string): value is AccessEnvironment {
  return ENVIRONMENTS.includes(value as AccessEnvironment)
}

export function isAccessProtocol(value: string): value is AccessProtocol {
  return PROTOCOLS.includes(value as AccessProtocol)
}

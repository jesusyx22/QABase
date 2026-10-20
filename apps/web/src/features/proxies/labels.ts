import {
  ENVIRONMENT_OPTIONS,
  STATUS_OPTIONS,
} from '@/features/accesses/labels'

export { ENVIRONMENT_OPTIONS, STATUS_OPTIONS }

const IPV4_PATTERN =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

export function validateIpv4(value: string): string | null {
  const text = value.trim()
  if (text === '') {
    return 'La dirección IP es obligatoria.'
  }
  if (!IPV4_PATTERN.test(text)) {
    return 'La dirección IP debe ser una IPv4 válida (ej. 192.168.1.50).'
  }
  return null
}

export function validatePort(value: string): string | null {
  const text = value.trim()
  if (!/^\d{1,5}$/.test(text)) {
    return 'El puerto debe ser un entero entre 1 y 65535.'
  }
  const port = Number(text)
  if (port < 1 || port > 65535) {
    return 'El puerto debe ser un entero entre 1 y 65535.'
  }
  return null
}

export function validateDetail(value: string): string | null {
  const text = value.trim()
  if (text.length === 0) {
    return 'El detalle es obligatorio.'
  }
  if (text.length > 200) {
    return 'El detalle no puede superar los 200 caracteres.'
  }
  return null
}

export function formatEndpoint(host: string | null, port: number): string {
  if (!host) {
    return `:${port}`
  }
  return `${host}:${port}`
}

export function proxyStatusLabel(isActive: boolean): string {
  return isActive ? 'Activo' : 'Inactivo'
}

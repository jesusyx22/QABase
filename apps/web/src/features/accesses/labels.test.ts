import { describe, expect, it } from 'vitest'
import {
  describeAccessChange,
  environmentLabel,
  formatPortRange,
  historyActionLabel,
  protocolLabel,
} from './labels'

describe('etiquetas de accesos', () => {
  it('traduce ambientes y protocolos', () => {
    expect(environmentLabel('development')).toBe('Desarrollo')
    expect(environmentLabel('qa')).toBe('QA')
    expect(environmentLabel('production')).toBe('Producción')
    expect(environmentLabel('unspecified')).toBe('Sin clasificar')
    expect(formatPortRange(443, 443)).toBe('443')
    expect(formatPortRange(3000, 3099)).toBe('3000–3099')
    expect(protocolLabel('tcp')).toBe('TCP')
    expect(protocolLabel('both')).toBe('TCP/UDP')
    expect(protocolLabel(null)).toBe('Sin especificar')
  })

  it('traduce las acciones del historial', () => {
    expect(historyActionLabel('access.created')).toBe('Alta')
    expect(historyActionLabel('access.updated')).toBe('Edición')
    expect(historyActionLabel('access.deactivated')).toBe('Desactivado')
    expect(historyActionLabel('access.reactivated')).toBe('Reactivado')
    expect(historyActionLabel('access.unknown')).toBe('access.unknown')
  })

  it('describe los campos cambiados en orden', () => {
    expect(
      describeAccessChange({
        before: {
          address: '10.0.0.1',
          port: 443,
          environment: 'production',
          protocol: 'tcp',
          detail: null,
          isActive: true,
        },
        after: {
          address: 'api.empresa.local',
          port: 8443,
          environment: 'qa',
          protocol: null,
          detail: 'API QA',
          isActive: false,
        },
      }),
    ).toBe(
      'Detalle: — → «API QA»; Dirección: «10.0.0.1» → «api.empresa.local»; Puerto: 443 → 8443; Ambiente: Producción → QA; Protocolo: TCP → Sin especificar; Estado: Activo → Inactivo',
    )
  })

  it('describe solo los campos que cambiaron', () => {
    expect(
      describeAccessChange({
        before: {
          address: '10.0.0.1',
          port: 443,
          environment: 'production',
          protocol: 'tcp',
          detail: 'API anterior',
          isActive: true,
        },
        after: {
          address: '10.0.0.1',
          port: 443,
          environment: 'production',
          protocol: 'tcp',
          detail: 'API nueva',
          isActive: true,
        },
      }),
    ).toBe('Detalle: «API anterior» → «API nueva»')
  })

  it('describe rango, aplicaciones y URLs en el historial', () => {
    expect(
      describeAccessChange({
        before: {
          port: 80,
          portEnd: 80,
          applications: null,
          urls: null,
        },
        after: {
          port: 3000,
          portEnd: 3099,
          applications: 'web-browsing, ssl',
          urls: 'https://example.test/a',
        },
      }),
    ).toBe(
      'Puerto: 80 → 3000; Puerto fin: 80 → 3099; Aplicaciones: — → web-browsing, ssl; URLs / rutas: — → https://example.test/a',
    )
  })

  it('describe el alta con los valores posteriores', () => {
    expect(
      describeAccessChange({
        before: null,
        after: {
          address: '10.0.0.1',
          port: 22,
          isActive: true,
        },
      }),
    ).toBe(
      'Dirección: — → «10.0.0.1»; Puerto: — → 22; Estado: — → Activo',
    )
  })
})

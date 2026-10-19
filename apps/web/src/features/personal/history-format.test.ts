import { describe, expect, it } from 'vitest'
import { describeHistoryChange, historyActionLabel } from './history-format'

describe('historyActionLabel', () => {
  it('traduce las acciones conocidas', () => {
    expect(historyActionLabel('personal.created')).toBe('Alta')
    expect(historyActionLabel('personal.renamed')).toBe('Renombrado')
    expect(historyActionLabel('personal.deactivated')).toBe('Desactivado')
    expect(historyActionLabel('personal.reactivated')).toBe('Reactivado')
  })

  it('conserva una acción desconocida', () => {
    expect(historyActionLabel('personal.imported')).toBe('personal.imported')
  })
})

describe('describeHistoryChange', () => {
  it('muestra el nombre anterior y el nuevo', () => {
    expect(
      describeHistoryChange({
        before: { name: 'Ana' },
        after: { name: 'Ana María' },
      }),
    ).toBe('Nombre: «Ana» → «Ana María»')
  })

  it('traduce el estado de activo a inactivo', () => {
    expect(
      describeHistoryChange({
        before: { isActive: true },
        after: { isActive: false },
      }),
    ).toBe('Estado: Activo → Inactivo')
  })

  it('muestra el alta con los valores previos vacíos', () => {
    expect(
      describeHistoryChange({
        before: null,
        after: { name: 'Nueva', isActive: true },
      }),
    ).toBe('Nombre: — → «Nueva»; Estado: — → Activo')
  })

  it('avisa cuando no hay datos de cambio', () => {
    expect(describeHistoryChange({ before: null, after: null })).toBe(
      'Sin cambios registrados.',
    )
  })
})

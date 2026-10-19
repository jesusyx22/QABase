import { describe, expect, it } from 'vitest'
import {
  addDaysToDateOnly,
  assignmentTiming,
  isValidDateOnly,
  peruToday,
} from './access-assignments'

describe('fechas de asignación', () => {
  it('calcula hoy en America/Lima, no en UTC', () => {
    expect(peruToday(new Date('2026-10-19T04:00:00.000Z'))).toBe('2026-10-18')
    expect(peruToday(new Date('2026-10-19T05:00:00.000Z'))).toBe('2026-10-19')
    expect(peruToday(new Date('2026-10-20T02:00:00.000Z'))).toBe('2026-10-19')
  })

  it('valida fechas reales y suma días sin desfase', () => {
    expect(isValidDateOnly('2026-02-28')).toBe(true)
    expect(isValidDateOnly('2026-02-29')).toBe(false)
    expect(isValidDateOnly('2026-13-01')).toBe(false)
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToDateOnly('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('deriva estado y urgencia con los umbrales acordados', () => {
    const today = '2026-10-19'

    expect(assignmentTiming('2026-10-19', today)).toEqual({
      state: 'expiring',
      urgency: 'critical',
      daysRemaining: 0,
    })
    expect(assignmentTiming('2026-10-29', today)).toEqual({
      state: 'expiring',
      urgency: 'critical',
      daysRemaining: 10,
    })
    expect(assignmentTiming('2026-10-30', today)).toEqual({
      state: 'expiring',
      urgency: 'warning',
      daysRemaining: 11,
    })
    expect(assignmentTiming('2026-11-18', today)).toEqual({
      state: 'expiring',
      urgency: 'warning',
      daysRemaining: 30,
    })
    expect(assignmentTiming('2026-11-19', today)).toEqual({
      state: 'current',
      urgency: 'ok',
      daysRemaining: 31,
    })
    expect(assignmentTiming('2026-10-18', today)).toEqual({
      state: 'expired',
      urgency: 'expired',
      daysRemaining: -1,
    })
  })
})

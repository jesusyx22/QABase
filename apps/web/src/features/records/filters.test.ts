import { describe, expect, it } from 'vitest'
import {
  createDefaultFilters,
  filtersToSearchParams,
  monthRange,
  readFilters,
  recordsQueryString,
} from './filters'

const defaultRange = { from: '2026-10-01', to: '2026-10-31' }

describe('monthRange', () => {
  it('devuelve el mes local completo', () => {
    expect(monthRange(new Date(2026, 9, 18), 0)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })

  it('calcula el mes anterior cruzando el año', () => {
    expect(monthRange(new Date(2026, 0, 15), -1)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })
})

describe('readFilters', () => {
  it('usa el mes local por defecto cuando la URL no trae rango', () => {
    const filters = readFilters(new URLSearchParams(), defaultRange)

    expect(filters).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      all: false,
      qaId: null,
      type: null,
      level: null,
      q: '',
      includeAnnulled: false,
      page: 1,
      pageSize: 25,
    })
  })

  it('lee todos los filtros y todo el historial', () => {
    const filters = readFilters(
      new URLSearchParams(
        'all=1&qaId=3&type=incidencia&level=5&q=Mu%C3%B1oz&includeAnnulled=1&page=2&pageSize=100',
      ),
      defaultRange,
    )

    expect(filters).toMatchObject({
      from: null,
      to: null,
      all: true,
      qaId: 3,
      type: 'incidencia',
      level: 5,
      q: 'Muñoz',
      includeAnnulled: true,
      page: 2,
      pageSize: 100,
    })
  })

  it('acepta un rango abierto por un extremo', () => {
    const filters = readFilters(
      new URLSearchParams('from=2026-01-05'),
      defaultRange,
    )

    expect(filters).toMatchObject({
      from: '2026-01-05',
      to: null,
      all: false,
    })
  })

  it('interpreta un rango explícitamente vacío como todo el historial', () => {
    const filters = readFilters(
      new URLSearchParams('from=&to='),
      defaultRange,
    )

    expect(filters).toMatchObject({ from: null, to: null, all: true })
  })

  it('ignora parámetros inválidos y vuelve a los valores seguros', () => {
    const filters = readFilters(
      new URLSearchParams(
        'from=2026-02-30&to=no-es-fecha&page=0&pageSize=30&level=9&qaId=x&type=otro',
      ),
      defaultRange,
    )

    expect(filters).toMatchObject({
      from: null,
      to: null,
      all: true,
      page: 1,
      pageSize: 25,
      level: null,
      qaId: null,
      type: null,
    })
  })
})

describe('filtersToSearchParams', () => {
  it('omite los valores por defecto', () => {
    const params = filtersToSearchParams(
      createDefaultFilters(defaultRange),
    )

    expect(params.toString()).toBe('from=2026-10-01&to=2026-10-31')
  })

  it('conserva filtros, página y tamaño distintos de 25', () => {
    const params = filtersToSearchParams({
      ...createDefaultFilters(defaultRange),
      qaId: 5,
      type: 'merito',
      level: 2,
      q: 'Muñoz',
      includeAnnulled: true,
      page: 3,
      pageSize: 50,
    })

    expect(params.get('from')).toBe('2026-10-01')
    expect(params.get('to')).toBe('2026-10-31')
    expect(params.get('qaId')).toBe('5')
    expect(params.get('type')).toBe('merito')
    expect(params.get('level')).toBe('2')
    expect(params.get('q')).toBe('Muñoz')
    expect(params.get('includeAnnulled')).toBe('1')
    expect(params.get('page')).toBe('3')
    expect(params.get('pageSize')).toBe('50')
  })

  it('no escribe from/to cuando es todo el historial', () => {
    const params = filtersToSearchParams({
      ...createDefaultFilters(defaultRange),
      all: true,
    })

    expect(params.toString()).toBe('all=1')
  })
})

describe('recordsQueryString', () => {
  it('incluye anulados solo con permiso', () => {
    const filters = {
      ...createDefaultFilters(defaultRange),
      includeAnnulled: true,
    }

    expect(recordsQueryString(filters, false)).not.toContain(
      'includeAnnulled=1',
    )
    expect(recordsQueryString(filters, true)).toContain('includeAnnulled=1')
  })

  it('recorta el texto y omite el filtro vacío', () => {
    const filters = createDefaultFilters(defaultRange)

    expect(recordsQueryString({ ...filters, q: '   ' }, false)).not.toContain(
      'q=',
    )
    expect(
      recordsQueryString({ ...filters, q: '  Muñoz  ' }, false),
    ).toContain('q=Mu%C3%B1oz')
  })

  it('siempre informa página y tamaño de página', () => {
    const query = recordsQueryString(
      createDefaultFilters(defaultRange),
      false,
    )

    expect(query).toBe(
      'from=2026-10-01&to=2026-10-31&page=1&pageSize=25',
    )
  })
})

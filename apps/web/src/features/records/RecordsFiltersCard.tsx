import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  monthRange,
  parseRecordType,
  type RecordsFilters,
} from './filters'
import type { QaOption } from './types'

const TYPE_ITEMS = [
  { value: 'all', label: 'Todos' },
  { value: 'merito', label: 'Mérito' },
  { value: 'incidencia', label: 'Incidencia' },
]

const LEVEL_ITEMS = [
  { value: 'all', label: 'Todos' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
]

const PAGE_SIZE_ITEMS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

type RecordsFiltersCardProps = {
  filters: RecordsFilters
  todayDate: Date
  canViewAnnulled: boolean
  people: QaOption[]
  optionsLoading: boolean
  onChange: (patch: Partial<RecordsFilters>) => void
  onReset: () => void
}

export function RecordsFiltersCard({
  filters,
  todayDate,
  canViewAnnulled,
  people,
  optionsLoading,
  onChange,
  onReset,
}: RecordsFiltersCardProps) {
  const currentMonth = useMemo(() => monthRange(todayDate, 0), [todayDate])
  const previousMonth = useMemo(() => monthRange(todayDate, -1), [todayDate])

  const qaItems = useMemo(() => {
    const items: Array<{ value: string; label: string }> = [
      { value: 'all', label: 'Todos los QA' },
    ]

    for (const person of people) {
      items.push({
        value: String(person.id),
        label: person.isActive
          ? person.name
          : `${person.name} (inactivo)`,
      })
    }

    if (
      filters.qaId !== null &&
      !people.some((person) => person.id === filters.qaId)
    ) {
      items.push({
        value: String(filters.qaId),
        label: `QA #${filters.qaId}`,
      })
    }

    return items
  }, [people, filters.qaId])

  const isCurrentMonth =
    !filters.all &&
    filters.from === currentMonth.from &&
    filters.to === currentMonth.to
  const isPreviousMonth =
    !filters.all &&
    filters.from === previousMonth.from &&
    filters.to === previousMonth.to

  const changeFrom = (value: string) => {
    const from = value === '' ? null : value
    onChange({ from, all: from === null && filters.to === null })
  }

  const changeTo = (value: string) => {
    const to = value === '' ? null : value
    onChange({ to, all: to === null && filters.from === null })
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Atajos de fecha"
          >
            <Button
              type="button"
              size="sm"
              variant={isCurrentMonth ? 'default' : 'outline'}
              aria-pressed={isCurrentMonth}
              onClick={() =>
                onChange({
                  from: currentMonth.from,
                  to: currentMonth.to,
                  all: false,
                })
              }
            >
              Mes actual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isPreviousMonth ? 'default' : 'outline'}
              aria-pressed={isPreviousMonth}
              onClick={() =>
                onChange({
                  from: previousMonth.from,
                  to: previousMonth.to,
                  all: false,
                })
              }
            >
              Mes anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filters.all ? 'default' : 'outline'}
              aria-pressed={filters.all}
              onClick={() => onChange({ from: null, to: null, all: true })}
            >
              Todo el historial
            </Button>
          </div>

          <Button type="button" size="sm" variant="ghost" onClick={onReset}>
            Restablecer filtros
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="records-from">Desde</Label>
            <Input
              id="records-from"
              name="records-from"
              type="date"
              autoComplete="off"
              value={filters.from ?? ''}
              onChange={(event) => changeFrom(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="records-to">Hasta</Label>
            <Input
              id="records-to"
              name="records-to"
              type="date"
              autoComplete="off"
              value={filters.to ?? ''}
              onChange={(event) => changeTo(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="records-qa">QA</Label>
            <Select
              id="records-qa"
              name="records-qa"
              autoComplete="off"
              items={qaItems}
              value={filters.qaId === null ? 'all' : String(filters.qaId)}
              disabled={optionsLoading && people.length === 0}
              onValueChange={(value) => {
                if (value === null) {
                  return
                }
                if (value === 'all') {
                  onChange({ qaId: null })
                  return
                }
                const qaId = Number(value)
                if (Number.isInteger(qaId) && qaId >= 1) {
                  onChange({ qaId })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qaItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="records-type">Tipo</Label>
            <Select
              id="records-type"
              name="records-type"
              autoComplete="off"
              items={TYPE_ITEMS}
              value={filters.type ?? 'all'}
              onValueChange={(value) => {
                if (value === null) {
                  return
                }
                onChange({ type: parseRecordType(value) })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="records-level">Nivel</Label>
            <Select
              id="records-level"
              name="records-level"
              autoComplete="off"
              items={LEVEL_ITEMS}
              value={filters.level === null ? 'all' : String(filters.level)}
              onValueChange={(value) => {
                if (value === null) {
                  return
                }
                if (value === 'all') {
                  onChange({ level: null })
                  return
                }
                const level = Number(value)
                if (Number.isInteger(level) && level >= 1 && level <= 5) {
                  onChange({ level })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="records-text">Texto del detalle</Label>
            <Input
              id="records-text"
              name="records-q"
              type="search"
              autoComplete="off"
              maxLength={5000}
              placeholder="Buscar en el detalle…"
              value={filters.q}
              onChange={(event) => onChange({ q: event.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="records-page-size">Registros por página</Label>
            <Select
              id="records-page-size"
              name="records-page-size"
              autoComplete="off"
              items={PAGE_SIZE_ITEMS}
              value={String(filters.pageSize)}
              onValueChange={(value) => {
                if (value === null) {
                  return
                }
                const pageSize = Number(value)
                if (
                  pageSize === 25 ||
                  pageSize === 50 ||
                  pageSize === 100
                ) {
                  onChange({ pageSize })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canViewAnnulled ? (
            <div className="flex items-center gap-2 self-end pb-1.5">
              <Checkbox
                id="records-annulled"
                name="records-annulled"
                checked={filters.includeAnnulled}
                onCheckedChange={(checked) =>
                  onChange({ includeAnnulled: checked })
                }
              />
              <Label htmlFor="records-annulled">Incluir anulados</Label>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

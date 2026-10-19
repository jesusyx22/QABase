import { useMemo, useState, type FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/format'
import { createRecord, updateRecord } from './api'
import type {
  ImpactLevel,
  QaOption,
  RecordType,
  RecordView,
  UpdateRecordInput,
} from './types'

const TYPE_ITEMS = [
  { value: 'merito', label: 'Mérito' },
  { value: 'incidencia', label: 'Incidencia' },
]

type RecordFormDialogProps = {
  mode: 'create' | 'edit'
  record: RecordView | null
  people: QaOption[]
  levels: ImpactLevel[]
  peopleLoading: boolean
  levelsLoading: boolean
  today: string
  onClose: () => void
  onSaved: (message: string) => void
}

function parseTypeValue(value: string): RecordType {
  return value === 'incidencia' ? 'incidencia' : 'merito'
}

export function RecordFormDialog({
  mode,
  record,
  people,
  levels,
  peopleLoading,
  levelsLoading,
  today,
  onClose,
  onSaved,
}: RecordFormDialogProps) {
  const [qaId, setQaId] = useState(
    record === null ? '' : String(record.qa.id),
  )
  const [type, setType] = useState<RecordType>(record?.type ?? 'merito')
  const [eventDate, setEventDate] = useState(record?.eventDate ?? today)
  const [level, setLevel] = useState(String(record?.level ?? 1))
  const [detail, setDetail] = useState(record?.detail ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const qaOptions = useMemo(() => {
    const byId = new Map<number, QaOption>()

    for (const person of people) {
      if (person.isActive) {
        byId.set(person.id, person)
      }
    }

    if (record !== null) {
      byId.set(record.qa.id, {
        id: record.qa.id,
        name: record.qa.name,
        isActive: record.qa.isActive,
      })
    }

    return [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
    )
  }, [people, record])

  const qaItems = useMemo(
    () =>
      qaOptions.map((person) => ({
        value: String(person.id),
        label: person.isActive
          ? person.name
          : `${person.name} (inactivo)`,
      })),
    [qaOptions],
  )

  const levelOptions = levels.filter((item) => item.type === type)
  const levelItems = levelOptions.map((item) => ({
    value: String(item.level),
    label: `${item.level}. ${item.label}`,
  }))

  if (
    record !== null &&
    type === record.type &&
    !levelItems.some((item) => item.value === String(record.level))
  ) {
    levelItems.push({
      value: String(record.level),
      label: `${record.level}. ${record.levelLabel}`,
    })
  }

  const validate = (): string | null => {
    if (qaId === '') {
      return 'Selecciona un QA.'
    }

    const selectedQa = qaOptions.find(
      (person) => person.id === Number(qaId),
    )
    if (record === null) {
      if (!selectedQa || !selectedQa.isActive) {
        return 'Selecciona un QA activo.'
      }
    } else if (
      Number(qaId) !== record.qa.id &&
      (!selectedQa || !selectedQa.isActive)
    ) {
      return 'Selecciona un QA activo.'
    }

    if (eventDate === '') {
      return 'La fecha del hecho es obligatoria.'
    }
    if (eventDate > today) {
      return 'La fecha no puede ser futura.'
    }

    const levelNumber = Number(level)
    if (
      !Number.isInteger(levelNumber) ||
      levelNumber < 1 ||
      levelNumber > 5
    ) {
      return 'El nivel debe estar entre 1 y 5.'
    }

    const cleanDetail = detail.trim()
    if (cleanDetail.length < 1 || cleanDetail.length > 5000) {
      return 'El detalle debe tener entre 1 y 5000 caracteres.'
    }

    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validation = validate()
    if (validation !== null) {
      setError(validation)
      return
    }

    const cleanDetail = detail.trim()
    const levelNumber = Number(level)

    setSubmitting(true)
    try {
      if (mode === 'edit' && record !== null) {
        const updates: UpdateRecordInput = { version: record.version }
        let hasChanges = false

        if (Number(qaId) !== record.qa.id) {
          updates.qaId = Number(qaId)
          hasChanges = true
        }
        if (type !== record.type) {
          updates.type = type
          hasChanges = true
        }
        if (eventDate !== record.eventDate) {
          updates.eventDate = eventDate
          hasChanges = true
        }
        if (levelNumber !== record.level) {
          updates.level = levelNumber
          hasChanges = true
        }
        if (cleanDetail !== record.detail) {
          updates.detail = cleanDetail
          hasChanges = true
        }

        if (!hasChanges) {
          setError('No hay cambios para guardar.')
          return
        }

        await updateRecord(record.id, updates)
        onSaved('Registro actualizado.')
      } else {
        await createRecord({
          qaId: Number(qaId),
          type,
          eventDate,
          level: levelNumber,
          detail: cleanDetail,
        })
        onSaved('Registro creado.')
      }
    } catch (caught) {
      setError(
        errorMessage(caught, 'No se pudo guardar el registro.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const submitDisabled =
    submitting ||
    levelItems.length === 0 ||
    (mode === 'create' && qaOptions.length === 0)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuevo registro' : 'Editar registro'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Registra un mérito o una incidencia de una persona activa del catálogo.'
              : 'Corrige los datos del registro. El QA actual puede conservarse aunque esté inactivo.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="record-qa">QA</Label>
              <Select
                id="record-qa"
                name="record-qa"
                autoComplete="off"
                items={qaItems}
                value={qaId === '' ? null : qaId}
                disabled={qaOptions.length === 0}
                onValueChange={(value) => {
                  if (value !== null) {
                    setQaId(value)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      peopleLoading
                        ? 'Cargando QA…'
                        : 'Selecciona un QA…'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {qaItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!peopleLoading && qaOptions.length === 0 ? (
                <p className="text-xs text-destructive">
                  No hay QAs disponibles. Cierra y reintenta.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="record-type">Tipo</Label>
              <Select
                id="record-type"
                name="record-type"
                autoComplete="off"
                items={TYPE_ITEMS}
                value={type}
                onValueChange={(value) => {
                  if (value !== null) {
                    setType(parseTypeValue(value))
                  }
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
              <Label htmlFor="record-date">Fecha del hecho</Label>
              <Input
                id="record-date"
                name="record-date"
                type="date"
                autoComplete="off"
                max={today}
                value={eventDate}
                aria-describedby="record-date-hint"
                onChange={(event) => setEventDate(event.target.value)}
              />
              <p
                id="record-date-hint"
                className="text-xs text-muted-foreground"
              >
                Fecha real, no futura.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="record-level">Nivel</Label>
              <Select
                id="record-level"
                name="record-level"
                autoComplete="off"
                items={levelItems}
                value={level}
                disabled={levelItems.length === 0}
                onValueChange={(value) => {
                  if (value !== null) {
                    setLevel(value)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      levelsLoading
                        ? 'Cargando niveles…'
                        : 'Selecciona un nivel…'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {levelItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!levelsLoading && levelItems.length === 0 ? (
                <p className="text-xs text-destructive">
                  No se pudieron cargar los niveles. Cierra y reintenta.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="record-detail">Detalle</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {detail.length}/5000
              </span>
            </div>
            <Textarea
              id="record-detail"
              name="record-detail"
              rows={5}
              autoComplete="off"
              maxLength={5000}
              value={detail}
              aria-describedby="record-detail-hint"
              onChange={(event) => setDetail(event.target.value)}
            />
            <p
              id="record-detail-hint"
              className="text-xs text-muted-foreground"
            >
              Entre 1 y 5000 caracteres. Se recortan los espacios de los
              extremos.
            </p>
          </div>

          {error !== null ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {submitting
                ? 'Guardando…'
                : mode === 'create'
                  ? 'Crear registro'
                  : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

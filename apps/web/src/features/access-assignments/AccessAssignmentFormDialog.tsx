import { useEffect, useState, type FormEvent } from 'react'
import { addDaysToDateOnly, peruToday } from '@qabase/shared'
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
import { errorMessage } from '@/lib/format'
import { requestAccesses, type Access } from '@/features/accesses/api'
import { formatPortRange } from '@/features/accesses/labels'
import { requestPeople, type Person } from '@/features/personal/api'
import {
  createAssignment,
  requestPersonAssignments,
  updateAssignment,
  type AssignmentView,
} from './api'
import { environmentLabel } from './labels'

export type AccessAssignmentFormDialogProps = {
  mode: 'create' | 'edit'
  person: { id: number; name: string; isActive: boolean }
  assignment?: AssignmentView
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function AccessAssignmentFormDialog({
  mode,
  person,
  assignment,
  open,
  onOpenChange,
  onSaved,
}: AccessAssignmentFormDialogProps) {
  const isEdit = mode === 'edit'

  const [selectedPersonId, setSelectedPersonId] = useState<number>(
    isEdit && assignment ? assignment.person.id : person.id,
  )
  const [selectedAccessId, setSelectedAccessId] = useState<number | null>(
    isEdit && assignment ? assignment.access.id : null,
  )
  const [expiresOn, setExpiresOn] = useState<string>(
    isEdit && assignment ? assignment.expiresOn : '',
  )
  const [accessSearchInput, setAccessSearchInput] = useState('')
  const [accessSearch, setAccessSearch] = useState('')
  const [assignAnother, setAssignAnother] = useState(false)

  const [accesses, setAccesses] = useState<Access[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [existingAssignments, setExistingAssignments] = useState<
    AssignmentView[]
  >([])

  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [personReloadKey, setPersonReloadKey] = useState(0)
  const today = peruToday()

  // Cargar lista de personas si estamos en modo edición
  useEffect(() => {
    if (isEdit) {
      requestPeople({ includeInactive: false, search: '' })
        .then((result) => setPeople(result))
        .catch(() => setPeople([]))
    }
  }, [isEdit])

  // Cargar asignaciones existentes de la persona seleccionada
  useEffect(() => {
    let active = true
    requestPersonAssignments(selectedPersonId)
      .then((result) => {
        if (active) {
          setExistingAssignments([...result.current, ...result.expired])
        }
      })
      .catch(() => {
        if (active) {
          setExistingAssignments([])
        }
      })

    return () => {
      active = false
    }
  }, [selectedPersonId, personReloadKey])

  // Debounce de la búsqueda de accesos.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAccessSearch(accessSearchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [accessSearchInput])

  // Cargar catálogo de accesos activos según búsqueda
  useEffect(() => {
    let active = true
    requestAccesses({
      status: 'active',
      environment: 'all',
      protocol: 'all',
      search: accessSearch,
    })
      .then((result) => {
        if (active) {
          setAccesses(result)
        }
      })
      .catch(() => {
        if (active) {
          setAccesses([])
        }
      })

    return () => {
      active = false
    }
  }, [accessSearch])

  // Lista combinada de accesos (asegurando incluir el del assignment en edit)
  const allAccesses = [...accesses]
  if (
    isEdit &&
    assignment?.access &&
    !allAccesses.some((item) => item.id === assignment.access.id)
  ) {
    allAccesses.unshift({
      id: assignment.access.id,
      address: assignment.access.address,
      port: assignment.access.port,
      portEnd: assignment.access.portEnd,
      environment: assignment.access.environment,
      protocol: assignment.access.protocol,
      detail: assignment.access.detail,
      applications: assignment.access.applications,
      urls: assignment.access.urls,
      isActive: assignment.access.isActive,
      version: assignment.access.version,
      createdAt: assignment.access.createdAt,
      updatedAt: assignment.access.updatedAt,
    })
  }

  const assignedMap = new Map<number, AssignmentView>()
  for (const item of existingAssignments) {
    assignedMap.set(item.access.id, item)
  }

  const accessItems = allAccesses.map((acc) => {
    const existing = assignedMap.get(acc.id)
    const isCurrentInEdit = isEdit && assignment?.access.id === acc.id
    const disabled = existing !== undefined && !isCurrentInEdit

    let extraLabel = ''
    if (disabled) {
      extraLabel =
        existing.state === 'expired'
          ? ' (Ya asignado - Vencido)'
          : ' (Ya asignado)'
    }

    const detailText = acc.detail ? ` (${acc.detail})` : ''
    const label = `${acc.address}:${formatPortRange(acc.port, acc.portEnd)}${detailText} · ${environmentLabel(
      acc.environment,
    )}${extraLabel}`

    return {
      value: String(acc.id),
      label,
      disabled,
    }
  })

  const personItems = people.map((p) => ({
    value: String(p.id),
    label: p.name,
  }))
  if (
    isEdit &&
    assignment &&
    !personItems.some((item) => item.value === String(assignment.person.id))
  ) {
    personItems.unshift({
      value: String(assignment.person.id),
      label: `${assignment.person.name} (inactivo)`,
    })
  }

  const hasExpiredAssignments = existingAssignments.some(
    (item) => item.state === 'expired',
  )

  const handleShortcut = (days: number) => {
    setExpiresOn(addDaysToDateOnly(today, days))
    setError(null)
    setShowConfirm(false)
  }

  const executeSave = async () => {
    if (!selectedAccessId) {
      setError('Debes seleccionar un acceso.')
      return
    }
    if (!expiresOn) {
      setError('Debes ingresar una fecha de vencimiento.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (isEdit && assignment) {
        await updateAssignment(assignment.id, {
          personId: selectedPersonId,
          accessId: selectedAccessId,
          expiresOn,
          version: assignment.version,
        })
        onSaved()
        onOpenChange(false)
      } else {
        await createAssignment({
          personId: selectedPersonId,
          accessId: selectedAccessId,
          expiresOn,
        })
        onSaved()
        if (assignAnother) {
          setSelectedAccessId(null)
          setAccessSearchInput('')
          setAccessSearch('')
          setError(null)
          setShowConfirm(false)
          setPersonReloadKey((k) => k + 1)
        } else {
          onOpenChange(false)
        }
      }
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          isEdit
            ? 'No se pudo actualizar la asignación.'
            : 'No se pudo crear la asignación.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!selectedAccessId) {
      setError('Debes seleccionar un acceso.')
      return
    }
    if (!expiresOn) {
      setError('Debes ingresar una fecha de vencimiento.')
      return
    }

    if (!isEdit && expiresOn < today) {
      setError('La fecha de vencimiento debe ser hoy o posterior.')
      return
    }

    if (isEdit && assignment) {
      const isEarlier = expiresOn < assignment.expiresOn
      const isExpired = expiresOn < today
      if ((isEarlier || isExpired) && !showConfirm) {
        setShowConfirm(true)
        return
      }
    }

    executeSave()
  }

  const unchanged =
    isEdit &&
    assignment !== undefined &&
    selectedPersonId === assignment.person.id &&
    selectedAccessId === assignment.access.id &&
    expiresOn === assignment.expiresOn

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar asignación' : 'Asignar acceso'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica el personal, acceso o fecha de vencimiento de la asignación.'
              : 'Asigna un acceso de firewall del catálogo a un integrante de QA.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="assignment-person">Personal QA</Label>
              <Select
                id="assignment-person"
                items={personItems}
                value={String(selectedPersonId)}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedPersonId(Number(val))
                    setError(null)
                    setShowConfirm(false)
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger
                  id="assignment-person"
                  data-testid="assignment-person-select"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {personItems.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="assignment-person-name">Personal QA</Label>
              <Input
                id="assignment-person-name"
                value={person.name}
                disabled
                readOnly
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assignment-access-search">Buscar acceso</Label>
            <Input
              id="assignment-access-search"
              name="access-search"
              type="search"
              placeholder="Buscar por detalle, dirección o puerto"
              spellCheck={false}
              autoComplete="off"
              value={accessSearchInput}
              onChange={(e) => setAccessSearchInput(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignment-access">Acceso de firewall</Label>
            <Select
              id="assignment-access"
              items={accessItems}
              value={selectedAccessId ? String(selectedAccessId) : ''}
              onValueChange={(val) => {
                if (val) {
                  setSelectedAccessId(Number(val))
                  setError(null)
                  setShowConfirm(false)
                }
              }}
              disabled={submitting}
            >
              <SelectTrigger
                id="assignment-access"
                data-testid="assignment-access-select"
                className="w-full"
              >
                <SelectValue placeholder="Selecciona un acceso" />
              </SelectTrigger>
              <SelectContent>
                {accessItems.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasExpiredAssignments ? (
              <p className="text-xs text-muted-foreground">
                Los accesos marcados como «Ya asignado - Vencido» se pueden
                renovar editando esa asignación existente.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignment-expires-on">
              Fecha de vencimiento
            </Label>
            <Input
              id="assignment-expires-on"
              name="expiresOn"
              type="date"
              value={expiresOn}
              min={isEdit ? undefined : today}
              onChange={(e) => {
                setExpiresOn(e.target.value)
                setError(null)
                setShowConfirm(false)
              }}
              disabled={submitting}
            />
            {!isEdit ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Atajos:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleShortcut(30)}
                  disabled={submitting}
                >
                  +30 días
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleShortcut(60)}
                  disabled={submitting}
                >
                  +60 días
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleShortcut(90)}
                  disabled={submitting}
                >
                  +90 días
                </Button>
              </div>
            ) : null}
          </div>

          {!isEdit ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="assignment-assign-another"
                name="assign-another"
                checked={assignAnother}
                onChange={(e) => setAssignAnother(e.target.checked)}
                disabled={submitting}
                className="size-4 border-border"
              />
              <Label
                htmlFor="assignment-assign-another"
                className="text-sm font-normal cursor-pointer"
              >
                Asignar otro acceso después de guardar
              </Label>
            </div>
          ) : null}

          {showConfirm ? (
            <Alert
              className="border-warning/40 bg-warning/10 text-warning"
              role="alert"
            >
              <AlertDescription className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {expiresOn < peruToday()
                    ? 'La nueva fecha seleccionada ya está vencida.'
                    : 'La nueva fecha es anterior a la fecha de vencimiento actual.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ¿Deseas confirmar este cambio de fecha para la asignación?
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                    disabled={submitting}
                  >
                    Modificar fecha
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    onClick={executeSave}
                    disabled={submitting}
                  >
                    Confirmar y guardar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || unchanged || showConfirm}
            >
              {submitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Asignar acceso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

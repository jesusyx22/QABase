import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import { errorMessage } from '@/lib/format'
import {
  requestUpdateProxyAllowlist,
  type ProxyAllowlistEntry,
  type ProxyServiceView,
} from './api'

type ProxyAllowlistDialogProps = {
  service: ProxyServiceView | null
  onClose: () => void
  onSuccess: () => void
}

function areAllowlistsEqual(
  a: ProxyAllowlistEntry[],
  b: ProxyAllowlistEntry[],
): boolean {
  if (a.length !== b.length) return false
  return a.every((item, idx) => {
    const other = b[idx]
    if (!other) return false
    return (
      item.cidr.trim() === other.cidr.trim() &&
      item.label.trim() === other.label.trim()
    )
  })
}

function validateEntries(entries: ProxyAllowlistEntry[]): string | null {
  if (entries.length > 100) {
    return 'La allowlist no puede superar 100 entradas.'
  }
  const seen = new Set<string>()
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    const cidr = entry.cidr.trim()
    const label = entry.label.trim()
    if (cidr === '') {
      return 'La dirección IP o CIDR no puede estar vacía.'
    }
    if (label === '') {
      return 'El nombre de cada entrada es obligatorio.'
    }
    const lower = cidr.toLowerCase()
    if (seen.has(lower)) {
      return `La IP o CIDR "${cidr}" está duplicada en la allowlist.`
    }
    seen.add(lower)
  }
  return null
}

export function ProxyAllowlistDialog({
  service,
  onClose,
  onSuccess,
}: ProxyAllowlistDialogProps) {
  const [entries, setEntries] = useState<ProxyAllowlistEntry[]>(() =>
    service ? service.allowlist.map((e) => ({ ...e })) : [],
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!service) {
    return null
  }

  const hasChanges = !areAllowlistsEqual(entries, service.allowlist)

  const handleAddEntry = () => {
    setError(null)
    if (entries.length >= 100) {
      setError('La allowlist no puede superar 100 entradas.')
      return
    }
    setEntries((prev) => [...prev, { cidr: '', label: '' }])
  }

  const handleUpdateEntry = (
    index: number,
    field: 'cidr' | 'label',
    value: string,
  ) => {
    setError(null)
    setEntries((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  const handleRemoveEntry = (index: number) => {
    setError(null)
    setEntries((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validationError = validateEntries(entries)
    if (validationError) {
      setError(validationError)
      return
    }

    if (!hasChanges) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      const payload: ProxyAllowlistEntry[] = entries.map((e) => ({
        cidr: e.cidr.trim(),
        label: e.label.trim(),
      }))
      await requestUpdateProxyAllowlist(service.id, payload)
      onSuccess()
      onClose()
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          'No se pudo actualizar la lista de IPs autorizadas.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Editar IPs autorizadas</DialogTitle>
          <DialogDescription>
            Configura las direcciones IP o rangos CIDR permitidos para{' '}
            <span className="font-semibold text-foreground">{service.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Entradas autorizadas ({entries.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAddEntry}
                disabled={submitting || entries.length >= 100}
                aria-label="Agregar IP"
              >
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                <span>Agregar IP</span>
              </Button>
            </div>

            {entries.length === 0 ? (
              <div className="border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Sin IPs autorizadas: no se aceptarán conexiones
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto overscroll-contain pr-1">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>IP / CIDR</span>
                  <span>Nombre</span>
                  <span className="w-8 sr-only">Acciones</span>
                </div>
                {entries.map((entry, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                  >
                    <Input
                      type="text"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoComplete="off"
                      className="font-mono text-xs tabular-nums h-8"
                      value={entry.cidr}
                      onChange={(e) =>
                        handleUpdateEntry(index, 'cidr', e.target.value)
                      }
                      placeholder="10.4.24.0/24"
                      aria-label={`IP o CIDR ${index + 1}`}
                      disabled={submitting}
                    />
                    <Input
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      className="text-xs h-8"
                      value={entry.label}
                      onChange={(e) =>
                        handleUpdateEntry(index, 'label', e.target.value)
                      }
                      placeholder="Admin"
                      aria-label={`Nombre ${index + 1}`}
                      disabled={submitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-danger"
                      onClick={() => handleRemoveEntry(index)}
                      aria-label={`Quitar entrada ${index + 1}`}
                      title="Quitar entrada"
                      disabled={submitting}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
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
            <Button
              type="submit"
              disabled={submitting || !hasChanges}
              title={
                !hasChanges ? 'No hay cambios pendientes por guardar' : undefined
              }
            >
              {submitting ? 'Guardando…' : 'Guardar allowlist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

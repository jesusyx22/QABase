import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/format'
import { listRoleOptions, type RoleOption } from './api'

type OptionsState = {
  request: number
  status: 'loading' | 'success' | 'error'
  options: RoleOption[]
  message?: string
}

type RoleSelectProps = {
  id: string
  value: number | null
  onChange: (roleId: number) => void
  currentRoleName?: string
  disabled?: boolean
}

export function RoleSelect({
  id,
  value,
  onChange,
  currentRoleName,
  disabled = false,
}: RoleSelectProps) {
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<OptionsState>({
    request: -1,
    status: 'loading',
    options: [],
  })

  useEffect(() => {
    const controller = new AbortController()
    listRoleOptions(controller.signal)
      .then((options) => {
        if (!controller.signal.aborted) {
          setState({ request, status: 'success', options })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            request,
            status: 'error',
            options: [],
            message: errorMessage(caught, 'No se pudieron cargar los roles.'),
          })
        }
      })
    return () => controller.abort()
  }, [request])

  const loading = state.request !== request || state.status === 'loading'
  const options = loading ? [] : state.options
  const hasOptions = options.length > 0
  const selectDisabled = disabled || loading || !hasOptions

  const retry = () => {
    setRequest((current) => current + 1)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Rol</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (typeof next === 'number') {
            onChange(next)
          }
        }}
        disabled={selectDisabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={loading ? 'Cargando roles…' : 'Selecciona un rol'}>
            {(selected: unknown) => {
              if (loading) {
                return 'Cargando roles…'
              }
              const match =
                typeof selected === 'number'
                  ? options.find((option) => option.id === selected)
                  : undefined
              if (match) {
                return match.name
              }
              if (typeof selected === 'number') {
                return currentRoleName ?? 'Rol no asignable'
              }
              return 'Selecciona un rol'
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
              {option.isProtected ? ' (protegido)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <p role="status" className="text-xs text-muted-foreground">
          Cargando roles…
        </p>
      ) : null}

      {!loading && state.status === 'error' ? (
        <div className="space-y-1">
          <p role="alert" className="text-xs text-destructive">
            {state.message}
          </p>
          <Button type="button" variant="link" size="sm" onClick={retry}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!loading && state.status === 'success' && !hasOptions ? (
        <p className="text-xs text-muted-foreground">
          No hay roles asignables para tu cuenta.
        </p>
      ) : null}
    </div>
  )
}

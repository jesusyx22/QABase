import { useCallback } from 'react'
import { HistoryDialog } from '@/features/users/HistoryDialog'
import { listRoleHistory, type Role } from './api'

type RoleHistoryDialogProps = {
  role: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoleHistoryDialog({
  role,
  open,
  onOpenChange,
}: RoleHistoryDialogProps) {
  const load = useCallback(
    (signal?: AbortSignal) => listRoleHistory(role.id, signal),
    [role.id],
  )

  return (
    <HistoryDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Historial de ${role.name}`}
      description="Creación, renombrados y cambios de permisos. Los permisos se muestran con su etiqueta."
      load={load}
    />
  )
}

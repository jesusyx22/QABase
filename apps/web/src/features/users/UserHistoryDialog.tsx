import { useCallback } from 'react'
import type { User } from './api'
import { listUserHistory } from './api'
import { HistoryDialog } from './HistoryDialog'

type UserHistoryDialogProps = {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserHistoryDialog({
  user,
  open,
  onOpenChange,
}: UserHistoryDialogProps) {
  const load = useCallback(
    (signal?: AbortSignal) => listUserHistory(user.id, signal),
    [user.id],
  )

  return (
    <HistoryDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Historial de ${user.username}`}
      description="Altas, cambios y restablecimientos de contraseña. No se muestran contraseñas ni hashes."
      load={load}
    />
  )
}

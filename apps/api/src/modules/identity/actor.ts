import type { PermissionKey } from '@qabase/shared'

export type Actor = {
  id: number
  username: string
  permissions: PermissionKey[]
}

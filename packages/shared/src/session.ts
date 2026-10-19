import type { PermissionKey } from './permissions'

export type AnonymousSession = {
  authenticated: false
  setupRequired: boolean
  csrfToken: string
}

export type AuthenticatedSession = {
  authenticated: true
  csrfToken: string
  account: {
    id: number
    username: string
    role: {
      id: number
      name: string
    }
    permissions: PermissionKey[]
  }
}

export type SessionResponse = AnonymousSession | AuthenticatedSession

export type LoginRequest = {
  username: string
  password: string
}

export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
}

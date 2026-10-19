import type { AuthenticatedSession } from '@qabase/shared'
import { createContext } from 'react'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export type AuthContextValue = {
  status: AuthStatus
  session: AuthenticatedSession | null
  setupRequired: boolean
  login(username: string, password: string): Promise<void>
  logout(): Promise<void>
  changePassword(currentPassword: string, newPassword: string): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

import type { AuthenticatedSession } from '@qabase/shared'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  requestChangePassword,
  requestLogin,
  requestLogout,
  requestSession,
  setCsrfToken,
} from '@/lib/api'
import { AuthContext, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<AuthenticatedSession | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)

  useEffect(() => {
    let active = true

    requestSession()
      .then((response) => {
        if (!active) {
          return
        }
        setCsrfToken(response.csrfToken)
        if (response.authenticated) {
          setSession(response)
          setStatus('authenticated')
        } else {
          setSetupRequired(response.setupRequired)
          setStatus('anonymous')
        }
      })
      .catch(() => {
        if (active) {
          setStatus('anonymous')
        }
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const response = await requestLogin(username, password)
    setCsrfToken(response.csrfToken)
    if (!response.authenticated) {
      throw new Error('No se pudo iniciar sesión.')
    }
    setSession(response)
    setSetupRequired(false)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await requestLogout()
    } finally {
      setCsrfToken(null)
      setSession(null)
      setStatus('anonymous')
    }
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await requestChangePassword(currentPassword, newPassword)
    },
    [],
  )

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        setupRequired,
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

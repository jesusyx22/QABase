import type {
  ChangePasswordRequest,
  LoginRequest,
  SessionResponse,
} from '@qabase/shared'

let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (csrfToken && method !== 'GET' && method !== 'HEAD') {
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      data?.error?.code ?? 'internal',
      data?.error?.message ?? 'No se pudo completar la operación.',
    )
  }

  return data as T
}

export function requestSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/api/session')
}

export function requestLogin(
  username: string,
  password: string,
): Promise<SessionResponse> {
  const body: LoginRequest = { username, password }
  return apiFetch<SessionResponse>('/api/session', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function requestLogout(): Promise<void> {
  return apiFetch<void>('/api/session', { method: 'DELETE' })
}

export function requestChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const body: ChangePasswordRequest = { currentPassword, newPassword }
  return apiFetch<void>('/api/account/password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

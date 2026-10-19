import type { AuthenticatedSession } from '../../core/sessions/service'
import type { Actor } from './actor'

export function actorFromSession(auth: AuthenticatedSession): Actor {
  return {
    id: auth.account.id,
    username: auth.account.username,
    permissions: auth.permissions,
  }
}

import { tooManyRequests } from '../errors'
import type { Clock } from '../clock'
import { systemClock } from '../clock'

export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_MAX_ATTEMPTS = 5

/**
 * Límite en memoria por nombre de usuario normalizado (BE-20, BE-21).
 * Se pierde al reiniciar el proceso (RN-ID-35).
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, number[]>()

  constructor(
    private readonly now: Clock = systemClock,
    private readonly windowMs: number = LOGIN_WINDOW_MS,
    private readonly maxAttempts: number = LOGIN_MAX_ATTEMPTS,
  ) {}

  assertAllowed(normalizedUsername: string): void {
    this.prune(normalizedUsername)
    if ((this.attempts.get(normalizedUsername)?.length ?? 0) >= this.maxAttempts) {
      throw tooManyRequests()
    }
  }

  recordFailure(normalizedUsername: string): void {
    this.prune(normalizedUsername)
    const failures = this.attempts.get(normalizedUsername) ?? []
    failures.push(this.now().getTime())
    this.attempts.set(normalizedUsername, failures)
  }

  clear(normalizedUsername: string): void {
    this.attempts.delete(normalizedUsername)
  }

  private prune(normalizedUsername: string): void {
    const cutoff = this.now().getTime() - this.windowMs
    const failures = this.attempts.get(normalizedUsername)
    if (!failures) {
      return
    }

    const recent = failures.filter((timestamp) => timestamp > cutoff)
    if (recent.length === 0) {
      this.attempts.delete(normalizedUsername)
    } else {
      this.attempts.set(normalizedUsername, recent)
    }
  }
}

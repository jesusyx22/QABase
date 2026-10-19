import { hash, verify } from '@node-rs/argon2'
import type { Algorithm } from '@node-rs/argon2'

export type PasswordHasher = {
  hash(password: string): Promise<string>
  verify(passwordHash: string, password: string): Promise<boolean>
}

// Argon2id = 2. El paquete lo declara como const enum, incompatible con
// verbatimModuleSyntax; se usa el valor con el tipo importado.
const ARGON2ID_ALGORITHM = 2 as Algorithm

/**
 * Parámetros OWASP para Argon2id: 19 MiB, 2 iteraciones, 1 hilo.
 */
export const ARGON2_OPTIONS = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export function createArgon2Hasher(): PasswordHasher {
  return {
    hash: (password) => hash(password, ARGON2_OPTIONS),
    verify: (passwordHash, password) => verify(passwordHash, password),
  }
}

const DECOY_PASSWORD = 'qabase-decoy-password-that-is-never-used'

/**
 * Hash señuelo para igualar el tiempo de respuesta cuando la cuenta no
 * existe o está inactiva (BE-18).
 */
export async function createDecoyHash(
  hasher: PasswordHasher = createArgon2Hasher(),
): Promise<string> {
  return hasher.hash(DECOY_PASSWORD)
}

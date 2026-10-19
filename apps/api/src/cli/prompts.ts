import { input, password } from '@inquirer/prompts'

export type CliPrompts = {
  text(message: string): Promise<string>
  secret(message: string): Promise<string>
}

export function createCliPrompts(): CliPrompts {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Este asistente requiere una terminal interactiva para ocultar la contraseña.',
    )
  }

  return {
    text: (message) => input({ message }),
    secret: (message) => password({ message, mask: '*' }),
  }
}

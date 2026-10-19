import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from './api'
import { ResetPasswordDialog } from './ResetPasswordDialog'

const user: User = {
  id: 7,
  username: 'ana',
  role: { id: 2, name: 'Editor', isProtected: false },
  isActive: true,
  version: 4,
  createdAt: '2026-10-18T10:00:00.000Z',
  updatedAt: '2026-10-18T10:00:00.000Z',
}

function renderDialog() {
  const onReset = vi.fn()
  render(
    <ResetPasswordDialog
      user={user}
      open
      onOpenChange={() => undefined}
      onReset={onReset}
    />,
  )
  return { onReset }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ResetPasswordDialog', () => {
  it('valida la longitud antes de llamar al API', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'corta' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Restablecer contraseña' }),
    )

    expect(
      screen.getByText('La contraseña debe tener entre 12 y 128 caracteres.'),
    ).toBeInTheDocument()
  })

  it('exige que la confirmación coincida', () => {
    renderDialog()

    const passwordInput = screen.getByLabelText('Contraseña nueva')
    const confirmationInput = screen.getByLabelText('Repite la contraseña nueva')
    fireEvent.change(passwordInput, {
      target: { value: 'contrasena-larga-1' },
    })
    fireEvent.change(confirmationInput, {
      target: { value: 'contrasena-larga-2' },
    })

    expect((passwordInput as HTMLInputElement).value).toBe('contrasena-larga-1')
    expect((confirmationInput as HTMLInputElement).value).toBe(
      'contrasena-larga-2',
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Restablecer contraseña' }),
    )

    expect(
      screen.getByText('La confirmación no coincide con la contraseña.'),
    ).toBeInTheDocument()
  })

  it('muestra el mensaje del servidor y no confirma el reset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'conflict',
            message: 'Debe quedar al menos un administrador activo.',
          },
        }),
      })),
    )
    const { onReset } = renderDialog()

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'contrasena-larga-1' },
    })
    fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
      target: { value: 'contrasena-larga-1' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Restablecer contraseña' }),
    )

    expect(
      await screen.findByText('Debe quedar al menos un administrador activo.'),
    ).toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })
})

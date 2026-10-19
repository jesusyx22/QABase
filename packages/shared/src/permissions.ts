export const PERMISSIONS = [
  {
    key: 'registros.ver',
    label: 'Ver registros',
    description:
      'Consultar registros, filtros, totales, resumen por QA, catálogo de niveles y opciones de QAs.',
  },
  {
    key: 'registros.crear',
    label: 'Crear registros',
    description: 'Registrar méritos e incidencias.',
  },
  {
    key: 'registros.editar',
    label: 'Editar registros',
    description: 'Modificar registros vigentes.',
  },
  {
    key: 'registros.anular',
    label: 'Anular registros',
    description: 'Anular registros vigentes con motivo y confirmación.',
  },
  {
    key: 'registros.historial',
    label: 'Ver historial de registros',
    description:
      'Consultar el historial de un registro y activar la vista de anulados.',
  },
  {
    key: 'personal.gestionar',
    label: 'Gestionar Personal QA',
    description:
      'Crear, renombrar, activar, desactivar y consultar el historial del catálogo.',
  },
  {
    key: 'usuarios.gestionar',
    label: 'Gestionar usuarios',
    description:
      'Crear, editar, activar, desactivar, restablecer contraseñas y consultar el historial de cuentas.',
  },
  {
    key: 'roles.gestionar',
    label: 'Gestionar roles',
    description:
      'Crear roles, renombrarlos, cambiar sus permisos y consultar su historial.',
  },
  {
    key: 'mesa.ver',
    label: 'Ver Mesa de Ayuda',
    description:
      'Consultar tickets, ver detalles, descargar anexos y sincronizar.',
  },
  {
    key: 'mesa.crear',
    label: 'Crear tickets de Mesa de Ayuda',
    description: 'Reportar un ticket rápido.',
  },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map(
  (permission) => permission.key,
)

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value)
}

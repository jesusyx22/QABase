import type { PermissionKey } from '@qabase/shared'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type ModuleDefinition = {
  id: string
  path: string
  label: string
  group: 'principal' | 'configuracion'
  description: string
  permission: PermissionKey
  component: LazyExoticComponent<ComponentType>
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'records',
    path: 'registros',
    label: 'Méritos e Incidencias',
    group: 'principal',
    description: 'Registrar, consultar y anular hechos del Personal QA.',
    permission: 'registros.ver',
    component: lazy(() =>
      import('@/pages/RecordsPage').then((module) => ({
        default: module.RecordsPage,
      })),
    ),
  },
  {
    id: 'helpdesk',
    path: 'mesa',
    label: 'Mesa de Ayuda',
    group: 'principal',
    description: 'Consultar la copia local importada de tickets.',
    permission: 'mesa.ver',
    component: lazy(() =>
      import('@/pages/HelpdeskPage').then((module) => ({
        default: module.HelpdeskPage,
      })),
    ),
  },
  {
    id: 'personal',
    path: 'personal',
    label: 'Personal QA',
    group: 'configuracion',
    description: 'Catálogo de personas, estados e historial.',
    permission: 'personal.gestionar',
    component: lazy(() =>
      import('@/pages/PersonalPage').then((module) => ({
        default: module.PersonalPage,
      })),
    ),
  },
  {
    id: 'accesses',
    path: 'accesos',
    label: 'Accesos',
    group: 'principal',
    description: 'Catálogo de accesos de firewall y puertos.',
    permission: 'accesos.ver',
    component: lazy(() =>
      import('@/pages/AccessesPage').then((module) => ({
        default: module.AccessesPage,
      })),
    ),
  },
  {
    id: 'users',
    path: 'usuarios',
    label: 'Usuarios',
    group: 'configuracion',
    description: 'Cuentas de acceso, roles y contraseñas.',
    permission: 'usuarios.gestionar',
    component: lazy(() =>
      import('@/pages/UsersPage').then((module) => ({
        default: module.UsersPage,
      })),
    ),
  },
  {
    id: 'roles',
    path: 'roles',
    label: 'Roles',
    group: 'configuracion',
    description: 'Roles y permisos del sistema.',
    permission: 'roles.gestionar',
    component: lazy(() =>
      import('@/pages/RolesPage').then((module) => ({
        default: module.RolesPage,
      })),
    ),
  },
]

export function visibleModules(
  permissions: readonly PermissionKey[],
): ModuleDefinition[] {
  return MODULES.filter((module) => permissions.includes(module.permission))
}

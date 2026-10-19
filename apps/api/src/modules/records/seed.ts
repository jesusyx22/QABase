import type { DatabaseSync } from 'node:sqlite'
import { inTransaction } from '../../core/transaction'

type LevelSeed = {
  type: 'merito' | 'incidencia'
  level: number
  label: string
  description: string
}

const LEVELS: LevelSeed[] = [
  {
    type: 'merito',
    level: 1,
    label: 'Menor',
    description: 'Aporte puntual de alcance reducido.',
  },
  {
    type: 'merito',
    level: 2,
    label: 'Moderado',
    description: 'Contribución útil para una tarea o entrega.',
  },
  {
    type: 'merito',
    level: 3,
    label: 'Relevante',
    description: 'Mejora importante o prevención de un problema significativo.',
  },
  {
    type: 'merito',
    level: 4,
    label: 'Alto',
    description: 'Contribución de gran impacto para el equipo o producto.',
  },
  {
    type: 'merito',
    level: 5,
    label: 'Excepcional',
    description: 'Contribución excepcional, con beneficio de gran alcance.',
  },
  {
    type: 'incidencia',
    level: 1,
    label: 'Menor',
    description: 'Desviación menor, de impacto limitado.',
  },
  {
    type: 'incidencia',
    level: 2,
    label: 'Moderado',
    description: 'Problema acotado que requiere corrección.',
  },
  {
    type: 'incidencia',
    level: 3,
    label: 'Relevante',
    description: 'Incumplimiento o problema con impacto significativo.',
  },
  {
    type: 'incidencia',
    level: 4,
    label: 'Alto',
    description: 'Hecho con impacto grave en una entrega, operación o servicio.',
  },
  {
    type: 'incidencia',
    level: 5,
    label: 'Crítico',
    description: 'Hecho de impacto crítico en la operación o servicio.',
  },
]

export function seedRecords(db: DatabaseSync): void {
  inTransaction(db, () => {
    const insert = db.prepare(
      `INSERT INTO impact_levels (type, level, label, description)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (type, level) DO NOTHING`,
    )
    for (const level of LEVELS) {
      insert.run(level.type, level.level, level.label, level.description)
    }
  })
}

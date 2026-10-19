import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from './database'
import { runMigrations } from './migrate'

function migrationsDir(): string {
  return mkdtempSync(join(tmpdir(), 'qabase-migrations-'))
}

describe('runMigrations', () => {
  it('aplica las migraciones en orden y no las repite', () => {
    const dir = migrationsDir()
    writeFileSync(
      join(dir, '001-crea-personas.sql'),
      'CREATE TABLE personas (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL);',
    )
    writeFileSync(
      join(dir, '002-crea-registros.sql'),
      'CREATE TABLE registros (id INTEGER PRIMARY KEY, persona_id INTEGER NOT NULL REFERENCES personas(id));',
    )

    const db = openDatabase(':memory:')

    expect(runMigrations(db, dir)).toBe(2)

    const rows = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as Array<{ version: string }>
    expect(rows.map((row) => row.version)).toEqual(['001', '002'])

    expect(runMigrations(db, dir)).toBe(0)
    db.close()
  })

  it('aborta si el nombre no tiene prefijo numérico', () => {
    const dir = migrationsDir()
    writeFileSync(join(dir, 'sin-prefijo.sql'), 'SELECT 1;')

    const db = openDatabase(':memory:')

    expect(() => runMigrations(db, dir)).toThrow(/Migración inválida/)
    db.close()
  })

  it('revierte una migración fallida y no la registra', () => {
    const dir = migrationsDir()
    writeFileSync(
      join(dir, '001-falla.sql'),
      'CREATE TABLE temporal (id INTEGER PRIMARY KEY); INSERT INTO tabla_inexistente VALUES (1);',
    )

    const db = openDatabase(':memory:')

    expect(() => runMigrations(db, dir)).toThrow(/Falló la migración/)
    const applied = db
      .prepare('SELECT COUNT(*) AS total FROM schema_migrations')
      .get() as { total: number }
    expect(applied.total).toBe(0)
    db.close()
  })
})

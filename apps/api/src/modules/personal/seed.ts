import type { DatabaseSync } from 'node:sqlite'
import { inTransaction } from '../../core/transaction'
import { insertSeedPerson } from './repository'

const INITIAL_PEOPLE: Array<{ sourceId: number; name: string }> = [
  { sourceId: 1, name: 'Jhon Javier Cutipa Vargas' },
  { sourceId: 2, name: 'Bernardo Pari Choquehuanca' },
  { sourceId: 3, name: 'Cleber Vilca Lupacca' },
  { sourceId: 4, name: 'Cliver J. Sonco Clavedias' },
  { sourceId: 5, name: 'Edgar Amador Mamani Calsina' },
  { sourceId: 6, name: 'Erick Gonzalo Ccori Aragon' },
  { sourceId: 7, name: 'ALAIN ELWIN ROMAN VILCAPAZA' },
  { sourceId: 8, name: 'Aldo R. Lezama Phocco' },
  { sourceId: 9, name: 'RONALD JOSE CAIRA MAMANI' },
  { sourceId: 10, name: 'Maritza Natalia Villacorta Muñoz' },
  { sourceId: 11, name: 'Kephler Gomez Calizaya' },
  { sourceId: 12, name: 'Carlos Midwar Arque Mamani' },
  { sourceId: 13, name: 'David Ricardo Huarino Mamani' },
  { sourceId: 14, name: 'DAVID BRAHYA LAROTA PILCO' },
  { sourceId: 15, name: 'Joel Santos Gómez Alanoca' },
  { sourceId: 16, name: 'Percy Condori Yucra' },
  { sourceId: 17, name: 'William Vladimir Vilcapaza Choque' },
  { sourceId: 18, name: 'Yomara L. Quispe Alanoca' },
  { sourceId: 19, name: 'JESUS ANTONY ARRATIA CAMA' },
  { sourceId: 20, name: 'LUANE NICOLE SALAS CHOQUE' },
  { sourceId: 21, name: 'JHON EVER MARON PUMA' },
]

/**
 * Catálogo inicial insert-only (RN-QA-23, RN-QA-24, RN-QA-25).
 * No renumera, no fusiona homónimos ni corrige grafías.
 */
export function seedPersonal(db: DatabaseSync, now: Date): void {
  const timestamp = now.toISOString()

  inTransaction(db, () => {
    for (const person of INITIAL_PEOPLE) {
      insertSeedPerson(db, {
        sourceId: person.sourceId,
        name: person.name,
        now: timestamp,
      })
    }
  })
}

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ByQaRow } from './types'

const numberFormat = new Intl.NumberFormat('es')

export function ByQaTable({ rows }: { rows: ByQaRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Resumen por QA</h2>
        </CardTitle>
        <CardDescription>
          Todas las personas del catálogo, incluidas las inactivas. Las
          cifras usan solo registros vigentes y los filtros aplicados. No es
          un ranking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No hay personas en el catálogo.
          </p>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              Resumen de méritos e incidencias por QA
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2}>QA</TableHead>
                <TableHead colSpan={2} className="text-right">
                  Méritos
                </TableHead>
                <TableHead colSpan={2} className="text-right">
                  Incidencias
                </TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-right text-xs font-normal">
                  Cantidad
                </TableHead>
                <TableHead className="text-right text-xs font-normal">
                  Puntos
                </TableHead>
                <TableHead className="text-right text-xs font-normal">
                  Cantidad
                </TableHead>
                <TableHead className="text-right text-xs font-normal">
                  Puntos
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="max-w-[18rem] truncate"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                      {!row.isActive ? (
                        <Badge variant="outline">Inactivo</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numberFormat.format(row.merits.count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numberFormat.format(row.merits.points)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numberFormat.format(row.incidents.count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numberFormat.format(row.incidents.points)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

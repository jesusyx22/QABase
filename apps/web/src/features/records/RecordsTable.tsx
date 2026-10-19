import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  recordStatusLabel,
  recordTypeLabel,
  type RecordView,
} from './types'

type RecordsTableProps = {
  items: RecordView[]
  page: number
  pageSize: number
  total: number
  canEdit: boolean
  canAnnul: boolean
  canHistory: boolean
  onCreate: (() => void) | null
  onEdit: (record: RecordView) => void
  onAnnul: (record: RecordView) => void
  onHistory: (record: RecordView) => void
  onPageChange: (page: number) => void
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const displayedPage = Math.min(page, totalPages)
  const first = total === 0 ? 0 : (displayedPage - 1) * pageSize + 1
  const last = Math.min(displayedPage * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        Mostrando {first}–{last} de {total} · Página {displayedPage} de{' '}
        {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={displayedPage <= 1}
          onClick={() => onPageChange(displayedPage - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={displayedPage >= totalPages}
          onClick={() => onPageChange(displayedPage + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}

export function RecordsTable({
  items,
  page,
  pageSize,
  total,
  canEdit,
  canAnnul,
  canHistory,
  onCreate,
  onEdit,
  onAnnul,
  onHistory,
  onPageChange,
}: RecordsTableProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm font-medium">
              {total === 0
                ? 'No hay registros con estos filtros.'
                : 'No hay registros en esta página.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? 'Prueba con otro rango de fechas o restablece los filtros.'
                : 'Vuelve a la página anterior o ajusta los filtros.'}
            </p>
            {total === 0 && onCreate ? (
              <Button type="button" size="sm" onClick={onCreate}>
                Nuevo registro
              </Button>
            ) : null}
          </div>
          {total > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
            />
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <Table>
          <TableCaption className="sr-only">
            Listado de registros de méritos e incidencias
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>QA</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((record) => {
              const isVigente = record.status === 'vigente'
              const showEdit = canEdit && isVigente
              const showAnnul = canAnnul && isVigente
              const showHistory = canHistory
              const hasActions = showEdit || showAnnul || showHistory

              return (
                <TableRow key={record.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {record.eventDate}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className="max-w-[18rem] truncate"
                        title={record.qa.name}
                      >
                        {record.qa.name}
                      </span>
                      {!record.qa.isActive ? (
                        <span className="text-xs text-muted-foreground">
                          (inactivo)
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        record.type === 'merito' ? 'secondary' : 'outline'
                      }
                    >
                      {recordTypeLabel(record.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {record.level}. {record.levelLabel}
                  </TableCell>
                  <TableCell>
                    <span
                      className="block max-w-[26rem] line-clamp-3 whitespace-normal break-words"
                      title={record.detail}
                    >
                      {record.detail}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isVigente ? 'outline' : 'destructive'}
                    >
                      {recordStatusLabel(record.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {hasActions ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {showEdit ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => onEdit(record)}
                            aria-label={`Editar registro de ${record.qa.name} del ${record.eventDate}`}
                          >
                            Editar
                          </Button>
                        ) : null}
                        {showAnnul ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onAnnul(record)}
                            aria-label={`Anular registro de ${record.qa.name} del ${record.eventDate}`}
                          >
                            Anular
                          </Button>
                        ) : null}
                        {showHistory ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => onHistory(record)}
                            aria-label={`Ver historial del registro de ${record.qa.name} del ${record.eventDate}`}
                          >
                            Historial
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </CardContent>
    </Card>
  )
}

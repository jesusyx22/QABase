import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Metric } from './types'

const numberFormat = new Intl.NumberFormat('es')

function MetricCard({
  title,
  metric,
}: {
  title: string
  metric: Metric
}) {
  return (
    <Card
      size="sm"
      className="border-sidebar-border border-t-2 border-t-primary bg-sidebar text-sidebar-foreground"
    >
      <CardHeader>
        <CardTitle>
          <h3 className="text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase">
            {title}
          </h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-8">
        <div>
          <p className="text-2xl font-semibold text-sidebar-foreground tabular-nums">
            {numberFormat.format(metric.count)}
          </p>
          <p className="text-xs text-sidebar-foreground/60">Cantidad</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-sidebar-foreground tabular-nums">
            {numberFormat.format(metric.points)}
          </p>
          <p className="text-xs text-sidebar-foreground/60">Puntos</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function RecordsTotals({
  totals,
}: {
  totals: {
    merits: Metric
    incidents: Metric
  }
}) {
  return (
    <section aria-labelledby="records-totals-heading" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="records-totals-heading"
          className="text-sm font-medium"
        >
          Totales
        </h2>
        <p className="text-xs text-muted-foreground">
          Solo registros vigentes con los filtros aplicados.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard title="Méritos" metric={totals.merits} />
        <MetricCard title="Incidencias" metric={totals.incidents} />
      </div>
    </section>
  )
}

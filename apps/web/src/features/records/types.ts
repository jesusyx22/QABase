export type RecordType = 'merito' | 'incidencia'
export type RecordStatus = 'vigente' | 'anulado'
export type PageSize = 25 | 50 | 100

export type RecordQa = {
  id: number
  name: string
  isActive: boolean
}

export type RecordView = {
  id: number
  qa: RecordQa
  type: RecordType
  eventDate: string
  level: number
  levelLabel: string
  detail: string
  status: RecordStatus
  version: number
  createdAt: string
  updatedAt: string
  annulledAt: string | null
  annulReason: string | null
}

export type Metric = {
  count: number
  points: number
}

export type ByQaRow = {
  id: number
  name: string
  isActive: boolean
  merits: Metric
  incidents: Metric
}

export type RecordsPage = {
  items: RecordView[]
  page: number
  pageSize: PageSize
  total: number
  totals: {
    merits: Metric
    incidents: Metric
  }
  byQa: ByQaRow[]
}

export type QaOption = {
  id: number
  name: string
  isActive: boolean
}

export type ImpactLevel = {
  type: RecordType
  level: number
  label: string
  description: string
}

export type RecordHistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

export type CreateRecordInput = {
  qaId: number
  type: RecordType
  eventDate: string
  level: number
  detail: string
}

export type UpdateRecordInput = {
  qaId?: number
  type?: RecordType
  eventDate?: string
  level?: number
  detail?: string
  version: number
}

export type AnnulRecordInput = {
  reason: string
  version: number
  confirm: true
}

export function recordTypeLabel(type: RecordType): string {
  return type === 'merito' ? 'Mérito' : 'Incidencia'
}

export function recordStatusLabel(status: RecordStatus): string {
  return status === 'vigente' ? 'Vigente' : 'Anulado'
}

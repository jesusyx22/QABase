import { apiFetch } from '@/lib/api'
import {
  recordsQueryString,
  type RecordsFilters,
} from './filters'
import type {
  AnnulRecordInput,
  CreateRecordInput,
  ImpactLevel,
  QaOption,
  RecordHistoryEvent,
  RecordsPage,
  RecordView,
  UpdateRecordInput,
} from './types'

function signalOptions(signal?: AbortSignal): RequestInit {
  return signal ? { signal } : {}
}

export function fetchRecords(
  filters: RecordsFilters,
  canIncludeAnnulled: boolean,
  signal?: AbortSignal,
): Promise<RecordsPage> {
  const query = recordsQueryString(filters, canIncludeAnnulled)
  return apiFetch<RecordsPage>(
    `/api/records?${query}`,
    signalOptions(signal),
  )
}

export function fetchQaOptions(signal?: AbortSignal): Promise<QaOption[]> {
  return apiFetch<QaOption[]>(
    '/api/personal/options?includeInactive=1',
    signalOptions(signal),
  )
}

export function fetchImpactLevels(
  signal?: AbortSignal,
): Promise<ImpactLevel[]> {
  return apiFetch<ImpactLevel[]>(
    '/api/records/levels',
    signalOptions(signal),
  )
}

export function createRecord(input: CreateRecordInput): Promise<RecordView> {
  return apiFetch<RecordView>('/api/records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRecord(
  recordId: number,
  input: UpdateRecordInput,
): Promise<RecordView> {
  return apiFetch<RecordView>(`/api/records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function annulRecord(
  recordId: number,
  input: AnnulRecordInput,
): Promise<RecordView> {
  return apiFetch<RecordView>(`/api/records/${recordId}/annul`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchRecordHistory(
  recordId: number,
  signal?: AbortSignal,
): Promise<RecordHistoryEvent[]> {
  return apiFetch<RecordHistoryEvent[]>(
    `/api/records/${recordId}/history`,
    signalOptions(signal),
  )
}

import type { GraphState } from '@/hooks/store/types'
import { createUiToastSlice } from '@/hooks/store/uiToastSlice'

export function testUiToastUpsertDoesNotExtendExpiry() {
  const realNow = Date.now
  let state: Pick<GraphState, 'uiToasts'> = { uiToasts: [] }
  const set: (fn: (s: GraphState) => Partial<GraphState>) => void = fn => {
    state = { ...state, ...(fn(state as unknown as GraphState) as Pick<GraphState, 'uiToasts'>) }
  }
  const slice = createUiToastSlice(set)

  try {
    Date.now = () => 1_000
    slice.upsertUiToast({ id: 't', message: 'a', kind: 'neutral', ttlMs: 1_000 })
    if (state.uiToasts.length < 1) throw new Error('expected first upsert to create toast')
    if (state.uiToasts.length > 1) throw new Error('expected first upsert to create exactly one toast')
    const first = state.uiToasts[0]
    if (!first || first.createdAtMs !== 1_000) throw new Error('expected createdAtMs to be set to now')
    if (first.expiresAtMs !== 2_000) throw new Error('expected expiresAtMs to be createdAtMs + ttlMs')

    Date.now = () => 1_500
    slice.upsertUiToast({ id: 't', message: 'b', kind: 'neutral', ttlMs: 1_000 })
    if (state.uiToasts.length > 1) throw new Error('expected upsert to keep single toast by id')
    const updated = state.uiToasts[0]
    if (!updated) throw new Error('expected updated toast')
    if (updated.createdAtMs !== 1_000) throw new Error('expected createdAtMs preserved on upsert')
    if (updated.expiresAtMs !== 2_000) throw new Error('expected upsert not to extend expiry')

    Date.now = () => 2_500
    slice.pruneUiToasts(Date.now())
    if (state.uiToasts.length !== 0) throw new Error('expected prune to remove expired toast')
  } finally {
    Date.now = realNow
  }
}

export function testUiToastUpsertMovesToastToFront() {
  const realNow = Date.now
  let state: Pick<GraphState, 'uiToasts'> = { uiToasts: [] }
  const set: (fn: (s: GraphState) => Partial<GraphState>) => void = fn => {
    state = { ...state, ...(fn(state as unknown as GraphState) as Pick<GraphState, 'uiToasts'>) }
  }
  const slice = createUiToastSlice(set)

  try {
    Date.now = () => 1_000
    slice.pushUiToast({ id: 'a', message: 'a', kind: 'neutral', ttlMs: 1_000 })
    Date.now = () => 1_100
    slice.pushUiToast({ id: 'b', message: 'b', kind: 'neutral', ttlMs: 1_000 })
    const firstId = state.uiToasts[0]?.id
    if (firstId !== 'b') throw new Error('expected newest toast to be first')

    Date.now = () => 1_200
    slice.upsertUiToast({ id: 'a', message: 'a2', kind: 'neutral', ttlMs: 1_000 })
    const afterUpsertId = state.uiToasts[0]?.id
    if (afterUpsertId !== 'a') throw new Error('expected upserted toast to move to front')
  } finally {
    Date.now = realNow
  }
}

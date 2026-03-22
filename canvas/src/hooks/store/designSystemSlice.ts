import type { StoreApi } from 'zustand'

import type { DesignSystemPageId, DesignSystemSlice, GraphState } from '@/hooks/store/types'

export type { DesignSystemPageId, DesignSystemSlice } from '@/hooks/store/types'

export const isDesignSystemPageId = (v: string): v is DesignSystemPageId => v === 'hub' || v === 'tokens' || v === 'utilities'

type SetGraph = StoreApi<GraphState>['setState']
type GetGraph = StoreApi<GraphState>['getState']

export function createDesignSystemSlice(
  set: SetGraph,
  get: GetGraph,
): DesignSystemSlice {
  return {
    designSystemRequestedPage: null,
    setDesignSystemRequestedPage: (page) => {
      const prev = get().designSystemRequestedPage
      if (prev === page) return
      set({ designSystemRequestedPage: page } as Partial<GraphState>)
    },
  }
}

import type { StoreApi } from 'zustand'
import type { GraphState } from '@/hooks/store/types'

export type SetGraph = StoreApi<GraphState>['setState']
export type GetGraph = StoreApi<GraphState>['getState']

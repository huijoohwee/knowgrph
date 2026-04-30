
import type { StoreApi } from 'zustand'
import type { GraphState } from '@/hooks/store/types'
import { createUiStorageReaders } from './uiSliceStorage'
import { createInitialChatUiContext, createUiChatActions } from './uiSliceChat'
import { createUiInitialState } from './uiSliceInitialState'
import { createUiCoreActions } from './uiSliceCoreActions'
import { createUiIntegrationActions } from './uiSliceIntegrationActions'

type SetGraph = StoreApi<GraphState>['setState']

export const createUiSlice = (set: SetGraph) => {
  const readers = createUiStorageReaders()
  const chat = createInitialChatUiContext(readers)
  return {
    ...createUiInitialState(set, readers, chat),
    ...createUiCoreActions(set),
    ...createUiChatActions(set),
    ...createUiIntegrationActions(set),
  }
}

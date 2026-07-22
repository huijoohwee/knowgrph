import { useGraphStore } from '@/hooks/useGraphStore'

export function reportActivePathMaterializationError(error: unknown): void {
  useGraphStore.getState().pushUiToast({
    id: 'source-files:active-path-materialization',
    kind: 'error',
    message: error instanceof Error ? error.message : 'Failed to activate the selected canvas source',
    ttlMs: 5000,
    dismissible: true,
  })
}

import type { WorkspaceViewMode } from '@/hooks/store/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { LoaderResult } from '@/features/parsers/loader'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'
import { maybeAutoEnableGeospatialModeForGraphData } from '@/features/geospatial/autoEnable'

export async function runImportFlow(args: {
  nameForParse: string
  textForParse: string
  applyToStore?: boolean
  sideEffects?: boolean
  openWorkspaceViewMode?: WorkspaceViewMode
  ui?: {
    collapsePanelsOnSuccess?: boolean
    successLabelOverride?: string
    failureLabelOverride?: string
  }
  onSuccess?: (res: LoaderResult) => void
}): Promise<LoaderResult | null> {
  try {
    const res = await loadGraphDataFromTextViaParser(args.nameForParse, args.textForParse, { applyToStore: args.applyToStore })
    const sideEffectsEnabled = args.sideEffects !== false
    if (sideEffectsEnabled) applyLoaderResultToParserUi(res, args.ui)
    if (!res) return null
    if (args.onSuccess) {
      try {
        args.onSuccess(res)
      } catch {
        void 0
      }
    }
    if (sideEffectsEnabled && args.openWorkspaceViewMode) {
      try {
        useGraphStore.getState().setWorkspaceViewMode(args.openWorkspaceViewMode)
      } catch {
        void 0
      }
    }
    if (sideEffectsEnabled) {
      await maybeAutoEnableGeospatialModeForGraphData({ graphData: res.graphData, openFloatingPanel: true })
    }
    return res
  } catch {
    if (args.sideEffects !== false) applyLoaderResultToParserUi(null, args.ui)
    return null
  }
}

import type { BottomTab } from '@/features/bottom-panel/open'
import { openBottomPanel } from '@/features/bottom-panel/open'
import type { LoaderResult } from '@/features/parsers/loader'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { applyLoaderResultToParserUi } from '@/features/toolbar/importUi'

export async function runImportFlow(args: {
  nameForParse: string
  textForParse: string
  applyToStore?: boolean
  openTab?: BottomTab
  ui?: {
    collapsePanelsOnSuccess?: boolean
    successLabelOverride?: string
    failureLabelOverride?: string
  }
  onSuccess?: (res: LoaderResult) => void
}): Promise<LoaderResult | null> {
  try {
    const res = await loadGraphDataFromTextViaParser(args.nameForParse, args.textForParse, { applyToStore: args.applyToStore })
    applyLoaderResultToParserUi(res, args.ui)
    if (!res) return null
    if (args.onSuccess) {
      try {
        args.onSuccess(res)
      } catch {
        void 0
      }
    }
    if (args.openTab) {
      try {
        openBottomPanel(args.openTab)
      } catch {
        void 0
      }
    }
    return res
  } catch {
    applyLoaderResultToParserUi(null, args.ui)
    return null
  }
}

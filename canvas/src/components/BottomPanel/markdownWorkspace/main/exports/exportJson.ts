import { exportGraphAsJSON, type DatasetPath } from '@/lib/graph/file'
import type { UiToastInput } from '@/hooks/store/types'

export async function exportGraphJson(args: {
  graphData: unknown
  exportBaseName: string
  pushUiToast: (toast: UiToastInput) => void
}): Promise<void> {
  const data = args.graphData as unknown
  if (!data) {
    args.pushUiToast({ id: 'export-json-missing-graph', kind: 'warning', message: 'No graph to export.' })
    return
  }
  await exportGraphAsJSON(data as never, `${args.exportBaseName}.json` as unknown as DatasetPath)
}

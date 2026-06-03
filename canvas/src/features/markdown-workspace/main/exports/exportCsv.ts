import { exportGraphAsCombinedCSV, type DatasetPath } from '@/lib/graph/file'
import type { UiToastInput } from '@/hooks/store/types'

export async function exportGraphCsv(args: {
  graphData: unknown
  exportBaseName: string
  pushUiToast: (toast: UiToastInput) => void
}): Promise<void> {
  const data = args.graphData as unknown
  if (!data) {
    args.pushUiToast({ id: 'export-csv-missing-graph', kind: 'warning', message: 'No graph to export.' })
    return
  }
  await exportGraphAsCombinedCSV(data as never, `${args.exportBaseName}.csv` as unknown as DatasetPath)
}

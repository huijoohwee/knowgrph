import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'

export type ParserDataExportHandlers = {
  onExportJsonLd?: () => void
  onExportJson?: () => void
  onExportCsvCombined?: () => void
  onExportGraphMl?: () => void
  onExportCypher?: () => void
}

export type UseWorkflowExportActionsParams = {
  parserDataExports: ParserDataExportHandlers
  graphData: GraphData | null
  graphSchema: GraphSchema | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  captureCanvasSvgSnapshot: () => Promise<string | null>
  captureCanvasPngSnapshot: () => Promise<Blob | null>
}


import type { GraphSchema } from '@/lib/graph/schema'

type PerformanceLod = NonNullable<NonNullable<GraphSchema['performance']>['lod']>
export type TreeLod = NonNullable<NonNullable<PerformanceLod['tree']>>
export type TreeConfig = NonNullable<NonNullable<GraphSchema['layout']>['tree']>

export interface RenderTreeSettingsRowsProps {
  treeCfg: Partial<TreeConfig>
  treeLod: TreeLod
  treeEdgeLabelsText: string
  treeEdgeLabelSuggestion: { label: string; count: number } | null
  updateTree: (patch: Partial<TreeConfig>) => void
  updateTreeLod: (updater: (cur: TreeLod) => TreeLod | null) => void
  uiPanelKeyValueInputClass: string
  uiPanelMonospaceTextClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}

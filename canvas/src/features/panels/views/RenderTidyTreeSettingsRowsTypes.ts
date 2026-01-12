import type { GraphSchema } from '@/lib/graph/schema'

type PerformanceLod = NonNullable<NonNullable<GraphSchema['performance']>['lod']>
export type TidyTreeLod = NonNullable<NonNullable<PerformanceLod['tidyTree']>>
export type TidyTreeConfig = NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']>

export interface RenderTidyTreeSettingsRowsProps {
  tidyTreeCfg: Partial<TidyTreeConfig>
  tidyTreeLod: TidyTreeLod
  tidyEdgeLabelsText: string
  tidyEdgeLabelSuggestion: { label: string; count: number } | null
  updateTidyTree: (patch: Partial<TidyTreeConfig>) => void
  updateTidyTreeLod: (updater: (cur: TidyTreeLod) => TidyTreeLod | null) => void
  uiPanelKeyValueInputClass: string
  uiPanelMonospaceTextClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}

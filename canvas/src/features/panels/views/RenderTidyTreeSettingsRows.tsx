import React from 'react'
import type { RenderTidyTreeSettingsRowsProps } from './RenderTidyTreeSettingsRowsTypes'
import { TidyTreeLinkSettings } from './TidyTreeLinkSettings'
import { TidyTreeLayoutSettings } from './TidyTreeLayoutSettings'
import { TidyTreeNodeSettings } from './TidyTreeNodeSettings'
import { TidyTreeLabelSettings } from './TidyTreeLabelSettings'

const RenderTidyTreeSettingsRows = React.memo(function RenderTidyTreeSettingsRows(
  props: RenderTidyTreeSettingsRowsProps,
) {
  return (
    <>
      <TidyTreeLinkSettings
        tidyTreeCfg={props.tidyTreeCfg}
        updateTidyTree={props.updateTidyTree}
        tidyEdgeLabelsText={props.tidyEdgeLabelsText}
        tidyEdgeLabelSuggestion={props.tidyEdgeLabelSuggestion}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
        uiPanelKeyValueTextSizeClass={props.uiPanelKeyValueTextSizeClass}
        uiPanelTextFontClass={props.uiPanelTextFontClass}
      />
      <TidyTreeLayoutSettings
        tidyTreeCfg={props.tidyTreeCfg}
        updateTidyTree={props.updateTidyTree}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
      />
      <TidyTreeNodeSettings
        tidyTreeCfg={props.tidyTreeCfg}
        updateTidyTree={props.updateTidyTree}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
      />
      <TidyTreeLabelSettings
        tidyTreeCfg={props.tidyTreeCfg}
        updateTidyTree={props.updateTidyTree}
        tidyTreeLod={props.tidyTreeLod}
        updateTidyTreeLod={props.updateTidyTreeLod}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
      />
    </>
  )
})

export default RenderTidyTreeSettingsRows

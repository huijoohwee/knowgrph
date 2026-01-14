import React from 'react'
import type { RenderTreeSettingsRowsProps } from './RenderTreeSettingsRowsTypes'
import { TreeLinkSettings } from './TreeLinkSettings'
import { TreeLayoutSettings } from './TreeLayoutSettings'
import { TreeNodeSettings } from './TreeNodeSettings'
import { TreeLabelSettings } from './TreeLabelSettings'

const RenderTreeSettingsRows = React.memo(function RenderTreeSettingsRows(
  props: RenderTreeSettingsRowsProps,
) {
  return (
    <>
      <TreeLinkSettings
        treeCfg={props.treeCfg}
        updateTree={props.updateTree}
        treeEdgeLabelsText={props.treeEdgeLabelsText}
        treeEdgeLabelSuggestion={props.treeEdgeLabelSuggestion}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
        uiPanelKeyValueTextSizeClass={props.uiPanelKeyValueTextSizeClass}
        uiPanelTextFontClass={props.uiPanelTextFontClass}
      />
      <TreeLayoutSettings
        treeCfg={props.treeCfg}
        updateTree={props.updateTree}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
      />
      <TreeNodeSettings
        treeCfg={props.treeCfg}
        updateTree={props.updateTree}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
      />
      <TreeLabelSettings
        treeCfg={props.treeCfg}
        updateTree={props.updateTree}
        treeLod={props.treeLod}
        updateTreeLod={props.updateTreeLod}
        uiPanelKeyValueInputClass={props.uiPanelKeyValueInputClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
      />
    </>
  )
})

export default RenderTreeSettingsRows

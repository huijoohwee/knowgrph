import React from 'react'
import { SettingsSpecialValueNode, shouldRenderSettingsSpecialValueNode } from './SettingsSpecialValueNode'
import type { SectionMeta } from './settingsView.constants'
import type { SettingsEntry } from './useSettingsView.helpers'
import type { SettingsRowActions, SettingsRowRefs, SettingsRowStatusState, SettingsRowUi } from './settingsRowTypes'

type BuildSettingsEntryValueNodeArgs = {
  area: string
  actions: SettingsRowActions
  entry: SettingsEntry
  inputNode: React.ReactNode
  isFirstRowInArea: boolean
  pillButtonClassName: string
  refs: SettingsRowRefs
  resolvedValueKey: string
  sectionMeta: SectionMeta | undefined
  status: SettingsRowStatusState
  statusPillClassName: string
  ui: SettingsRowUi
  values: Record<string, string | number | boolean>
}

export function buildSettingsEntryValueNode({
  area,
  actions,
  entry,
  inputNode,
  isFirstRowInArea,
  pillButtonClassName,
  refs,
  resolvedValueKey,
  sectionMeta,
  status,
  statusPillClassName,
  ui,
  values,
}: BuildSettingsEntryValueNodeArgs) {
  const specialValueNode = shouldRenderSettingsSpecialValueNode({ area, resolvedValueKey, sKey: entry.meta.key })
    ? (
      <SettingsSpecialValueNode
        area={area}
        actions={actions}
        inputNode={inputNode}
        pillButtonClassName={pillButtonClassName}
        refs={refs}
        resolvedValueKey={resolvedValueKey}
        sKey={entry.meta.key}
        status={status}
        statusPillClassName={statusPillClassName}
        ui={{ uiPanelKeyValueTextSizeClass: ui.uiPanelKeyValueTextSizeClass }}
        values={values}
      />
    )
    : null

  if (specialValueNode) {
    const sectionAssistNodes = actions.buildSectionMetaAssistNodes(sectionMeta, isFirstRowInArea, entry.meta.key)
    return sectionAssistNodes.length > 0
      ? (
        <div className="space-y-1">
          {specialValueNode}
          <div className="flex flex-wrap items-center gap-1">{sectionAssistNodes}</div>
        </div>
      )
      : specialValueNode
  }

  const assistNodes = [
    ...actions.buildSectionMetaAssistNodes(sectionMeta, isFirstRowInArea, entry.meta.key),
    ...(area === 'Chat' ? actions.buildChatAssistNodes(entry.meta.key) : []),
  ]

  return assistNodes.length > 0
    ? (
      <div className="space-y-1">
        {inputNode}
        <div className="flex flex-wrap items-center gap-1">{assistNodes}</div>
      </div>
    )
    : inputNode
}

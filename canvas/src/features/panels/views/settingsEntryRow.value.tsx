import React from 'react'
import { SettingsSpecialValueNode, shouldRenderSettingsSpecialValueNode } from './SettingsSpecialValueNode'
import type { SettingsEntry } from './useSettingsView.helpers'
import type { SettingsRowActions, SettingsRowRefs, SettingsRowStatusState, SettingsRowUi } from './settingsRowTypes'

type BuildSettingsEntryValueNodeArgs = {
  area: string
  actions: SettingsRowActions
  entry: SettingsEntry
  inputNode: React.ReactNode
  refs: SettingsRowRefs
  resolvedValueKey: string
  sectionActionClassName: string
  sectionStatusClassName: string
  status: SettingsRowStatusState
  ui: SettingsRowUi
  values: Record<string, string | number | boolean>
}

export function buildSettingsEntryValueNode({
  area,
  actions,
  entry,
  inputNode,
  refs,
  resolvedValueKey,
  sectionActionClassName,
  sectionStatusClassName,
  status,
  ui,
  values,
}: BuildSettingsEntryValueNodeArgs) {
  const specialValueNode = shouldRenderSettingsSpecialValueNode({ area, resolvedValueKey, sKey: entry.meta.key })
    ? (
      <SettingsSpecialValueNode
        area={area}
        actions={actions}
        inputNode={inputNode}
        refs={refs}
        resolvedValueKey={resolvedValueKey}
        sKey={entry.meta.key}
        sectionActionClassName={sectionActionClassName}
        sectionStatusClassName={sectionStatusClassName}
        status={status}
        ui={{ uiPanelKeyValueTextSizeClass: ui.uiPanelKeyValueTextSizeClass }}
        values={values}
      />
    )
    : null

  if (specialValueNode) {
    return specialValueNode
  }

  const assistNodes = [
    ...(area === 'Chat' ? actions.buildChatAssistNodes(entry.meta.key) : []),
  ]

  return assistNodes.length > 0
    ? (
      <section className="space-y-1">
        {inputNode}
        <section className="flex flex-wrap items-center gap-1">{assistNodes}</section>
      </section>
    )
    : inputNode
}

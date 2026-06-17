import React from 'react'
import { SettingsSpecialValueNode, shouldRenderSettingsSpecialValueNode } from './SettingsSpecialValueNode'
import {
  KTV_VALUE_ROW_INPUT_SHELL_CLASS_NAME,
  KTV_VALUE_ROW_SCROLL_CLASS_NAME,
} from '@/features/panels/ui/canvasKeyTypeValueValueCell'
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
      <section className={KTV_VALUE_ROW_SCROLL_CLASS_NAME}>
        <section className={KTV_VALUE_ROW_INPUT_SHELL_CLASS_NAME}>{inputNode}</section>
        {assistNodes}
      </section>
    )
    : inputNode
}

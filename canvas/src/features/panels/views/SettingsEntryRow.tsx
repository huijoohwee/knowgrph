import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import { KindPill, resolveFieldTypeIconKind } from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SettingsEntryDetailsTable } from './SettingsEntryDetailsTable'
import { buildSettingsEntryInputNode } from './settingsEntryRow.input'
import { buildSettingsEntryTooltips } from './settingsEntryRow.tooltips'
import { buildSettingsEntryValueNode } from './settingsEntryRow.value'
import type { SectionMeta } from './settingsView.constants'
import type { SettingsEntry } from './useSettingsView.helpers'
import type { SettingsRowActions, SettingsRowRefs, SettingsRowStatusState, SettingsRowToggleActions, SettingsRowUi } from './settingsRowTypes'

type SettingsEntryRowProps = {
  area: string
  entry: SettingsEntry
  isExpanded: boolean
  isFirstRowInArea: boolean
  actions: SettingsRowActions
  refs: SettingsRowRefs
  status: SettingsRowStatusState
  sectionMeta: SectionMeta | undefined
  toggleActions: SettingsRowToggleActions
  ui: SettingsRowUi
  values: Record<string, string | number | boolean>
}

export function SettingsEntryRow({
  area,
  entry,
  isExpanded,
  isFirstRowInArea,
  actions,
  refs,
  status,
  sectionMeta,
  toggleActions,
  ui,
  values,
}: SettingsEntryRowProps) {
  const {
    meta: setting,
    details,
    writable,
    anchorId,
    typeLabel,
    valueKey,
    valueDisplayOverride,
    valueType,
    valueOptions,
  } = entry

  const hasOptions = Array.isArray(setting.options) && setting.options.length > 0
  const resolvedTypeLabel = String(typeLabel || setting.type || '').trim() || 'string'
  const resolvedValueKey = valueKey || setting.key
  const resolvedInputType = valueType || setting.type
  const resolvedInputOptions = valueOptions || setting.options
  const settingTypeIconKind = resolveFieldTypeIconKind(resolvedTypeLabel)
  const renderTypeAsText = Boolean(typeLabel)
  const { keyTooltip, valueTooltip } = buildSettingsEntryTooltips({
    entry,
    resolvedInputOptions,
    resolvedTypeLabel,
    resolvedValueKey,
    values,
  })

  const pillButtonClassName = `inline-flex items-center justify-center h-6 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary} px-2 text-xs whitespace-nowrap`
  const statusPillClassName = `inline-flex items-center h-6 max-w-[14rem] rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs`
  const inputNode = buildSettingsEntryInputNode({
    hasOptions: writable || hasOptions,
    renderInput: () => actions.renderInput(resolvedValueKey, resolvedInputType, writable, resolvedInputOptions, valueDisplayOverride),
    settingType: setting.type,
    valueTooltip,
  })
  const renderedValueNode = buildSettingsEntryValueNode({
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
  })

  return (
    <li>
      <KeyTypeValueRow
        id={anchorId}
        dataKgAnchor={anchorId}
        keyNode={(
          <Tooltip
            content={keyTooltip}
            maxWidthPx={250}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <span className="inline-flex items-center gap-1">
              <span className="truncate">{setting.key}</span>
            </span>
          </Tooltip>
        )}
        typeNode={
          renderTypeAsText
            ? <span className={`inline-flex items-center justify-start sm:justify-end ${UI_THEME_TOKENS.text.secondary}`}>{resolvedTypeLabel}</span>
            : (
              <KindPill
                kind={settingTypeIconKind}
                label={resolvedTypeLabel}
                className="inline-flex items-center justify-center"
                iconClassName={ui.settingsTypeIconSizeClass}
                iconStrokeWidth={ui.uiIconStrokeWidth}
              />
            )
        }
        valueNode={<div className="flex-1">{renderedValueNode}</div>}
        onClick={toggleActions.onToggleExpanded}
      />
      {isExpanded ? (
        <SettingsEntryDetailsTable
          details={details}
          uiPanelKeyValueTextSizeClass={ui.uiPanelKeyValueTextSizeClass}
        />
      ) : null}
    </li>
  )
}

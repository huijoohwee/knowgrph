import Tooltip from '@/features/panels/ui/Tooltip'
import { KeyTypeValueRow, RightAlignedValueCell } from '@/features/panels/ui/KeyTypeValueRow'
import { MainPanelTypeIcon, resolveMainPanelSettingTypeIconKey } from '@/features/panels/ui/mainPanelTypeIcons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SettingsEntryDetailsTable } from './SettingsEntryDetailsTable'
import { buildSettingsEntryInputNode } from './settingsEntryRow.input'
import { buildSettingsEntryTooltips } from './settingsEntryRow.tooltips'
import { buildSettingsEntryValueNode } from './settingsEntryRow.value'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
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
  const settingTypeIconKey = resolveMainPanelSettingTypeIconKey(resolvedTypeLabel)
  const renderTypeAsText = Boolean(typeLabel)
  const { keyTooltip, valueTooltip } = buildSettingsEntryTooltips({
    entry,
    resolvedInputOptions,
    resolvedTypeLabel,
    resolvedValueKey,
    values,
  })

  const pillButtonClassName = `inline-flex min-w-0 max-w-full items-center justify-center h-6 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary} px-2 text-xs ${UI_TEXT_TRUNCATE}`
  const statusPillClassName = `inline-flex min-w-0 max-w-full items-center h-6 rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs ${UI_TEXT_TRUNCATE}`
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
            className="w-full min-w-0 max-w-full overflow-hidden"
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden">
              <span className={UI_TEXT_TRUNCATE}>{setting.key}</span>
            </span>
          </Tooltip>
        )}
        typeNode={
          renderTypeAsText
            ? (
              <span className={`inline-flex min-w-0 max-w-full items-center justify-start overflow-hidden sm:justify-end ${UI_THEME_TOKENS.text.secondary}`}>
                <span className={UI_TEXT_TRUNCATE}>{resolvedTypeLabel}</span>
              </span>
            )
            : (
              <span
                className="inline-flex items-center justify-center"
                title={resolvedTypeLabel}
                aria-label={resolvedTypeLabel}
              >
                <MainPanelTypeIcon
                  iconKey={settingTypeIconKey}
                  className={ui.settingsTypeIconSizeClass}
                  strokeWidth={ui.uiIconStrokeWidth}
                />
              </span>
            )
        }
        valueNode={<RightAlignedValueCell>{renderedValueNode}</RightAlignedValueCell>}
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

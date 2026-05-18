import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { buildSettingsAreaTooltip } from '@/lib/config'
import { uiToolbarToggleActiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { SettingsEntryRow } from './SettingsEntryRow'
import type { SectionMeta } from './settingsView.constants'
import type { SettingsEntry } from './useSettingsView.helpers'
import type { SettingsRowActions, SettingsRowRefs, SettingsRowStatusState, SettingsRowToggleActions, SettingsRowUi } from './settingsRowTypes'

export type SettingsSectionDescriptor = {
  area: string
  collapsed: boolean
  entries: SettingsEntry[]
  sectionMeta?: SectionMeta
  showDensityPresets: boolean
}

type SettingsSectionsProps = {
  applyUiPanelDensityPreset: (preset: 'comfortable' | 'compact') => void
  descriptors: SettingsSectionDescriptor[]
  expanded: string | null
  normalizedQuery: string
  rowActions: SettingsRowActions
  rowRefs: SettingsRowRefs
  rowStatus: SettingsRowStatusState
  rowUi: SettingsRowUi
  getAreaIntroItemCount?: (area: string) => number
  renderAreaIntro?: (area: string) => React.ReactNode
  setExpanded: React.Dispatch<React.SetStateAction<string | null>>
  stickyOffsetClassName: string
  toggleArea: (area: string, nextCollapsed?: boolean) => void
  values: Record<string, string | number | boolean>
}

export function SettingsSections({
  applyUiPanelDensityPreset,
  descriptors,
  expanded,
  normalizedQuery,
  rowActions,
  rowRefs,
  rowStatus,
  rowUi,
  getAreaIntroItemCount,
  renderAreaIntro,
  setExpanded,
  stickyOffsetClassName,
  toggleArea,
  values,
}: SettingsSectionsProps) {
  return descriptors.map(({ area, collapsed, entries, sectionMeta, showDensityPresets }) => {
    const areaIntro = renderAreaIntro?.(area)
    const itemCount = entries.length + Math.max(0, getAreaIntroItemCount?.(area) || 0)

    return (
      <CollapsibleSection
        key={area}
        title={
          <Tooltip
            content={buildSettingsAreaTooltip(area, String(itemCount))}
            maxWidthPx={250}
            contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          >
            <span className="inline-flex items-center gap-1">
              <span>{area}</span>
              <span className={`text-xs uppercase tracking-wide ${UI_THEME_TOKENS.text.tertiary} ml-1`}>
                {itemCount} items
              </span>
            </span>
          </Tooltip>
        }
        collapsed={collapsed}
        stickyOffsetClassName={stickyOffsetClassName}
        onToggle={next => {
          if (normalizedQuery) return
          toggleArea(area, next)
        }}
      >
        <ul>
          {areaIntro}
          {showDensityPresets ? (
            <li className={`mb-1 flex flex-wrap items-center gap-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
              <span className={`font-semibold ${UI_THEME_TOKENS.text.primary}`}>Presets</span>
              <button
                type="button"
                className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                onClick={() => {
                  applyUiPanelDensityPreset('comfortable')
                }}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
                onClick={() => {
                  applyUiPanelDensityPreset('compact')
                }}
              >
                Compact
              </button>
            </li>
          ) : null}
          {entries.map(entry => {
            const isExpanded = expanded === entry.meta.key
            const toggleActions: SettingsRowToggleActions = {
              onToggleExpanded: () => setExpanded(isExpanded ? null : entry.meta.key),
            }
            return (
              <SettingsEntryRow
                key={entry.meta.key}
                area={area}
                actions={rowActions}
                entry={entry}
                isExpanded={isExpanded}
                isFirstRowInArea={entries[0]?.meta.key === entry.meta.key}
                refs={rowRefs}
                status={rowStatus}
                sectionMeta={sectionMeta}
                toggleActions={toggleActions}
                ui={rowUi}
                values={values}
              />
            )
          })}
        </ul>
      </CollapsibleSection>
    )
  })
}

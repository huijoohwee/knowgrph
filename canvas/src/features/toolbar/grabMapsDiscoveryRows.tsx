import React from 'react'
import Tooltip from '@/features/panels/ui/Tooltip'
import { KindPill, resolveFieldTypeIconKind } from '@/features/graph-fields/ui/graphFieldIcons'
import { NodeOverlayEditorKvTable, type NodeOverlayEditorKvRow } from '@/components/FlowEditor/NodeOverlayEditorKvTable'
import { buildSettingsKeyTooltip, buildSettingsValueTooltip } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { renderSettingInput } from '@/features/settings/ui'
import { settingsRegistry } from '@/features/settings/registry'
import { GRABMAPS_MCP_REQUEST_DOC_ENTRIES } from '@/features/panels/views/grabmapsMcpApiDocs'
import type { VirtualSettingsEntry } from '@/features/panels/views/byteplusChatApiDocs'

type DiscoverySectionKind = 'keyword' | 'nearby'

type DiscoverySettingsRowRenderArgs = {
  values: Record<string, string | number | boolean>
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>
  dirtyRef: React.MutableRefObject<Set<string>>
  keyLabelClass: string
  microLabelClass: string
  textSizeClass: string
  settingsTypeIconSizeClass: string
  uiIconStrokeWidth: number
}

const GRABMAPS_DISCOVERY_SECTION_KEYS: Readonly<Record<DiscoverySectionKind, ReadonlySet<string>>> = {
  keyword: new Set([
    'search_places.query',
    'search_places.country',
    'search_places.lat',
    'search_places.lon',
    'search_places.radius',
    'search_places.limit',
  ]),
  nearby: new Set([
    'nearby_search.lat',
    'nearby_search.lon',
    'nearby_search.radius',
    'nearby_search.limit',
    'nearby_search.rankBy',
    'nearby_search.language',
    'nearby_search.category',
  ]),
}

function resolveDiscoveryDocRows(section: DiscoverySectionKind): ReadonlyArray<VirtualSettingsEntry> {
  const targetKeys = GRABMAPS_DISCOVERY_SECTION_KEYS[section]
  return GRABMAPS_MCP_REQUEST_DOC_ENTRIES.filter(entry => {
    const key = String(entry.meta.key || '').trim()
    if (!key.startsWith('grabmapsMcp.')) return false
    return targetKeys.has(key.slice('grabmapsMcp.'.length))
  })
}

export function buildGrabMapsDiscoverySettingsRows(args: {
  section: DiscoverySectionKind
} & DiscoverySettingsRowRenderArgs): NodeOverlayEditorKvRow[] {
  const entries = resolveDiscoveryDocRows(args.section)
  return entries.map((entry, index) => {
    const rowKey = `${args.section}:${entry.meta.key}:${index}`
    const valueKey = String(entry.valueKey || '').trim()
    const mappedMeta = settingsRegistry.find(meta => meta.key === valueKey) || null
    const resolvedInputType = String(mappedMeta?.type || entry.meta.type || 'string')
    const resolvedTypeLabel = String(entry.typeLabel || resolvedInputType || 'string')
    const resolvedOptions = mappedMeta?.options
    const details = entry.details
    const keyTooltip = buildSettingsKeyTooltip({
      area: details.area,
      key: entry.meta.key,
      responsibility: details.responsibility,
      role: entry.tooltipRole,
      actions: entry.tooltipActions,
      outcome: entry.tooltipImpact || details.responsibility,
    })
    const valueTooltip = buildSettingsValueTooltip({
      type: resolvedTypeLabel,
      key: entry.meta.key,
      defaultValue: entry.tooltipDefaultValue ?? mappedMeta?.default?.() ?? null,
      options: resolvedOptions,
      notes: details.notes,
      impact: entry.tooltipImpact || details.notes || details.responsibility,
      defaultValueOverride: entry.tooltipDefaultValue,
      min: entry.tooltipMin,
      max: entry.tooltipMax,
      interval: entry.tooltipInterval,
      expansionNote: entry.tooltipExpansionNote,
      contractionNote: entry.tooltipContractionNote,
    })
    const typeKind = resolveFieldTypeIconKind(resolvedTypeLabel)
    return {
      rowKey,
      labelId: `grabmaps-discovery-row-${args.section}-${index}`,
      keyNode: (
        <Tooltip
          content={keyTooltip}
          maxWidthPx={250}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
        >
          <span className={`inline-flex items-center gap-1 truncate ${args.keyLabelClass}`}>
            <span className="truncate">{entry.meta.key.replace(/^grabmapsMcp\./, '')}</span>
          </span>
        </Tooltip>
      ),
      typeNode: (
        <KindPill
          kind={typeKind}
          label={resolvedTypeLabel}
          className="inline-flex items-center justify-center"
          iconClassName={args.settingsTypeIconSizeClass}
          iconStrokeWidth={args.uiIconStrokeWidth}
        />
      ),
      valueNode: valueKey ? (
        <Tooltip
          content={valueTooltip}
          maxWidthPx={260}
          contentClassName={`${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`}
          className="w-full"
        >
          <div className="w-full min-w-0" onClick={event => event.stopPropagation()}>
            {renderSettingInput(
              valueKey,
              resolvedInputType,
              Boolean(mappedMeta?.write),
              args.values,
              args.setValues,
              args.dirtyRef,
              resolvedOptions,
              typeof args.values[valueKey] !== 'undefined'
                ? args.values[valueKey]
                : undefined,
            )}
          </div>
        </Tooltip>
      ) : null,
      showInPortDot: false,
      showOutPortDot: false,
    }
  })
}

export function GrabMapsDiscoverySettingsTable(props: {
  ariaLabel: string
  section: DiscoverySectionKind
} & DiscoverySettingsRowRenderArgs): React.ReactElement | null {
  const rows = React.useMemo(
    () => buildGrabMapsDiscoverySettingsRows({
      section: props.section,
      values: props.values,
      setValues: props.setValues,
      dirtyRef: props.dirtyRef,
      keyLabelClass: props.keyLabelClass,
      microLabelClass: props.microLabelClass,
      textSizeClass: props.textSizeClass,
      settingsTypeIconSizeClass: props.settingsTypeIconSizeClass,
      uiIconStrokeWidth: props.uiIconStrokeWidth,
    }),
    [
      props.section,
      props.values,
      props.setValues,
      props.dirtyRef,
      props.keyLabelClass,
      props.microLabelClass,
      props.textSizeClass,
      props.settingsTypeIconSizeClass,
      props.uiIconStrokeWidth,
    ],
  )
  if (rows.length === 0) return null
  return (
    <NodeOverlayEditorKvTable
      ariaLabel={props.ariaLabel}
      microLabelClass={props.microLabelClass}
      rows={rows}
      forcePortDots={false}
    />
  )
}

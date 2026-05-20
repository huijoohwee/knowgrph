import React from 'react'
import CollapsibleSubsection from '@/features/panels/ui/CollapsibleSubsection'
import { RightAlignedTooltipInput, SimpleKeyValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import type { ExampleConfig, ExampleId } from '@/features/parsers/examplesCatalog'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGympgrphExternalStore } from '@/lib/gympgrph/externalStore'
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceTableSsot'

export function WorkspaceActionsPanel(props: { examples: ExampleConfig[]; onApplyExample: (exampleId: ExampleId) => void }) {
  const { examples, onApplyExample } = props
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')

  const [selectedExampleId, setSelectedExampleId] = React.useState<string>('')

  const {
    geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs,
    geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes,
  } = useGympgrphExternalStore(s => ({
    geospatialDatasetTimeoutMs: s.geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs: s.setGeospatialDatasetTimeoutMs,
    geospatialDatasetMaxBytes: s.geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes: s.setGeospatialDatasetMaxBytes,
  }))

  const handleOpenMarkdownSourceFiles = React.useCallback(() => {
    openMarkdownWorkspaceEditorPane(useGraphStore.getState())
  }, [])

  return (
    <section className="px-2 py-1" aria-label="Workspace actions">
      <CollapsibleSubsection title="Sample Dataset" defaultCollapsed={true}>
        <div className="px-1">
          <select
            className={`w-full min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass}`}
            value={selectedExampleId}
            onChange={(e) => {
              const id = e.target.value
              setSelectedExampleId(id)
              if (id) onApplyExample(id as ExampleId)
              setTimeout(() => setSelectedExampleId(''), 0)
            }}
            aria-label="Sample dataset"
          >
            <option value="">Select an example…</option>
            {examples.map(example => (
              <option key={example.id} value={example.id}>{example.label}</option>
            ))}
          </select>
        </div>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="Dataset fetch limits">
        <div className="space-y-1">
          <SimpleKeyValueRow label="Timeout (ms)" density="compact" className="px-1">
            <RightAlignedTooltipInput
              tooltip="Bounded fetch timeout. Range: 1,000–60,000 ms."
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={geospatialDatasetTimeoutMs}
              onChange={e => setGeospatialDatasetTimeoutMs(Number(e.target.value))}
              onClick={e => e.stopPropagation()}
            />
          </SimpleKeyValueRow>
          <SimpleKeyValueRow label="Max bytes" density="compact" className="px-1">
            <RightAlignedTooltipInput
              tooltip="Bounded fetch size. Range: 64 KB–50 MB."
              type="number"
              min={64 * 1024}
              max={50 * 1024 * 1024}
              step={256 * 1024}
              value={geospatialDatasetMaxBytes}
              onChange={e => setGeospatialDatasetMaxBytes(Number(e.target.value))}
              onClick={e => e.stopPropagation()}
            />
          </SimpleKeyValueRow>
        </div>
      </CollapsibleSubsection>

      <CollapsibleSubsection title="Source Files">
        <section className="px-1" aria-label="Source Files">
          <p className={`${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`}>
            Source Files are managed in the Editor workspace.
          </p>
          <button
            type="button"
            className={`mt-1 ${UI_THEME_TOKENS.badge.chip} px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={() => handleOpenMarkdownSourceFiles()}
            aria-label="Open Source Files"
            title="Open Source Files"
          >
            Open Markdown
          </button>
        </section>
      </CollapsibleSubsection>
    </section>
  )
}

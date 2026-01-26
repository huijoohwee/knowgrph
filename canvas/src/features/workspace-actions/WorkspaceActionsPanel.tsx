import React from 'react'
import { SquarePlus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGympgrphStore } from 'gympgrph'
import CollapsibleSubsection from '@/features/panels/ui/CollapsibleSubsection'
import { RightAlignedTooltipInput, SimpleKeyValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import { ToolbarSourceFilesArea } from '@/features/toolbar/ToolbarSourceFilesArea'
import type { ExampleConfig, ExampleId } from '@/features/parsers/examplesCatalog'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { createId } from '@/lib/id'

export function WorkspaceActionsPanel(props: { examples: ExampleConfig[]; onApplyExample: (exampleId: ExampleId) => void }) {
  const { examples, onApplyExample } = props
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')

  const [selectedExampleId, setSelectedExampleId] = React.useState<string>('')

  const {
    geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs,
    geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes,
  } = useGympgrphStore(
    useShallow(s => ({
      geospatialDatasetTimeoutMs: s.geospatialDatasetTimeoutMs,
      setGeospatialDatasetTimeoutMs: s.setGeospatialDatasetTimeoutMs,
      geospatialDatasetMaxBytes: s.geospatialDatasetMaxBytes,
      setGeospatialDatasetMaxBytes: s.setGeospatialDatasetMaxBytes,
    })),
  )

  const squareIconButtonClassName = [
    `App-toolbar__btn ${uiPanelKeyValueTextSizeClass}`,
    UI_THEME_TOKENS.panel.bg,
    UI_THEME_TOKENS.button.text,
    UI_THEME_TOKENS.button.hoverBg,
    UI_THEME_TOKENS.button.square,
  ].join(' ')

  const handleNewSourceFile = React.useCallback(() => {
    try {
      const store = useGraphStore.getState()
      const count = Array.isArray(store.sourceFiles) ? store.sourceFiles.length : 0
      const nextIndex = Math.max(1, count + 1)
      store.addSourceFile({
        id: createId('sf'),
        name: `source-${nextIndex}.md`,
        text: '',
        enabled: true,
        status: 'idle',
        source: { kind: 'local' },
      })
    } catch {
      void 0
    }
  }, [])

  return (
    <div className="px-2 py-1">
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

      <CollapsibleSubsection
        title={
          <span className="inline-flex items-center gap-2">
            <span>Source Files</span>
            <button
              type="button"
              className={squareIconButtonClassName}
              onClick={e => {
                e.stopPropagation()
                handleNewSourceFile()
              }}
              aria-label="New Source File"
              title="New Source File"
            >
              <SquarePlus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
            </button>
          </span>
        }
      >
        <ToolbarSourceFilesArea />
      </CollapsibleSubsection>
    </div>
  )
}

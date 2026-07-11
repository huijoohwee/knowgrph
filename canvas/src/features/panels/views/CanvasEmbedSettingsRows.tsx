import React from 'react'
import { CanvasEmbedImportPanel } from '@/features/canvas/CanvasEmbedImportPanel'
import {
  CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL,
  selectCanvasEmbedImport,
} from '@/features/canvas/canvasEmbedImportContract'
import { resolveCanonicalWorkspaceReadmeCanvasEmbedRuntimeUrl } from '@/features/canvas/canvasEmbedPresets'
import { useCanvasKeyTypeValueStaticRowProps } from '@/features/panels/ui/canvasKeyTypeValueRuntime'
import { getUiSectionActionClassName } from '@/lib/ui/sectionChipChrome'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow'

const CANVAS_EMBED_SEARCH_INDEX = [
  'canvas embed',
  'iframe',
  'postmessage',
  'live canvas hero',
  'home background',
  'import canvas embed',
].join(' ')

export const CANVAS_EMBED_SETTINGS_ROW_COUNT = 1

export function matchesCanvasEmbedQuery(query: string): boolean {
  const terms = query.split(/\s+/).map(term => term.trim()).filter(Boolean)
  return terms.length === 0 || terms.every(term => CANVAS_EMBED_SEARCH_INDEX.includes(term))
}

export function CanvasEmbedSettingsRows() {
  const [importPanelOpen, setImportPanelOpen] = React.useState(false)
  const staticRowProps = useCanvasKeyTypeValueStaticRowProps('default')

  return (
    <>
      <KeyTypeValueStaticRow
        {...staticRowProps}
        keyNode={<span className="font-semibold">Canvas Embed</span>}
        typeNode={<code>iframe + postMessage</code>}
        valueNode={(
          <section className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
            <button
              type="button"
              className={getUiSectionActionClassName('primary')}
              onClick={() => setImportPanelOpen(true)}
            >
              <span className={UI_TEXT_TRUNCATE}>Import canvas embed</span>
            </button>
            <button
              type="button"
              className={getUiSectionActionClassName('primary')}
              onClick={() => {
                selectCanvasEmbedImport(resolveCanonicalWorkspaceReadmeCanvasEmbedRuntimeUrl(), { liveHeroPreview: false })
              }}
            >
              <span className={UI_TEXT_TRUNCATE}>Use Workspace README background</span>
            </button>
            <span className={`min-w-0 ${UI_TEXT_TRUNCATE} ${UI_THEME_TOKENS.text.secondary}`}>
              Set the Live Canvas Hero background from shared embed code.
            </span>
          </section>
        )}
      />
      {importPanelOpen ? <CanvasEmbedImportPanel onClose={() => setImportPanelOpen(false)} /> : null}
    </>
  )
}

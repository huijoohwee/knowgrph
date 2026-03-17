import React from 'react'
import { Columns, Eye, LayoutPanelTop } from 'lucide-react'
import type { AnnotatedCodeRow } from '@/features/markdown/ui/markdownAnnotatedCode'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { HighlightedCode } from './HighlightedCode'

export type AnnotateDisplayMode = 'inline' | 'beside' | 'render'

export function AnnotateDisplayModeToggle(props: {
  baseMode: AnnotateDisplayMode
  mode: AnnotateDisplayMode
  setMode: (mode: AnnotateDisplayMode) => void
  clearOverride: () => void
}) {
  const { baseMode, mode, setMode, clearOverride } = props

  const base = `p-1.5 rounded-md ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} transition-colors`
  const active = `p-1.5 rounded-md ${UI_THEME_TOKENS.panel.bg} shadow-sm ${UI_THEME_TOKENS.button.activeText} transition-colors`

  const onPick = (next: AnnotateDisplayMode) => {
    if (next === baseMode) {
      clearOverride()
      return
    }
    setMode(next)
  }

  return (
    <menu className="flex items-center gap-1" aria-label="Annotation display mode">
      <button
        type="button"
        aria-label="Show annotations beside code"
        title="Beside"
        className={mode === 'beside' ? active : base}
        aria-current={mode === 'beside' ? 'true' : undefined}
        onClick={() => onPick('beside')}
      >
        <Columns className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Show annotations inline"
        title="Inline"
        className={mode === 'inline' ? active : base}
        aria-current={mode === 'inline' ? 'true' : undefined}
        onClick={() => onPick('inline')}
      >
        <LayoutPanelTop className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Render code block output"
        title="Render"
        className={mode === 'render' ? active : base}
        aria-current={mode === 'render' ? 'true' : undefined}
        onClick={() => onPick('render')}
      >
        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </menu>
  )
}

export const AnnotatedRow = React.memo(function AnnotatedRow({
  row,
  lang,
  wrapClass,
  isBeside,
  textSizeClass,
}: {
  row: AnnotatedCodeRow
  lang: string
  wrapClass: string
  isBeside: boolean
  textSizeClass: string
}) {
  if (!row.code.trim() && !row.annotation) return null

  const codeBlock = (
    <section
      className={
        `flex-1 min-w-0 p-4 bg-white dark:bg-[#0d1117] overflow-x-auto ` +
        (!isBeside && row.annotation ? 'border-b border-dashed border-gray-200 dark:border-gray-800' : '')
      }
    >
      <pre className={`m-0 p-0 bg-transparent ${wrapClass} ${textSizeClass}`}>
        <HighlightedCode code={row.code} lang={lang} highlightLines={null} />
      </pre>
    </section>
  )

  const annotationBlock = row.annotation ? (
    <aside
      className={
        `flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-400 ` +
        (isBeside ? 'w-full lg:w-72 border-t lg:border-t-0 lg:border-l ' : 'w-full ') +
        'border-gray-100 dark:border-gray-800'
      }
    >
      <section className="prose prose-xs max-w-none dark:prose-invert">
        <p className="whitespace-pre-wrap leading-relaxed m-0">{row.annotation}</p>
      </section>
    </aside>
  ) : null

  return (
    <section
      className={
        `flex ${isBeside ? 'flex-col lg:flex-row-reverse' : 'flex-col'} border-b border-gray-100 dark:border-gray-800 last:border-0 group/row relative transition-shadow duration-200`
      }
    >
      <span
        className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover/row:border-blue-500 z-10 transition-colors duration-200"
        aria-hidden="true"
      />
      {annotationBlock}
      {codeBlock}
    </section>
  )
})


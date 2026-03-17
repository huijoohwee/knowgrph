import React from 'react'
import type { RenderOpts } from '@/features/markdown/ui/MarkdownRendererTypes'
import { renderSafeHtmlBlock } from '@/features/markdown/ui/markdownPreviewLinks'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function HtmlCodeBlockRenderer({
  html,
  opts,
  fragmentsEnabled,
  fragmentStep,
  fragmentClassNames,
  fragmentTags,
}: {
  html: string
  opts: RenderOpts
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}) {
  const containerRef = React.useRef<HTMLElement | null>(null)
  const dragStateRef = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  const safe = React.useMemo(() => {
    return renderSafeHtmlBlock(String(html || ''), {
      activeDocumentPath: opts.activeDocumentPath,
      uiPanelTextFontClass: opts.uiPanelTextFontClass,
      uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
      markdownPresentationMode: opts.markdownPresentationMode,
      renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
      fragmentOptions:
        opts.markdownPresentationMode && fragmentsEnabled
          ? {
              enabled: true,
              currentStep: Number.isFinite(fragmentStep) ? Math.max(0, fragmentStep || 0) : 0,
              classNames: fragmentClassNames || [],
              tags: fragmentTags || [],
            }
          : null,
    })
  }, [
    fragmentClassNames,
    fragmentStep,
    fragmentTags,
    fragmentsEnabled,
    html,
    opts.activeDocumentPath,
    opts.markdownPresentationMode,
    opts.uiPanelMonospaceTextClass,
    opts.uiPanelTextFontClass,
  ])

  if (!safe) return null

  const handlePointerDown = (ev: React.PointerEvent<HTMLElement>) => {
    const el = containerRef.current
    if (!el) return
    if (ev.button !== 0) return
    dragStateRef.current = { x: ev.clientX, y: ev.clientY, left: el.scrollLeft, top: el.scrollTop }
    startPointerDrag({
      ev: ev.nativeEvent,
      cursor: 'grabbing',
      onMove: mv => {
        const st = dragStateRef.current
        if (!st) return
        const dx = mv.clientX - st.x
        const dy = mv.clientY - st.y
        try {
          el.scrollLeft = st.left - dx
          el.scrollTop = st.top - dy
        } catch {
          void 0
        }
      },
      onEnd: () => {
        dragStateRef.current = null
      },
      onCancel: () => {
        dragStateRef.current = null
      },
    })
  }

  return (
    <section
      ref={containerRef}
      className={`relative overflow-auto p-4 cursor-grab ${UI_THEME_TOKENS.code.bg} ${UI_THEME_TOKENS.code.text}`}
      onPointerDown={handlePointerDown}
    >
      {safe}
    </section>
  )
}

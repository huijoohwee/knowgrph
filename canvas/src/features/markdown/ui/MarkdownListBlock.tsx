import React from 'react'
import type { TokensList, Token } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import { addLineRangesToTokens } from '@/features/markdown/ui/markdownPreviewLex'
import MarkdownTokenRenderer from './MarkdownTokenRenderer'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownListBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  baseTextClass: string
  wrapClass: string
  highlightStyle?: React.CSSProperties
}

export const MarkdownListBlock = React.memo(function MarkdownListBlock({
  token: t,
  highlightClass,
  opts,
  baseTextClass,
  wrapClass,
  highlightStyle,
}: MarkdownListBlockProps) {
  const list = t as unknown as TokensList
  const ListTag = (list.ordered ? 'ol' : 'ul') as 'ol' | 'ul'
  const listClass = list.ordered ? 'list-decimal' : 'list-disc'
  
  return (
    <div
      className={['mt-3 mb-3', highlightClass].filter(Boolean).join(' ')}
      style={highlightStyle}
      data-start-line={t.startLine}
      data-end-line={t.endLine || t.startLine}
    >
      <ListTag className={[listClass, 'pl-5', baseTextClass, opts.uiPanelTextFontClass].join(' ')}>
        {list.items.map((item, j) => {
          const task = item.task ? (
            <input
              type="checkbox"
              checked={!!item.checked}
              readOnly
              className="mr-2 translate-y-[1px]"
            />
          ) : null
          return (
            <li key={j} className={[opts.uiPanelTextFontClass, wrapClass].filter(Boolean).join(' ')}>
              {task}
              <MarkdownTokenRenderer
                tokens={addLineRangesToTokens(item.tokens as unknown as Token[], 0)}
                activeDocumentPath={opts.activeDocumentPath}
                highlightedLineRange={null}
                markdownWordWrap={opts.markdownWordWrap}
                markdownPresentationMode={opts.markdownPresentationMode}
                uiPanelTextFontClass={opts.uiPanelTextFontClass}
                uiPanelMonospaceTextClass={opts.uiPanelMonospaceTextClass}
                mermaidFrontmatterConfig={opts.mermaidFrontmatterConfig}
                rootThemeMode={opts.rootThemeMode}
                previewOverlayScope={opts.previewOverlayScope}
                previewOverlayPortalTarget={opts.previewOverlayPortalTarget}
              />
            </li>
          )
        })}
      </ListTag>
    </div>
  )
})

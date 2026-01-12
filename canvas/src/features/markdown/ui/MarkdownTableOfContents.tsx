import React from 'react'
import type { TokenWithLines } from './markdownPreviewLex'
import { slugify } from '@/features/parsers/markdownJsonLd'

type MarkdownTableOfContentsProps = {
  tokens: TokenWithLines[]
  onSelect: (id: string) => void
  className?: string
  uiPanelTextFontClass: string
}

type TocItem = {
  id: string
  text: string
  depth: number
  index: number
}

export function MarkdownTableOfContents(props: MarkdownTableOfContentsProps) {
  const { tokens, onSelect, className, uiPanelTextFontClass } = props

  const items = React.useMemo(() => {
    const list: TocItem[] = []
    tokens.forEach((t, i) => {
      if (t.type === 'heading') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = t as any
        const text = h.text || ''
        const id = h.id || slugify(text)
        if (text) {
          list.push({
            id,
            text,
            depth: h.depth || 1,
            index: i,
          })
        }
      }
    })
    return list
  }, [tokens])

  if (items.length === 0) {
    return null
  }

  return (
    <nav className={`h-full overflow-y-auto p-4 ${className || ''}`}>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li
            key={`${item.id}-${idx}`}
            style={{ paddingLeft: `${(item.depth - 1) * 12}px` }}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`text-left w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 py-1 text-sm truncate ${uiPanelTextFontClass}`}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

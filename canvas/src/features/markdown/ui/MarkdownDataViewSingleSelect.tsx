import React from 'react'

import { Check } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'

const normalizeText = (raw: string): string => {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

const uniqueOptions = (vals: readonly string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of vals) {
    const s = normalizeText(v)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

export type MarkdownDataViewSingleSelectProps = {
  value: string
  options: readonly string[]
  canCreate: boolean
  autoFocus?: boolean
  onChange: (nextValue: string) => void
  onRequestClose?: () => void
}

export const MarkdownDataViewSingleSelect = React.memo(function MarkdownDataViewSingleSelect(
  props: MarkdownDataViewSingleSelectProps,
) {
  const selected = normalizeText(props.value)
  const selectedKey = selected.toLowerCase()
  const [query, setQuery] = React.useState('')

  const normalizedOptions = React.useMemo(() => {
    return uniqueOptions(Array.from(props.options || []))
  }, [props.options])

  const filtered = React.useMemo(() => {
    const q = normalizeText(query).toLowerCase()
    if (!q) return normalizedOptions
    return normalizedOptions.filter(o => o.toLowerCase().includes(q))
  }, [normalizedOptions, query])

  const createCandidate = React.useMemo(() => {
    if (!props.canCreate) return null
    const q = normalizeText(query)
    if (!q) return null
    if (normalizedOptions.some(o => o.toLowerCase() === q.toLowerCase())) return null
    return q
  }, [normalizedOptions, props.canCreate, query])

  const setAndClose = React.useCallback(
    (next: string) => {
      props.onChange(next)
      props.onRequestClose?.()
    },
    [props],
  )

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        props.onRequestClose?.()
        return
      }
      if (e.key === 'Enter') {
        const candidate = createCandidate
        if (!candidate) return
        e.preventDefault()
        setAndClose(candidate)
      }
    },
    [createCandidate, props, setAndClose],
  )

  return (
    <section
      className={['rounded border p-2', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border].join(' ')}
      aria-label="Single select"
    >
      <form className="flex items-center gap-2" aria-label="Select input" onSubmit={e => e.preventDefault()}>
        <input
          autoFocus={props.autoFocus}
          value={query}
          placeholder={MARKDOWN_DATA_VIEW_COPY.multiTagTypeHerePlaceholder}
          className={['w-full bg-transparent outline-none text-xs', UI_THEME_TOKENS.text.primary].join(' ')}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </form>

      <menu className="mt-2 m-0 p-0 list-none max-h-44 overflow-auto" aria-label="Options">
        <li className="list-none">
          <button
            type="button"
            className={['w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
            onClick={() => setAndClose('')}
            aria-pressed={!selected}
          >
            <span className={UI_THEME_TOKENS.text.primary}>—</span>
            {!selected ? <Check className={['w-4 h-4 ml-auto', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" /> : null}
          </button>
        </li>

        {createCandidate ? (
          <li className="list-none">
            <button
              type="button"
              className={['w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
              onClick={() => setAndClose(createCandidate)}
            >
              <span className={UI_THEME_TOKENS.text.primary}>{MARKDOWN_DATA_VIEW_COPY.multiTagCreateLabel(createCandidate)}</span>
            </button>
          </li>
        ) : null}

        {filtered.map(o => {
          const active = o.toLowerCase() === selectedKey
          return (
            <li key={o} className="list-none">
              <button
                type="button"
                className={['w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs', UI_THEME_TOKENS.button.hoverBg].join(' ')}
                onClick={() => setAndClose(o)}
                aria-pressed={active}
              >
                <span className={UI_THEME_TOKENS.text.primary}>{o}</span>
                {active ? <Check className={['w-4 h-4 ml-auto', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" /> : null}
              </button>
            </li>
          )
        })}
      </menu>
    </section>
  )
})

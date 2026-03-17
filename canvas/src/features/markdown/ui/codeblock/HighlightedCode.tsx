import React from 'react'
import * as hljsModule from 'highlight.js'

type HljsApi = import('highlight.js').HLJSApi

const resolveHljsApi = (): HljsApi | null => {
  const m = hljsModule as unknown as Record<string, unknown>
  const candidate = (m as { default?: unknown }).default ?? (m as { HighlightJS?: unknown }).HighlightJS ?? m
  const api = candidate as Partial<HljsApi>
  if (typeof api.highlight !== 'function') return null
  if (typeof api.highlightAuto !== 'function') return null
  if (typeof api.getLanguage !== 'function') return null
  return candidate as HljsApi
}

const escapeHtml = (text: string): string =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const HighlightedCode = React.memo(function HighlightedCode({
  code,
  lang,
  highlightLines,
}: {
  code: string
  lang: string
  highlightLines: Set<number> | null
}) {
  const highlighted = React.useMemo(() => {
    const hljs = resolveHljsApi()
    if (!hljs) return escapeHtml(code)

    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch {
        return hljs.highlightAuto(code).value
      }
    }

    return hljs.highlightAuto(code).value
  }, [code, lang])

  return (
    <section className="relative">
      {highlightLines ? (
        <span className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {code.split('\n').map((_, i) => (
            <span
              key={i}
              className={
                'block w-full h-[1.5em] ' +
                (highlightLines.has(i + 1)
                  ? 'bg-yellow-100/30 dark:bg-yellow-500/10 border-l-2 border-yellow-500'
                  : '')
              }
            />
          ))}
        </span>
      ) : null}
      <code
        className={`hljs language-${lang} !bg-transparent !p-0 block leading-[1.5em] relative z-10`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </section>
  )
})


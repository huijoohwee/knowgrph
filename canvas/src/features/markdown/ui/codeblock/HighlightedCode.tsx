import React from 'react'
import hljsCore from 'highlight.js/lib/core'
import javascriptLang from 'highlight.js/lib/languages/javascript'
import typescriptLang from 'highlight.js/lib/languages/typescript'
import jsonLang from 'highlight.js/lib/languages/json'
import pythonLang from 'highlight.js/lib/languages/python'
import bashLang from 'highlight.js/lib/languages/bash'
import markdownLang from 'highlight.js/lib/languages/markdown'
import yamlLang from 'highlight.js/lib/languages/yaml'
import xmlLang from 'highlight.js/lib/languages/xml'
import cssLang from 'highlight.js/lib/languages/css'
import sqlLang from 'highlight.js/lib/languages/sql'
import {
  MARKDOWN_CODE_FENCE_LINE_ROW_HEIGHT_CLASS,
  MARKDOWN_CODE_FENCE_LINE_SPACING_CLASS,
} from '@/features/markdown/ui/markdownEditSurfaceLayout'

type HljsApi = import('highlight.js').HLJSApi

const resolveHljsApi = (): HljsApi | null => {
  const api = hljsCore as Partial<HljsApi>
  if (typeof api.highlight !== 'function') return null
  if (typeof api.highlightAuto !== 'function') return null
  if (typeof api.getLanguage !== 'function') return null
  return hljsCore as HljsApi
}

let hljsLanguagesRegistered = false
const ensureHljsLanguages = (): void => {
  if (hljsLanguagesRegistered) return
  try {
    hljsCore.registerLanguage('javascript', javascriptLang)
    hljsCore.registerLanguage('js', javascriptLang)
    hljsCore.registerLanguage('typescript', typescriptLang)
    hljsCore.registerLanguage('ts', typescriptLang)
    hljsCore.registerLanguage('json', jsonLang)
    hljsCore.registerLanguage('python', pythonLang)
    hljsCore.registerLanguage('py', pythonLang)
    hljsCore.registerLanguage('bash', bashLang)
    hljsCore.registerLanguage('shell', bashLang)
    hljsCore.registerLanguage('markdown', markdownLang)
    hljsCore.registerLanguage('md', markdownLang)
    hljsCore.registerLanguage('yaml', yamlLang)
    hljsCore.registerLanguage('yml', yamlLang)
    hljsCore.registerLanguage('xml', xmlLang)
    hljsCore.registerLanguage('html', xmlLang)
    hljsCore.registerLanguage('css', cssLang)
    hljsCore.registerLanguage('sql', sqlLang)
  } catch {
    void 0
  }
  hljsLanguagesRegistered = true
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
    ensureHljsLanguages()
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
                `block w-full ${MARKDOWN_CODE_FENCE_LINE_ROW_HEIGHT_CLASS} ` +
                (highlightLines.has(i + 1)
                  ? 'bg-yellow-100/30 dark:bg-yellow-500/10 border-l-2 border-yellow-500'
                  : '')
              }
            />
          ))}
        </span>
      ) : null}
      <code
        className={`hljs language-${lang} !bg-transparent !p-0 block ${MARKDOWN_CODE_FENCE_LINE_SPACING_CLASS} relative z-10`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </section>
  )
})

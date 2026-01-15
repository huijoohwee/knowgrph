import React from 'react'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { jsonToMarkdown } from '@/features/markdown/jsonToMarkdown'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'

export type JsonMarkdownMode = JsonToMarkdownMode

type UseJsonMarkdownProps = {
  jsonSourceDocumentText: string | null
  markdownDocumentText: string | null
  markdownDocumentName: string | null
  setMarkdownDocument: (name: string | null, text: string) => void
  setMarkdownText: (text: string) => void
}

export function useJsonMarkdown(props: UseJsonMarkdownProps) {
  const {
    jsonSourceDocumentText,
    markdownDocumentText,
    markdownDocumentName,
    setMarkdownDocument,
    setMarkdownText,
  } = props

  const [jsonMarkdownMode, setJsonMarkdownMode] = React.useState<JsonMarkdownMode>(() =>
    lsJson<JsonMarkdownMode>(
      LS_KEYS.jsonMarkdownMode,
      'auto',
      value =>
        value === 'table' ||
        value === 'key-value' ||
        value === 'hierarchical' ||
        value === 'auto'
          ? value
          : 'auto',
    ),
  )

  const deferredMarkdownText = useDebouncedValue(markdownDocumentText, 200)
  const deferredJsonSourceText = useDebouncedValue(jsonSourceDocumentText, 200)

  const jsonMarkdownSuggestedMode = React.useMemo((): JsonMarkdownMode => {
    try {
      const jsonTrimmed = (deferredJsonSourceText || '').trim()
      if (!jsonTrimmed) return 'auto'
      const parsed = JSON.parse(jsonTrimmed)
      const renderedTable = jsonToMarkdown(parsed, { defaultMode: 'table' }, 'table')
      const renderedKeyValue = jsonToMarkdown(parsed, { defaultMode: 'key-value' }, 'key-value')
      const renderedHierarchical = jsonToMarkdown(
        parsed,
        { defaultMode: 'hierarchical' },
        'hierarchical',
      )
      const original = deferredMarkdownText || ''
      const isClose = (candidate: string) => {
        const a = candidate.trim()
        const b = original.trim()
        if (!a || !b) return false
        const minLen = Math.min(a.length, b.length)
        if (!minLen) return false
        let same = 0
        const limit = Math.min(minLen, 1024)
        for (let i = 0; i < limit; i += 1) {
          if (a[i] === b[i]) same += 1
        }
        const ratio = same / limit
        return ratio >= 0.9
      }
      if (isClose(renderedTable)) return 'table'
      if (isClose(renderedKeyValue)) return 'key-value'
      if (isClose(renderedHierarchical)) return 'hierarchical'
      return 'auto'
    } catch {
      return 'auto'
    }
  }, [deferredJsonSourceText, deferredMarkdownText])

  const parsedJsonSource = React.useMemo(() => {
    try {
      const rawJson = (jsonSourceDocumentText || '').trim()
      if (!rawJson) return null
      return JSON.parse(rawJson)
    } catch {
      return null
    }
  }, [jsonSourceDocumentText])

  const jsonModeEnabled = !!parsedJsonSource
  const isJsonBacked = React.useMemo(
    () => !!(jsonSourceDocumentText && jsonSourceDocumentText.trim()),
    [jsonSourceDocumentText],
  )

  React.useEffect(() => {
    if (!parsedJsonSource) return
    try {
      const mode = jsonMarkdownMode
      const markdown = jsonToMarkdown(parsedJsonSource, { defaultMode: mode }, mode)
      setMarkdownDocument(markdownDocumentName, markdown)
      setMarkdownText(markdown)
    } catch {
      void 0
    }
  }, [jsonMarkdownMode, parsedJsonSource, markdownDocumentName, setMarkdownDocument, setMarkdownText])

  React.useEffect(() => {
    lsSetJson<JsonMarkdownMode>(LS_KEYS.jsonMarkdownMode, jsonMarkdownMode)
  }, [jsonMarkdownMode])

  return {
    jsonMarkdownMode,
    setJsonMarkdownMode,
    jsonMarkdownSuggestedMode,
    jsonModeEnabled,
    isJsonBacked,
    deferredMarkdownText,
  }
}

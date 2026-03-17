import React from 'react'
import * as yaml from 'js-yaml'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useDebouncedValue } from '@/features/hooks/useDebouncedValue'
import { UI_COPY } from '@/lib/config'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { useRootThemeMode } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type MarkdownStructuredTextEditorLanguage = 'json' | 'yaml' | 'text'

type MarkdownStructuredTextEditorProps = {
  value: string
  onChange: (v: string) => void
  className?: string
  onBlur?: () => void
  onValidityChange?: (ok: boolean, errors: string[]) => void
  validate?: (obj: unknown) => { ok: boolean; errors: string[] }
  language?: MarkdownStructuredTextEditorLanguage
  uri?: string
}

export function MarkdownStructuredTextEditor({
  value,
  onChange,
  className,
  onBlur,
  onValidityChange,
  validate,
  language = 'json',
  uri,
}: MarkdownStructuredTextEditorProps) {
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')
  const rootThemeMode = useRootThemeMode()
  const [errors, setErrors] = React.useState<string[]>([])
  const [ok, setOk] = React.useState<boolean>(true)
  const onValidityChangeRef = React.useRef<MarkdownStructuredTextEditorProps['onValidityChange']>(onValidityChange)
  const debouncedValue = useDebouncedValue(value, 300)

  React.useEffect(() => {
    onValidityChangeRef.current = onValidityChange
  }, [onValidityChange])

  React.useEffect(() => {
    const nextValue = debouncedValue || ''
    if (language === 'json') {
      try {
        const obj = nextValue.trim() ? (JSON.parse(nextValue) as unknown) : {}
        const res = validate ? validate(obj) : { ok: true, errors: [] }
        setOk(res.ok)
        setErrors(res.errors || [])
        onValidityChangeRef.current?.(res.ok, res.errors || [])
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err || '')
        const errs = [`${UI_COPY.invalidJsonPrefix}${message}`]
        setOk(false)
        setErrors(errs)
        onValidityChangeRef.current?.(false, errs)
      }
      return
    }

    if (language === 'yaml') {
      try {
        const obj = nextValue.trim() ? (yaml.load(nextValue) as unknown) : {}
        const res = validate ? validate(obj) : { ok: true, errors: [] }
        setOk(res.ok)
        setErrors(res.errors || [])
        onValidityChangeRef.current?.(res.ok, res.errors || [])
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err || '')
        const errs = [`${UI_COPY.invalidYamlPrefix}${message}`]
        setOk(false)
        setErrors(errs)
        onValidityChangeRef.current?.(false, errs)
      }
      return
    }

    setOk(true)
    setErrors([])
    onValidityChangeRef.current?.(true, [])
  }, [debouncedValue, language, validate])

  const editorUri = React.useMemo(() => {
    if (typeof uri === 'string' && uri.trim()) return uri.trim()
    const suffix =
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : String(Date.now())
    const ext = language === 'yaml' ? 'yml' : language === 'text' ? 'txt' : 'json'
    return `inmemory://markdown-structured/${suffix}.${ext}`
  }, [language, uri])

  const monacoLanguage = language === 'json' ? 'json' : 'plaintext'

  return (
    <section className={className || ''} aria-label="Structured Text Editor">
      <MonacoTextEditor
        value={value}
        onChange={onChange}
        language={monacoLanguage}
        uri={editorUri}
        themeMode={rootThemeMode}
        wordWrap
        onBlur={onBlur}
        className={[
          'w-full h-full border rounded',
          ok ? UI_THEME_TOKENS.input.border : 'border-red-400 dark:border-red-600',
          UI_THEME_TOKENS.input.bg,
          UI_THEME_TOKENS.input.text,
          uiPanelMonospaceTextClass,
        ].join(' ')}
      />
      {!ok && errors.length > 0 && (
        <footer className={['mt-1', uiPanelMicroLabelTextSizeClass, 'text-red-600'].join(' ')}>
          {errors[0]}
        </footer>
      )}
    </section>
  )
}

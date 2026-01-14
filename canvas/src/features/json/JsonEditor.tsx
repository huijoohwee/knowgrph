import React from 'react'
import yaml from 'js-yaml'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'
import { useRootThemeMode } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

type JsonEditorProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  onValidityChange?: (ok: boolean, errors: string[]) => void
  validate?: (obj: unknown) => { ok: boolean; errors: string[] }
  language?: 'json' | 'text' | 'yaml'
  uri?: string
}

export const JSON_EDITOR_LINE_HEIGHT_REM = 1

export default function JsonEditor({
  value,
  onChange,
  placeholder,
  className = '',
  onValidityChange,
  validate,
  language = 'json',
  uri,
}: JsonEditorProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const rootThemeMode = useRootThemeMode()
  const [errors, setErrors] = React.useState<string[]>([])
  const [ok, setOk] = React.useState<boolean>(true)
  const onValidityChangeRef = React.useRef<JsonEditorProps['onValidityChange']>(onValidityChange)

  React.useEffect(() => {
    onValidityChangeRef.current = onValidityChange
  }, [onValidityChange])

  React.useEffect(() => {
    const nextValue = value || ''
    if (language === 'json') {
      try {
        const obj = nextValue.trim() ? (JSON.parse(nextValue) as unknown) : {}
        const res = validate ? validate(obj) : { ok: true, errors: [] }
        setOk(res.ok)
        setErrors(res.errors || [])
        onValidityChangeRef.current?.(res.ok, res.errors || [])
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err || '')
        setOk(false)
        const errs = [`${UI_COPY.invalidJsonPrefix}${message}`]
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
        setOk(false)
        const errs = [`${UI_COPY.invalidYamlPrefix}${message}`]
        setErrors(errs)
        onValidityChangeRef.current?.(false, errs)
      }
      return
    }

    setOk(true)
    setErrors([])
    onValidityChangeRef.current?.(true, [])
  }, [language, validate, value])

  const editorUri = React.useMemo(() => {
    if (typeof uri === 'string' && uri.trim()) return uri.trim()
    const suffix =
      typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : String(Date.now())
    return `inmemory://json-editor/${suffix}.${language === 'yaml' ? 'yml' : language === 'text' ? 'txt' : 'json'}`
  }, [language, uri])

  const monacoLanguage = language === 'json' ? 'json' : language === 'yaml' ? 'plaintext' : 'plaintext'

  return (
    <section className={className}>
      <MonacoTextEditor
        value={value}
        onChange={onChange}
        language={monacoLanguage}
        uri={editorUri}
        themeMode={rootThemeMode}
        wordWrap
        className={[
          'w-full h-full border rounded',
          ok ? 'border-gray-300' : 'border-red-400',
          uiPanelMonospaceTextClass,
        ].join(' ')}
      />
      {!ok && errors.length > 0 && (
        <footer className={['mt-1', uiPanelMicroLabelTextSizeClass, 'text-red-600'].join(' ')}>
          {errors[0]}
        </footer>
      )}
      {placeholder ? (
        <section className="sr-only" aria-label="placeholder">
          {placeholder}
        </section>
      ) : null}
    </section>
  )
}

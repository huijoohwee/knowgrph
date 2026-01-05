import React from 'react'
import yaml from 'js-yaml'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'

type JsonEditorProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  onValidityChange?: (ok: boolean, errors: string[]) => void
  validate?: (obj: unknown) => { ok: boolean; errors: string[] }
  language?: 'json' | 'text' | 'yaml'
}

export const JSON_EDITOR_LINE_HEIGHT_REM = 1

const highlightJson = (text: string) => {
  try {
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    return safe
      .replace(/(".*?")(:)?/g, (m, g1, g2) => `<span class="text-teal-700">${g1}</span>${g2 || ''}`)
      .replace(/\b(true|false|null)\b/g, '<span class="text-purple-700">$1</span>')
      .replace(/(-?\d+(?:\.\d+)?)/g, '<span class="text-blue-700">$1</span>')
  } catch {
    return text
  }
}

export default function JsonEditor({ value, onChange, placeholder, className = '', onValidityChange, validate, language = 'json' }: JsonEditorProps) {
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const [errors, setErrors] = React.useState<string[]>([])
  const [ok, setOk] = React.useState<boolean>(true)
  const preRef = React.useRef<HTMLPreElement | null>(null)
  const taRef = React.useRef<HTMLTextAreaElement | null>(null)
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

  const onLocalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const onScroll = () => {
    const ta = taRef.current
    const pre = preRef.current
    if (!ta || !pre) return
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }

  const html = React.useMemo(() => {
    const text = value || ''
    if (language === 'json') return highlightJson(text)
    try {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    } catch {
      return text
    }
  }, [value, language])

  const extraBottomPad = !ok && errors.length > 0 ? 20 : 0

  return (
    <div className={`relative ${className}`}>
      {language === 'json' && (
        <pre
          ref={preRef}
          aria-hidden="true"
          className={`absolute inset-0 m-0 overflow-auto px-2 py-2 border border-transparent rounded leading-[1rem] whitespace-pre-wrap break-words pointer-events-none select-none text-gray-800 ${uiPanelMonospaceTextClass}`}
          style={{ paddingBottom: extraBottomPad, lineHeight: `${JSON_EDITOR_LINE_HEIGHT_REM}rem` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      <textarea
        ref={taRef}
        value={value}
        onChange={onLocalChange}
        onScroll={onScroll}
        placeholder={placeholder}
        className={`relative w-full h-full px-2 py-2 border ${ok ? 'border-gray-300' : 'border-red-400'} rounded leading-[1rem] whitespace-pre-wrap break-words overflow-auto resize-none bg-transparent ${uiPanelMonospaceTextClass}`}
        style={{ paddingBottom: extraBottomPad, lineHeight: `${JSON_EDITOR_LINE_HEIGHT_REM}rem` }}
      />
      {!ok && errors.length > 0 && (
        <div className={`absolute bottom-1 left-2 ${uiPanelMicroLabelTextSizeClass} text-red-600 bg-white/80 px-1 py-0.5 rounded`}>
          {errors[0]}
        </div>
      )}
    </div>
  )
}

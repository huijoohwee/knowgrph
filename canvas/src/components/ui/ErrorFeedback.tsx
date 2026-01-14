import React from 'react'
import { AlertCircle } from 'lucide-react'

type ErrorFeedbackProps = {
  title?: string
  error: unknown
  details?: string | null
  code?: string
  className?: string
}

const getCodeWrapClass = (wrap: boolean): string => (wrap ? 'whitespace-pre-wrap break-words' : '')

const sanitizeErrorText = (raw: unknown): string => {
  const text = raw instanceof Error ? raw.message : String(raw ?? '')
  const lines = text.split('\n').map(l => l.trimEnd())
  const out: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim()
    if (!line) continue
    if (/^at\s+/i.test(line)) continue
    if (/^error:\s*/i.test(line)) {
      out.push(line.replace(/^error:\s*/i, ''))
    } else {
      out.push(line)
    }
    if (out.length >= 3) break
  }
  return out.join('\n').trim()
}

export function ErrorFeedback({ title, error, details, code, className }: ErrorFeedbackProps) {
  const safeError = sanitizeErrorText(error)
  if (!safeError) return null

  return (
    <div
      className={[
        'mt-3 mb-3 p-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 overflow-auto',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-xs mb-2">
        <AlertCircle className="w-4 h-4" />
        <span>{title ? title : 'Error'}: {safeError}</span>
      </div>
      {details ? (
        <div className="text-[11px] text-red-700/80 dark:text-red-300/80 mb-2 whitespace-pre-wrap">
          {details}
        </div>
      ) : null}
      {code && (
        <pre className="m-0 overflow-x-auto">
          <code className={['font-mono text-xs text-gray-700 dark:text-gray-300', getCodeWrapClass(false)].join(' ')}>
            {code}
          </code>
        </pre>
      )}
    </div>
  )
}

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeMessageText } from '@/lib/ui'

type ErrorFeedbackProps = {
  title?: string
  error: unknown
  details?: string | null
  code?: string
  className?: string
}

export function ErrorFeedback({ title, error, details, code, className }: ErrorFeedbackProps) {
  const safeError = sanitizeMessageText(error, { maxLines: 3, stripErrorPrefix: true })
  if (!safeError) return null

  return (
    <div
      className={cn(
        'mt-3 mb-3 p-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 overflow-auto',
        className,
      )}
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
          <code className="font-mono text-xs text-gray-700 dark:text-gray-300">
            {code}
          </code>
        </pre>
      )}
    </div>
  )
}

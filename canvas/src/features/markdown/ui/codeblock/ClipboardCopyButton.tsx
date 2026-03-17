import React from 'react'
import { Check, Copy } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function ClipboardCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 2000)
    })
  }

  return (
    <button
      aria-label="Copy code to clipboard"
      className={`p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${UI_THEME_TOKENS.text.secondary}`}
      onClick={handleCopy}
      type="button"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}


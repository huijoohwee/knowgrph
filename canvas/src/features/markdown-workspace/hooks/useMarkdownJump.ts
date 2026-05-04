import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

export function useMarkdownJump() {
  const [pendingScrollLine, setPendingScrollLine] = React.useState<number | null>(null)
  const jumpFlashSeqRef = React.useRef(0)
  const [jumpFlash, setJumpFlash] = React.useState<{ line: number; seq: number } | null>(null)
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)

  const triggerJump = React.useCallback((line: number) => {
    jumpFlashSeqRef.current += 1
    setJumpFlash({ line, seq: jumpFlashSeqRef.current })
    setPendingScrollLine(line)
  }, [])

  React.useEffect(() => {
    if (!jumpFlash) return
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      timer = setTimeout(() => {
        setJumpFlash(current => (current && current.seq === jumpFlash.seq ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          clearTimeout(timer)
        } catch {
          void 0
        }
      }
    }
  }, [jumpFlash, selectionFlashDurationMs])

  return {
    pendingScrollLine,
    setPendingScrollLine,
    jumpFlash,
    triggerJump,
  }
}

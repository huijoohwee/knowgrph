import { useEffect, useRef } from 'react'

export function useSyncScrollElements(source: HTMLElement | null, target: HTMLElement | null, enabled: boolean = true) {
  const lockRef = useRef<{ owner: 'source' | 'target'; until: number } | null>(null)
  const unlockTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!source || !target || !enabled) return

    const clearUnlockTimer = () => {
      const t = unlockTimerRef.current
      if (t == null) return
      unlockTimerRef.current = null
      try {
        window.clearTimeout(t)
      } catch {
        void 0
      }
    }

    const scheduleUnlock = () => {
      clearUnlockTimer()
      try {
        unlockTimerRef.current = window.setTimeout(() => {
          lockRef.current = null
          unlockTimerRef.current = null
        }, 90)
      } catch {
        lockRef.current = null
      }
    }

    const canSync = (owner: 'source' | 'target') => {
      const lock = lockRef.current
      if (!lock) return true
      const now = Date.now()
      if (now > lock.until) {
        lockRef.current = null
        return true
      }
      return lock.owner === owner
    }

    const clamp01 = (n: number) => (n <= 0 ? 0 : n >= 1 ? 1 : n)

    const getScrollRatio = (el: HTMLElement) => {
      const max = Math.max(1, el.scrollHeight - el.clientHeight)
      return clamp01(el.scrollTop / max)
    }

    const setScrollRatio = (el: HTMLElement, ratio: number) => {
      const max = Math.max(0, el.scrollHeight - el.clientHeight)
      el.scrollTop = Math.round(clamp01(ratio) * max)
    }

    const handleSourceScroll = () => {
      if (!canSync('source')) return
      lockRef.current = { owner: 'source', until: Date.now() + 140 }
      const ratio = getScrollRatio(source)
      const before = target.scrollTop
      setScrollRatio(target, ratio)
      if (Math.abs(target.scrollTop - before) > 1) scheduleUnlock()
    }

    const handleTargetScroll = () => {
      if (!canSync('target')) return
      lockRef.current = { owner: 'target', until: Date.now() + 140 }
      const ratio = getScrollRatio(target)
      const before = source.scrollTop
      setScrollRatio(source, ratio)
      if (Math.abs(source.scrollTop - before) > 1) scheduleUnlock()
    }

    source.addEventListener('scroll', handleSourceScroll, { passive: true })
    target.addEventListener('scroll', handleTargetScroll, { passive: true })

    return () => {
      source.removeEventListener('scroll', handleSourceScroll)
      target.removeEventListener('scroll', handleTargetScroll)
      clearUnlockTimer()
      lockRef.current = null
    }
  }, [enabled, source, target])
}

export function useSyncScroll(
  sourceRef: React.MutableRefObject<HTMLElement | null>,
  targetRef: React.MutableRefObject<HTMLElement | null>,
  enabled: boolean = true,
) {
  useSyncScrollElements(sourceRef.current, targetRef.current, enabled)
}

import React from 'react'
export {
  ResponsiveNumberRow as NumberRow,
  ResponsiveSelectRow as SelectRow,
  ResponsiveToggleRow as ToggleRow,
} from '@/lib/ui/responsiveControlRows'

export const normalizeCompactControlsBreakpointPx = (value: unknown): number => {
  const fallback = 768
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(360, Math.min(1440, Math.round(value)))
}

export function useCompactControls(enabled: boolean, breakpointPx: number): boolean {
  const [compact, setCompact] = React.useState(false)

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setCompact(false)
      return
    }
    const mediaQuery = window.matchMedia(`(max-width: ${Math.max(1, breakpointPx)}px)`)
    const apply = (matches: boolean) => setCompact(matches)
    apply(mediaQuery.matches)
    const onChange = (event: MediaQueryListEvent) => apply(event.matches)
    try {
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    } catch {
      mediaQuery.addListener(onChange)
      return () => mediaQuery.removeListener(onChange)
    }
  }, [breakpointPx, enabled])

  return compact
}

import React from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.matchMedia !== 'function') return

    const mql = window.matchMedia(query)
    const onChange = () => setMatches(Boolean(mql.matches))
    onChange()

    try {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    } catch {
      mql.addListener(onChange)
      return () => mql.removeListener(onChange)
    }
  }, [query])

  return matches
}


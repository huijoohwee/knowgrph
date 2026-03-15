export function stripZoomViewKeyVariant(key: string | null | undefined): { exact: string | null; base: string | null } {
  const raw = typeof key === 'string' ? key : ''
  const exact = raw.trim() ? raw.trim() : null
  if (!exact) return { exact: null, base: null }

  const withoutDesignSuffix = (() => {
    const idx = exact.indexOf('::webpage:')
    if (idx < 0) return exact
    return exact.slice(0, idx)
  })()

  const parts = withoutDesignSuffix.split('|')
  if (parts.length < 2) return { exact, base: withoutDesignSuffix }
  if (String(parts[0] || '') !== '2d') return { exact, base: withoutDesignSuffix }
  parts[1] = ''
  return { exact, base: parts.join('|') }
}


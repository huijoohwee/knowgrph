export const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export const tokenizePreserveCase = (text: string): string[] => {
  const raw = String(text || '')
  const matches = raw.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+(?:\.\d+)?/g)
  if (!matches) return []
  return matches.map(t => t.trim()).filter(Boolean)
}

export const lemmatizeNaive = (token: string): string => {
  const t = String(token || '').trim().toLowerCase()
  if (!t) return ''
  const stripped = t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
  if (!stripped) return ''
  if (stripped === 'known') return 'know'
  if (stripped === 'has') return 'have'
  if (stripped.length > 4 && stripped.endsWith('ing')) return stripped.slice(0, -3)
  if (stripped.length > 3 && stripped.endsWith('ed')) return stripped.slice(0, -2)
  if (stripped.length > 3 && stripped.endsWith('es')) return stripped.slice(0, -2)
  if (stripped.length > 3 && stripped.endsWith('s')) return stripped.slice(0, -1)
  return stripped
}

export const hfToySubwordsFromText = (text: string): string[] => {
  const raw = String(text || '')
  const parts = raw.match(/[A-Za-z]+|\d+(?:\.\d+)?|[^\sA-Za-z0-9]/g) || []
  const out: string[] = []

  const splitAlpha = (word: string): string[] => {
    if (!word) return []
    if (word.length > 8 && /^[A-Z]/.test(word)) {
      const mid = Math.floor(word.length / 2)
      return [word.slice(0, mid), word.slice(mid)]
    }
    if (word.length > 10) {
      const mid = Math.floor(word.length / 2)
      return [word.slice(0, mid), word.slice(mid)]
    }
    return [word]
  }

  for (const p of parts) {
    if (!p) continue
    if (/^\d+\.\d+$/.test(p)) {
      const [a, b] = p.split('.', 2)
      if (a) out.push(a)
      out.push('.')
      if (b) out.push(b)
      continue
    }
    if (p.includes('-')) {
      p.split(/(-)/g)
        .filter(Boolean)
        .forEach(x => {
          if (x === '-') out.push('-')
          else splitAlpha(x).forEach(s => out.push(s))
        })
      continue
    }
    if (/^[A-Za-z]+$/.test(p)) {
      splitAlpha(p).forEach(s => out.push(s))
      continue
    }
    out.push(p)
  }

  return out.filter(Boolean)
}


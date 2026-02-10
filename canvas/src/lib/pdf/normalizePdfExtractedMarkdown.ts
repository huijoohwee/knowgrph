const hasSpacingArtifacts = (line: string): boolean => {
  const s = String(line || '')
  if (!s) return false
  return (
    /(?:^|[^A-Za-z0-9])[A-Za-z0-9](?:\s+[A-Za-z0-9]){3,}(?:$|[^A-Za-z0-9])/.test(s) ||
    /\b(?:\d\s+){2,}\d\b/.test(s) ||
    /[A-Za-z]\s*-\s*[A-Za-z]/.test(s) ||
    /[A-Za-z]\s*[’']\s*[A-Za-z]/.test(s)
  )
}

const countSingleCharTokens = (text: string): number => {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let count = 0
  for (const t of tokens) {
    if (t.length !== 1) continue
    if (/^[A-Za-z0-9]$/.test(t)) count += 1
  }
  return count
}

const STOPWORD_PREFIXES = new Set([
  'a',
  'i',
  'an',
  'as',
  'at',
  'be',
  'by',
  'do',
  'he',
  'in',
  'is',
  'it',
  'me',
  'my',
  'no',
  'of',
  'on',
  'or',
  'so',
  'to',
  'up',
  'us',
  'we',
  'the',
  'and',
  'for',
])

const isAllUpper = (t: string) => /^[A-Z0-9]+$/.test(t)
const isAllLower = (t: string) => /^[a-z0-9]+$/.test(t)

const normalizeAggressiveGroup = (group: string): string => {
  let tokens = String(group || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return ''

  const expanded: string[] = []
  for (const t of tokens) {
    const m = String(t || '').match(/^([A-Za-z0-9-]+)([:;,.!?])$/)
    if (m) {
      expanded.push(m[1], m[2])
      continue
    }
    expanded.push(t)
  }
  tokens = expanded

  const out: string[] = []
  let buf = ''
  let bufFromSplit = false

  const flush = () => {
    if (!buf) return
    out.push(buf)
    buf = ''
    bufFromSplit = false
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = String(tokens[i] || '')
    const next = i + 1 < tokens.length ? String(tokens[i + 1] || '') : ''
    const next2 = i + 2 < tokens.length ? String(tokens[i + 2] || '') : ''

    if (!tok) continue

    if (/^[,.:;!?]$/.test(tok)) {
      if (buf) buf += tok
      else if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]}${tok}`
      else out.push(tok)
      continue
    }

    if (tok === '%') {
      if (buf) buf += tok
      else if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]}%`
      else out.push('%')
      continue
    }

    if (tok === '+' || tok === '~') {
      flush()
      out.push(tok)
      continue
    }

    if (tok === '-' && (buf || out.length > 0) && next) {
      if (buf) buf += '-'
      else out[out.length - 1] = `${out[out.length - 1]}-`
      continue
    }

    if ((tok === '’' || tok === "'") && (buf || out.length > 0) && next) {
      if (buf) buf += tok
      else out[out.length - 1] = `${out[out.length - 1]}${tok}`
      continue
    }

    if (/^[A-Za-z0-9]$/.test(tok)) {
      const lower = tok.toLowerCase()
      const nextIsSingle = /^[A-Za-z0-9]$/.test(next)
      const combined = nextIsSingle ? `${tok}${next}`.toLowerCase() : ''
      const splitPrefix = nextIsSingle && /^[a-z0-9]{2,3}$/.test(String(next2 || '')) && (!combined || !STOPWORD_PREFIXES.has(combined))
      if (buf && combined && STOPWORD_PREFIXES.has(combined)) {
        flush()
        buf = tok
        bufFromSplit = true
        continue
      }
      if (buf && splitPrefix && (lower !== 'a' && lower !== 'i')) {
        flush()
        buf = tok
        bufFromSplit = true
        continue
      }
      if (lower === 'a' || lower === 'i') {
        const shouldTreatAsSplitPrefix = /^[A-Za-z0-9]$/.test(next) && /^[a-z0-9]{2,3}$/.test(String(next2 || ''))
        if (shouldTreatAsSplitPrefix) {
          flush()
          buf = tok
          bufFromSplit = true
          continue
        }
        flush()
        out.push(tok)
        continue
      }

      const nextLower = String(next || '').toLowerCase()
      const shouldStartNewFromSplit =
        !!buf &&
        bufFromSplit &&
        buf.length >= 3 &&
        !!next &&
        isAllLower(next) &&
        /^[a-z0-9]{2,4}$/.test(next) &&
        !STOPWORD_PREFIXES.has(nextLower)
      const shouldStartNew =
        !!buf &&
        !bufFromSplit &&
        !!next &&
        isAllLower(next) &&
        !STOPWORD_PREFIXES.has(nextLower) &&
        ((/^[a-z0-9]{2,3}$/.test(next) && /^[A-Za-z0-9]$/.test(next2)) || /^[a-z0-9]{2}$/.test(next))

      if (shouldStartNewFromSplit || shouldStartNew) {
        flush()
        buf = tok
        bufFromSplit = true
        continue
      }

      if (!buf) {
        buf = tok
        bufFromSplit = true
      } else {
        buf += tok
        bufFromSplit = true
      }
      continue
    }

    if (!buf) {
      buf = tok
      bufFromSplit = false
      continue
    }

    const bufLower = buf.toLowerCase()
    const nextLower = tok.toLowerCase()
    const bufIsStop = STOPWORD_PREFIXES.has(bufLower)
    const bufIsUpperAcronym = buf.length <= 4 && isAllUpper(buf) && isAllLower(tok)

    if (bufIsUpperAcronym) {
      flush()
      buf = tok
      bufFromSplit = false
      continue
    }

    const canMergeShortFragment =
      !bufFromSplit &&
      !bufIsStop &&
      !isAllUpper(buf) &&
      buf.length <= 3 &&
      /^[a-z]/.test(tok) &&
      /^[A-Za-z-]{2,}$/.test(tok)
    if (canMergeShortFragment) {
      buf += tok
      bufFromSplit = true
      continue
    }

    if (bufFromSplit && STOPWORD_PREFIXES.has(nextLower) && buf.length >= 3 && !buf.includes('-')) {
      flush()
      buf = tok
      bufFromSplit = false
      continue
    }

    const canMergeStopwordPrefix = bufIsStop && tok.length <= 2 && isAllLower(tok) && /^[A-Za-z0-9]$/.test(next)

    const canMergeHyphenFragment = (() => {
      const idx = buf.lastIndexOf('-')
      if (idx < 0) return false
      const frag = buf.slice(idx + 1)
      if (!/^[a-z]{1,4}$/i.test(frag)) return false
      if (!isAllLower(tok)) return false
      return frag.length <= 3 && tok.length <= 4
    })()

    if (bufFromSplit) {
      const tokLower = nextLower
      const shouldAppendSplitContinuation =
        (/^[a-z0-9]+$/.test(tok) && buf.length <= 2) ||
        (/^[a-z0-9]{1,3}$/.test(tok) && !STOPWORD_PREFIXES.has(tokLower)) ||
        (/^[a-z0-9]{1,3}$/.test(tok) && /^[A-Za-z0-9]$/.test(next)) ||
        /^[a-z][A-Z]/.test(tok) ||
        canMergeHyphenFragment
      if (STOPWORD_PREFIXES.has(tokLower) && buf.length >= 3 && !buf.includes('-')) {
        flush()
        buf = tok
        bufFromSplit = false
        continue
      }
      if (shouldAppendSplitContinuation || canMergeStopwordPrefix) {
        buf += tok
        bufFromSplit = true
        continue
      }
      flush()
      buf = tok
      bufFromSplit = false
      continue
    }

    if (canMergeStopwordPrefix || canMergeHyphenFragment) {
      buf += tok
      bufFromSplit = true
      continue
    }

    flush()
    buf = tok
    bufFromSplit = false
    void bufLower
    void nextLower
  }

  flush()

  return out.join(' ')
}

const normalizeGroup = (group: string): string => {
  const raw = String(group || '')
  if (!raw.trim()) return ''
  const leading = raw.match(/^\s*/)?.[0] ?? ''
  const trailing = raw.match(/\s*$/)?.[0] ?? ''
  let s = raw.trim().replace(/\s+/g, ' ')

  const singleCharTokens = countSingleCharTokens(s)
  const aggressive = singleCharTokens >= 4

  const mergeSpacedRuns = (v: string) => {
    let out = v
    out = out.replace(/\b(?:[A-Za-z0-9]\s+){2,}[A-Za-z0-9]\b/g, m => m.replace(/\s+/g, ''))
    out = out.replace(/\b(?:\d\s+){2,}\d\b/g, m => m.replace(/\s+/g, ''))
    return out
  }

  const tightenPunctuation = (v: string) => {
    let out = v
    out = out.replace(/([0-9])\s*\.\s*([0-9])/g, '$1.$2')
    out = out.replace(/([0-9])\s*,\s*([0-9])/g, '$1,$2')
    out = out.replace(/([0-9])\s*%\b/g, '$1%')
    out = out.replace(/([A-Za-z])\s*-\s*([A-Za-z])/g, '$1-$2')
    out = out.replace(/([A-Za-z])\s*([’'])\s*([A-Za-z])/g, '$1$2$3')
    out = out.replace(/([A-Za-z0-9])\s*\+\s*([A-Za-z0-9])/g, '$1 + $2')
    out = out.replace(/([A-Za-z0-9])\s*~\s*([0-9])/g, '$1 ~$2')
    out = out.replace(/%([A-Za-z])/g, '% $1')
    out = out.replace(/:\s*([A-Za-z])/g, ': $1')
    return out
  }

  if (aggressive) {
    s = normalizeAggressiveGroup(s)
    s = tightenPunctuation(mergeSpacedRuns(s))
    for (let i = 0; i < 3; i += 1) {
      const before = s
      s = s.replace(/\b([A-Za-z]{1,4})\s+([a-z][A-Za-z-]{1,12})\b/g, (m, a: string, b: string) => {
        const al = a.toLowerCase()
        if (STOPWORD_PREFIXES.has(al)) return m
        if (isAllUpper(a) && a.length <= 4) return m
        if (a.length > 3 && b.length > 3) return m
        return `${a}${b}`
      })
      s = tightenPunctuation(mergeSpacedRuns(s))
      if (s === before) break
    }
    s = s.replace(/([a-z])to([a-z])/g, '$1 to $2')
    s = s.replace(/([a-z])of([a-z])/g, '$1 of $2')
    s = s.replace(/\bto(?=[a-z]{3,})/g, 'to ')
    s = s.replace(/\bof(?=[a-z]{3,})/g, 'of ')
    s = s.replace(/\b([a-z]{2,}er)\s+(y[a-z]{3,})\b/g, '$1$2')
    s = s.replace(/([0-9]\.[0-9])\s+([0-9])/g, '$1$2')
    s = s.replace(/([0-9])\s+([0-9]%\b)/g, '$1$2')
    s = s.replace(/([A-Z]{2,})([a-z])/g, '$1 $2')
    s = s.replace(/\b([B-HJ-Z])\s+([a-z]{2,})\b/g, '$1$2')
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2')
    s = s.replace(/\s+/g, ' ').trim()
  } else {
    s = tightenPunctuation(mergeSpacedRuns(s))
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2')
    s = s.replace(/\s+/g, ' ').trim()
  }

  return `${leading}${s}${trailing}`
}

const normalizeSpacedLine = (line: string): string => {
  const raw = String(line || '')
  if (!hasSpacingArtifacts(raw)) return raw
  const leading = raw.match(/^\s*/)?.[0] ?? ''
  const trailing = raw.match(/\s*$/)?.[0] ?? ''
  const trimmed = raw.trim()
  const groups = trimmed.split(/\s{2,}/g)
  const normalizedGroups = groups.map(normalizeGroup).filter(g => String(g || '').trim())
  const joined = normalizedGroups.join(' ')
  return `${leading}${joined}${trailing}`
}

export function normalizePdfExtractedMarkdown(markdown: string): string {
  const raw = String(markdown || '')
  if (!raw) return ''
  if (!raw.includes(' ')) return raw
  const lines = raw.split(/\r?\n/)
  let changed = false
  const out = lines.map((line) => {
    const next = normalizeSpacedLine(line)
    if (next !== line) changed = true
    return next
  })
  return changed ? out.join('\n') : raw
}

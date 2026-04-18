export const isMermaidCodeFenceLang = (lang: string): boolean => {
  const v = String(lang || '').trim().toLowerCase()
  return v === 'mermaid' || v === 'mmd'
}

export const normalizeMermaidCodeForRuntime = (code: string): string => {
  const lines = String(code || '').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')

    const clickRow = /^([\t ]*)click\s+([A-Za-z0-9_.:-]+)([\s\S]*)$/.exec(line)
    if (clickRow) {
      const indent = clickRow[1] || ''
      const nodeId = String(clickRow[2] || '').trim()
      const rest = String(clickRow[3] || '')
      const trimmedRest = rest.trim()
      const keywordMatch = /^(href|call)\b/i.exec(trimmedRest)
      const keyword = keywordMatch ? String(keywordMatch[1] || '').toLowerCase() : 'href'
      const afterKeyword = keywordMatch ? trimmedRest.slice(keywordMatch[0].length).trim() : trimmedRest

      const quoted = (() => {
        const out: string[] = []
        const rx = /"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'/g
        const matches = afterKeyword.match(rx) || []
        for (let j = 0; j < matches.length; j += 1) {
          const token = String(matches[j] || '').trim()
          if (token) out.push(token)
        }
        return out
      })()

      if (nodeId && keyword === 'href' && quoted.length >= 1) {
        const target = quoted[0]!
        const tooltip = quoted[1]
        lines[i] = `${indent}click ${nodeId} href ${target}${tooltip ? ` ${tooltip}` : ''}`
        continue
      }
      if (nodeId && keyword === 'call' && quoted.length >= 1) {
        const target = quoted[0]!
        const tooltip = quoted[1]
        lines[i] = `${indent}click ${nodeId} call ${target}${tooltip ? ` ${tooltip}` : ''}`
        continue
      }
    }

    if (!/-->|-\.->|==>/.test(line)) continue
    if (/^\s*%%/.test(line)) continue

    let next = line
    next = next.replace(/(\S)\s+(-->|-\.->|==>)/g, '$1$2')
    next = next.replace(/(-->|-\.->|==>)\s+/g, '$1')
    next = next.replace(/(-->|-\.->|==>)\s*\|/g, '$1|')
    next = next.replace(/(\|[^|]*\|)\s+/g, '$1')
    lines[i] = next
  }
  return lines.join('\n')
}

export const containsFrontmatterMermaid = (text: string): boolean => {
  const raw = String(text || '')
  if (!raw.trim()) return false
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!m || !m[1]) return false
  const fm = m[1]
  return /\bmermaid\s*:/i.test(fm)
}

export const normalizeMermaidMmdToMarkdown = (name: string, text: string): string => {
  const fileName = String(name || '').trim().toLowerCase()
  if (!fileName.endsWith('.mmd')) return String(text || '')

  const raw = String(text || '')
  const trimmed = raw.trim()
  if (!trimmed) return raw

  if (/^\s*(```+|~~~+)/m.test(raw)) return raw
  if (/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/.test(raw)) return raw

  return ['```mermaid', trimmed, '```', ''].join('\n')
}

export const isMarkdownLikeFileName = (name: string): boolean => {
  const lower = String(name || '').trim().toLowerCase()
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.mmd') ||
    lower.endsWith('.mdx')
  )
}

export const extractFirstFencedBlock = (markdown: string, lang: string): string | null => {
  const langLower = String(lang || '').trim().toLowerCase()
  if (!langLower) return null
  const lines = String(markdown || '').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    const trimmed = line.trim().toLowerCase()
    if (!trimmed.startsWith('```')) continue
    const fenceInfo = trimmed.slice(3).trim()
    if (fenceInfo !== langLower) continue
    const out: string[] = []
    for (let j = i + 1; j < lines.length; j += 1) {
      const l = String(lines[j] || '')
      if (l.trim().startsWith('```')) break
      out.push(l)
    }
    const text = out.join('\n').trim()
    return text ? text : null
  }
  return null
}


import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'

export const resolveTurnIntoFormatAction = (next: string): MarkdownFormatAction | 'codeBlock' | null => {
  if (next === 'heading2') return 'heading2'
  if (next === 'bulletList') return 'bulletList'
  if (next === 'numberedList') return 'numberedList'
  if (next === 'blockquote') return 'blockquote'
  if (next === 'code') return 'codeBlock'
  return null
}

export const toggleHeadingAcrossLines = (args: { text: string; level: 1 | 2 | 3 }): string => {
  const hashes = '#'.repeat(args.level) + ' '
  const lines = String(args.text || '').split(/\r?\n/)
  const allHave = lines.every(l => !l.trim() || l.startsWith(hashes))
  return lines
    .map(l => {
      if (!l.trim()) return l
      if (allHave) return l.startsWith(hashes) ? l.slice(hashes.length) : l
      if (/^#{1,6}\s+/.test(l)) return l.replace(/^#{1,6}\s+/, hashes)
      return `${hashes}${l}`
    })
    .join('\n')
}


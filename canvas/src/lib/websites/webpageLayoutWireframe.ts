import { renderAsciiFrame } from '@/lib/websites/webpageMarkdownArtifactAscii'

const normalize = (raw: string): string => String(raw ?? '').replace(/\s+/g, ' ').trim()

const truncate = (raw: string, max: number): string => {
  const s = normalize(raw)
  if (s.length <= max) return s
  if (max <= 1) return s.slice(0, max)
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + '…'
}

export function buildWebpageLayoutWireframeAsciiFromMarkdown(markdown: string): string {
  const text = String(markdown || '').replace(/\r/g, '')
  if (!text.trim()) return ''

  const headings: string[] = []
  const tocLabels: string[] = []
  for (const line of text.split('\n')) {
    const l = String(line || '').trim()
    const h = /^##\s+(.+)$/.exec(l)
    if (h) {
      const label = truncate(h[1] || '', 48)
      if (label && !/^table\s+of\s+contents$/i.test(label)) {
        if (!headings.some(x => x.toLowerCase() === label.toLowerCase())) headings.push(label)
      }
    }
    const toc = /^\s*\d+\.\s+\[([^\]]+)\]/.exec(l)
    if (toc) {
      const label = truncate(toc[1] || '', 24)
      if (label && !tocLabels.some(x => x.toLowerCase() === label.toLowerCase())) tocLabels.push(label)
    }
    if (headings.length >= 8 && tocLabels.length >= 8) break
  }

  const frames: string[] = []
  const navLine = tocLabels.length ? tocLabels.slice(0, 8).join(' | ') : ''
  if (navLine) {
    frames.push(renderAsciiFrame({ title: 'Navigation', width: 84, lines: ['', navLine, ''] }))
  }
  for (const h of headings.slice(0, 6)) {
    frames.push(renderAsciiFrame({ title: h, width: 84, lines: [''] }))
  }
  return frames.join('\n')
}

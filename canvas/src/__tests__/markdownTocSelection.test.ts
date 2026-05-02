import { applyMarkdownTocSelectionById } from '@/features/markdown/ui/markdownTocSelection'

export async function testApplyMarkdownTocSelectionByIdCentralizesTocSelectRevealBridge() {
  const activeIds: string[] = []
  const revealedLines: number[] = []
  const changed = applyMarkdownTocSelectionById({
    itemId: 'intro',
    lineById: new Map([
      ['intro', 12],
      ['next', 24],
    ]),
    setActiveItemId: itemId => {
      activeIds.push(itemId)
    },
    onRevealLine: line => {
      revealedLines.push(line)
    },
  })

  if (!changed) throw new Error('expected selection helper to reveal a known heading line')
  if (activeIds.join(',') !== 'intro') throw new Error(`expected active TOC id intro, got ${activeIds.join(',')}`)
  if (revealedLines.join(',') !== '12') throw new Error(`expected revealed line 12, got ${revealedLines.join(',')}`)

  const missingActiveIds: string[] = []
  const missingRevealedLines: number[] = []
  const missingChanged = applyMarkdownTocSelectionById({
    itemId: 'missing',
    lineById: new Map([['intro', 12]]),
    setActiveItemId: itemId => {
      missingActiveIds.push(itemId)
    },
    onRevealLine: line => {
      missingRevealedLines.push(line)
    },
  })

  if (missingChanged) throw new Error('expected selection helper to report false for unknown TOC ids')
  if (missingActiveIds.join(',') !== 'missing') throw new Error(`expected active TOC id to still update for missing item, got ${missingActiveIds.join(',')}`)
  if (missingRevealedLines.length !== 0) throw new Error(`expected no revealed lines for missing item, got ${missingRevealedLines.join(',')}`)
}

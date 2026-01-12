import { splitSlides, reorderSlidesInMarkdown } from '@/features/markdown/ui/markdownPreviewSlides'

export function testMarkdownSlidesReorderUpdatesOrderInSource() {
  const markdownLines = [
    '---',
    'title: Reorder Test',
    '---',
    '',
    '# Slide 1',
    '',
    'Content A',
    '',
    '---',
    '# Slide 2',
    '',
    'Content B',
    '',
    '---',
    '# Slide 3',
    '',
    'Content C',
    '',
  ]
  const markdownText = markdownLines.join('\n')
  const before = splitSlides(markdownText)
  if (before.slides.length !== 3) {
    throw new Error(`expected 3 slides before reorder, got ${before.slides.length}`)
  }
  const originalOrder = before.slides.map(s => s.text.trim())
  if (originalOrder[0] !== '# Slide 1\n\nContent A'.trim()) {
    throw new Error('unexpected text for slide 1 before reorder')
  }
  if (originalOrder[1] !== '# Slide 2\n\nContent B'.trim()) {
    throw new Error('unexpected text for slide 2 before reorder')
  }
  if (originalOrder[2] !== '# Slide 3\n\nContent C'.trim()) {
    throw new Error('unexpected text for slide 3 before reorder')
  }

  const nextText = reorderSlidesInMarkdown(markdownText, [2, 0, 1])
  const after = splitSlides(nextText)
  if (after.slides.length !== 3) {
    throw new Error(`expected 3 slides after reorder, got ${after.slides.length}`)
  }
  const reordered = after.slides.map(s => s.text.trim())
  if (reordered[0] !== originalOrder[2]) {
    throw new Error('expected slide 3 content to be first after reorder')
  }
  if (reordered[1] !== originalOrder[0]) {
    throw new Error('expected slide 1 content to be second after reorder')
  }
  if (reordered[2] !== originalOrder[1]) {
    throw new Error('expected slide 2 content to be third after reorder')
  }

  const separatorPattern = /\n\n---\n\n/g
  const matches = nextText.match(separatorPattern) || []
  if (matches.length !== 2) {
    throw new Error('expected blank line before and after each --- separator')
  }
}

export function testMarkdownSlidesReorderPreservesSlideFrontmatterAndNotes() {
  const markdownLines = [
    '---',
    'title: Deck With Per-Slide Frontmatter',
    '---',
    '',
    '---',
    'layout: cover',
    'background: "#111827"',
    '---',
    '',
    '# Cover Slide',
    '',
    'Content A',
    '',
    '<!--',
    'notes for slide 1',
    '-->',
    '',
    '---',
    'class: text-left',
    '---',
    '',
    '# Slide 2',
    '',
    'Content B',
    '',
    '<!--',
    'notes for slide 2',
    '-->',
    '',
  ]
  const markdownText = markdownLines.join('\n')
  const before = splitSlides(markdownText)
  if (before.slides.length !== 2) {
    throw new Error(`expected 2 slides before reorder, got ${before.slides.length}`)
  }
  const originalTexts = before.slides.map(s => s.text.trim())
  const originalNotes = before.slides.map(s => s.notes || '')
  if (!originalNotes[0].includes('notes for slide 1')) {
    throw new Error('expected notes for slide 1 before reorder')
  }
  if (!originalNotes[1].includes('notes for slide 2')) {
    throw new Error('expected notes for slide 2 before reorder')
  }

  const nextText = reorderSlidesInMarkdown(markdownText, [1, 0])
  const after = splitSlides(nextText)
  if (after.slides.length !== 2) {
    throw new Error(`expected 2 slides after reorder, got ${after.slides.length}`)
  }
  const reorderedTexts = after.slides.map(s => s.text.trim())
  const reorderedNotes = after.slides.map(s => s.notes || '')
  if (reorderedTexts[0] !== originalTexts[1]) {
    throw new Error('expected slide 2 body to be first after reorder')
  }
  if (reorderedTexts[1] !== originalTexts[0]) {
    throw new Error('expected slide 1 body to be second after reorder')
  }
  if (!reorderedNotes[0].includes('notes for slide 2')) {
    throw new Error('expected notes for slide 2 to move with slide body')
  }
  if (!reorderedNotes[1].includes('notes for slide 1')) {
    throw new Error('expected notes for slide 1 to move with slide body')
  }
}

export function testMarkdownSlidesReorderIgnoresSeparatorsInsideCodeFences() {
  const markdownLines = [
    '---',
    'title: Code Fence Reorder',
    '---',
    '',
    '# Slide 1',
    '',
    '```md',
    '---',
    'this separator is inside a fence',
    '```',
    '',
    '---',
    '# Slide 2',
    '',
    'Content B',
    '',
  ]
  const markdownText = markdownLines.join('\n')
  const before = splitSlides(markdownText)
  if (before.slides.length !== 2) {
    throw new Error(`expected 2 slides before reorder, got ${before.slides.length}`)
  }

  const nextText = reorderSlidesInMarkdown(markdownText, [1, 0])
  const after = splitSlides(nextText)
  if (after.slides.length !== 2) {
    throw new Error(`expected 2 slides after reorder, got ${after.slides.length}`)
  }
  const firstBody = after.slides[0].text
  if (!firstBody.includes('```md') || !firstBody.includes('this separator is inside a fence')) {
    throw new Error('expected fenced code block content to remain intact after reorder')
  }
}

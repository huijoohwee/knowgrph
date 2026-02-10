import { normalizePdfExtractedMarkdown } from '@/lib/pdf/normalizePdfExtractedMarkdown'

export async function testNormalizePdfExtractedMarkdownJoinsSpacedLetters() {
  const input = [
    '# document.pdf',
    '',
    'T h e  w o r l d ’ s  o n l y  f r e e  ',
    'b a n k .',
    '',
    'Normal line should stay intact.',
    '',
  ].join('\n')

  const out = normalizePdfExtractedMarkdown(input)

  if (!out.includes("The world’s only free")) {
    throw new Error(`expected spaced letters to normalize; got: ${JSON.stringify(out.split('\n')[2] || '')}`)
  }
  if (out.includes('T h e')) {
    throw new Error('expected output to remove spaced-letter runs')
  }
  if (!out.includes('Normal line should stay intact.')) {
    throw new Error('expected normal lines to remain unchanged')
  }

  await Promise.resolve()
}

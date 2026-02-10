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

export async function testNormalizePdfExtractedMarkdownFixesBrokenWordsAndNumbers() {
  const input = [
    '## Page 2',
    '',
    'P r o b l e mCr oss -bor der mone y is br ok en: FX spr e ads + r ails still t ak e ~6 . 4 9% on a v er age .',
    'U sers ju st w ant mone y t o w ork e v er ywher e , in st e ad o f managing it .',
    '',
  ].join('\n')

  const out = normalizePdfExtractedMarkdown(input)

  if (!out.includes('Problem Cross-border money is broken: FX spreads + rails still take ~6.49% on average.')) {
    throw new Error(`expected words/numbers to normalize; got: ${JSON.stringify(out.split('\n')[2] || '')}`)
  }
  if (!out.includes('Users just want money to work everywhere, instead of managing it.')) {
    throw new Error(`expected second line to normalize; got: ${JSON.stringify(out.split('\n')[3] || '')}`)
  }

  await Promise.resolve()
}

export async function testNormalizePdfExtractedMarkdownDoesNotMergeNormalShortWords() {
  const input = ['We are in Singapore.', 'I am a user.', 'Cross-border fees are high.'].join('\n')
  const out = normalizePdfExtractedMarkdown(input)
  if (out !== input) {
    throw new Error(`expected normal text to remain unchanged; got: ${JSON.stringify(out)}`)
  }
  await Promise.resolve()
}

import { parseContentStreamText } from '@/lib/pdf/native/pdfContentText'

export async function testPdfContentTextTokenizerAdvancesOnDictDelimiters() {
  const bytes = Buffer.from('BT << /Length 1 >> (Hi) Tj ET', 'latin1')
  const frags = parseContentStreamText(bytes, {})
  if (!Array.isArray(frags)) throw new Error('expected fragments array')
}


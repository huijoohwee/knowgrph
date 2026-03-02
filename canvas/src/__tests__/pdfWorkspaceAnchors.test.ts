import { buildAnchorMapFromMarkdown, resolveAnchorIdAfterSwitch } from '@/lib/pdf/pdfWorkspaceAnchors'

export async function testPdfWorkspaceAnchorMapBuildsStablePageAnchors() {
  const md = ['# Doc', '', '## Page 1', '', '### Images', '', '![Page 1](x)', '', '## Page 2', '', '### OCR', '', 'hello'].join('\n')
  const map = buildAnchorMapFromMarkdown({ docId: 'd', markdown: md })
  const ids = map.nodes.map(n => n.id)
  if (!ids.includes('page-1')) throw new Error('expected page-1')
  if (!ids.includes('page-1/images')) throw new Error('expected page-1/images')
  if (!ids.includes('page-2')) throw new Error('expected page-2')
  if (!ids.includes('page-2/ocr')) throw new Error('expected page-2/ocr')
  if (!map.domIdByAnchorId['page-1']) throw new Error('expected domId for page-1')
}

export async function testPdfWorkspaceAnchorResolutionFallsBackToNearestParent() {
  const mdA = ['## Page 3', '', '### Images', '', 'x'].join('\n')
  const mdB = ['## Page 3', '', 'x'].join('\n')
  const mapA = buildAnchorMapFromMarkdown({ docId: 'd', markdown: mdA })
  const mapB = buildAnchorMapFromMarkdown({ docId: 'd', markdown: mdB })
  const desired = mapA.nodes.find(n => n.id === 'page-3/images')?.id || 'page-3/images'
  const resolved = resolveAnchorIdAfterSwitch({ desired, nextMap: mapB })
  if (resolved !== 'page-3') throw new Error(`expected fallback to page-3, got ${resolved || 'null'}`)
}

import type { TextFragment } from './types'
import type { ParsedIndirectObject, PdfDict, PdfRef } from './pdfObjects'
import { deref, getDictValue, isArray, isDict, isName, isRef, readStream } from './pdfObjects'
import { buildFontUnicodeMaps } from './pdfCmap'
import { parseContentStreamText } from './pdfContentText'
import { collectDoXObjectNames, resolveXObjectRef } from './pdfXObjects'

export function extractTextFragmentsFromPage(args: {
  objects: Map<number, ParsedIndirectObject>
  pageResources: PdfDict | null
  contentBytes: Buffer
  maxDepth?: number
}): TextFragment[] {
  const maxDepth = typeof args.maxDepth === 'number' && args.maxDepth > 0 ? Math.floor(args.maxDepth) : 4
  const visited = new Set<number>()

  const extractFromStream = (contentBytes: Buffer, resources: PdfDict | null, depth: number): TextFragment[] => {
    const fontMaps = buildFontUnicodeMaps(args.objects, resources)
    const fragments = parseContentStreamText(contentBytes, fontMaps)
    if (depth >= maxDepth) return fragments
    const names = collectDoXObjectNames(contentBytes)
    for (const name of names) {
      const ref = resolveXObjectRef(args.objects, resources, name)
      if (!ref || visited.has(ref.obj)) continue
      const obj = args.objects.get(ref.obj)
      const dict = obj?.dict || null
      if (!dict) continue
      const subtype = getDictValue(dict, 'Subtype')
      if (!isName(subtype) || subtype.name !== 'Form') continue
      visited.add(ref.obj)
      const formResources = (() => {
        const rv = getDictValue(dict, 'Resources')
        const dv = deref(args.objects, rv)
        return isDict(dv) ? dv : resources
      })()
      const st = readStream(args.objects, ref)
      if (!st.bytes) continue
      fragments.push(...extractFromStream(st.bytes, formResources, depth + 1))
    }
    return fragments
  }

  return extractFromStream(args.contentBytes, args.pageResources, 0)
}

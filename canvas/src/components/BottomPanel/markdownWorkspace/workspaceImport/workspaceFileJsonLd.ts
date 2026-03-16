type WorkspaceFileDocument = { path: string; text: string }

function buildWorkspaceFileLeafName(args: { documentPath: string; fallbackName: string }): string {
  const docPathRaw = String(args.documentPath || '').trim()
  const fallbackNameRaw = String(args.fallbackName || '').trim() || 'document'
  const leafRaw = (docPathRaw || fallbackNameRaw).replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'document.md'
  const ext = leafRaw.toLowerCase().split('.').filter(Boolean).pop() || ''
  const keepExt = ext === 'md' || ext === 'markdown' || ext === 'mmd' || ext === 'mdx'
  const leaf = keepExt ? leafRaw : `${leafRaw}.md`
  const safeName = leaf.length > 200 ? leaf.slice(0, 200) : leaf
  return safeName || 'document.md'
}

export function buildWorkspaceFileJsonLdV1(args: { path: string; text: string }): Record<string, unknown> {
  return {
    '@context': {
      kg: 'http://example.org/kg#',
      version: 'kg:version',
      document: 'kg:document',
      path: 'kg:path',
      text: 'kg:text',
    },
    '@type': 'kg:WorkspaceFile',
    version: 1,
    document: {
      '@type': 'kg:WorkspaceDocument',
      path: String(args.path || '').trim(),
      text: String(args.text || ''),
    },
  }
}

function parseWorkspaceFileDocument(rawText: string): WorkspaceFileDocument | null {
  const raw = String(rawText || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    const rec = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    if (!rec) return null

    const type = typeof rec['@type'] === 'string' ? String(rec['@type'] || '').trim() : ''

    const version =
      typeof rec.version === 'number'
        ? rec.version
        : typeof rec['kg:version'] === 'number'
          ? (rec['kg:version'] as number)
          : NaN

    const docRaw =
      rec.document && typeof rec.document === 'object' && !Array.isArray(rec.document)
        ? (rec.document as Record<string, unknown>)
        : rec['kg:document'] && typeof rec['kg:document'] === 'object' && !Array.isArray(rec['kg:document'])
          ? (rec['kg:document'] as Record<string, unknown>)
          : null

    const docText =
      typeof docRaw?.text === 'string'
        ? String(docRaw.text || '')
        : typeof docRaw?.['kg:text'] === 'string'
          ? String(docRaw['kg:text'] || '')
          : null

    if (docText == null) return null

    const docPath =
      typeof docRaw?.path === 'string'
        ? String(docRaw.path || '').trim()
        : typeof docRaw?.['kg:path'] === 'string'
          ? String(docRaw['kg:path'] || '').trim()
          : ''

    if (type === 'kg:WorkspaceFile' && version === 1) return { path: docPath, text: docText }
    return null
  } catch {
    return null
  }
}

export async function importTextFileOrWorkspaceJsonLd(args: {
  file: File
  onText: (args: { name: string; text: string }) => Promise<string>
}): Promise<string> {
  const nameRaw = String(args.file.name || '').trim() || 'file'
  const lower = nameRaw.toLowerCase()
  const rawText = await args.file.text()
  const looksLikeWorkspaceFile = lower.endsWith('.jsonld') || lower.endsWith('.json-ld')
  if (looksLikeWorkspaceFile) {
    const parsed = parseWorkspaceFileDocument(rawText)
    if (parsed) {
      const safeName = buildWorkspaceFileLeafName({ documentPath: parsed.path, fallbackName: nameRaw })
      return await args.onText({ name: safeName, text: parsed.text })
    }
  }
  return await args.onText({ name: nameRaw, text: rawText })
}


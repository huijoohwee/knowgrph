export type WorkspaceFileDocument = { path: string; text: string }

export function isWorkspaceJsonLdName(nameRaw: string): boolean {
  const lower = String(nameRaw || '').trim().toLowerCase()
  return lower.endsWith('.jsonld') || lower.endsWith('.json-ld')
}

function resolveLeafName(pathRaw: string, fallbackNameRaw: string): string {
  const leaf = (pathRaw || fallbackNameRaw || 'document.workspace.jsonld')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop() || 'document.workspace.jsonld'
  const safeName = leaf.length > 200 ? leaf.slice(0, 200) : leaf
  return safeName || 'document.workspace.jsonld'
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

export function parseWorkspaceFileJsonLdDocument(rawText: string): WorkspaceFileDocument | null {
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
  const rawText = await args.file.text()
  return await args.onText({ name: nameRaw, text: rawText })
}

export function resolveWorkspaceFileJsonLdExport(args: {
  activeDocumentPath: string
  exportBaseName: string
  text: string
}): { name: string; text: string } {
  const activeDocumentPath = String(args.activeDocumentPath || '').trim()
  const exportBaseName = String(args.exportBaseName || '').trim() || 'document'
  const text = String(args.text || '')
  const parsed = parseWorkspaceFileJsonLdDocument(text)
  if (isWorkspaceJsonLdName(activeDocumentPath) && parsed) {
    return {
      name: resolveLeafName(activeDocumentPath, `${exportBaseName}.workspace.jsonld`),
      text: text.endsWith('\n') ? text : `${text}\n`,
    }
  }
  const payload = buildWorkspaceFileJsonLdV1({
    path: activeDocumentPath || `${exportBaseName}.md`,
    text,
  })
  return {
    name: `${exportBaseName}.workspace.jsonld`,
    text: `${JSON.stringify(payload, null, 2)}\n`,
  }
}

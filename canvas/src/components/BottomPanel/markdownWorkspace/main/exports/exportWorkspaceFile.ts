import { saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'
import { buildWorkspaceFileJsonLdV1 } from '../../workspaceImport'

export async function exportWorkspaceFileJsonLd(args: {
  activeDocumentKey: string
  exportBaseName: string
  text: string
}): Promise<void> {
  try {
    const payload = buildWorkspaceFileJsonLdV1({
      path: String(args.activeDocumentKey || '').trim() || `${String(args.exportBaseName || '').trim() || 'document'}.md`,
      text: String(args.text || ''),
    })
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/ld+json;charset=utf-8' })
    const name = `${String(args.exportBaseName || '').trim() || 'document'}.workspace.jsonld`
    const saved = await saveBlobWithPicker(blob, name, {
      description: 'Workspace Files',
      accept: { 'application/ld+json': ['.workspace.jsonld', '.jsonld', '.json-ld'] },
    })
    if (saved === '') return
    if (!saved) downloadBlob(blob, name)
  } catch {
    void 0
  }
}


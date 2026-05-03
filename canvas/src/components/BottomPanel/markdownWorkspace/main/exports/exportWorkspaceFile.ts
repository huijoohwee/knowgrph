import { saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'
import { resolveWorkspaceFileJsonLdExport } from '../../workspaceImport/workspaceFileJsonLd'

export async function exportWorkspaceFileJsonLd(args: {
  activeDocumentKey: string
  exportBaseName: string
  text: string
}): Promise<void> {
  try {
    const exported = resolveWorkspaceFileJsonLdExport({
      activeDocumentPath: args.activeDocumentKey,
      exportBaseName: args.exportBaseName,
      text: args.text,
    })
    const blob = new Blob([exported.text], { type: 'application/ld+json;charset=utf-8' })
    const name = exported.name
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

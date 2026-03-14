import { saveBlobWithPicker, downloadBlob } from '@/lib/graph/save'

export async function exportMarkdownFile(args: { exportBaseName: string; text: string }): Promise<void> {
  try {
    const blob = new Blob([String(args.text || '')], { type: 'text/markdown;charset=utf-8' })
    const name = `${String(args.exportBaseName || '').trim() || 'document'}.md`
    const saved = await saveBlobWithPicker(blob, name, { description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } })
    if (saved === '') return
    if (!saved) downloadBlob(blob, name)
  } catch {
    void 0
  }
}


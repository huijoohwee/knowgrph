import { readPdfWorkspaceOutputDirRel } from './pdfWorkspacePreferences'

export function parsePdfWorkspaceFrontmatter(text: string): { docId: string; outputDirRel: string } | null {
  const raw = String(text || '')
  if (!raw.startsWith('---')) return null
  const end = raw.indexOf('\n---')
  if (end < 0) return null
  const fm = raw.slice(0, end + 4)
  const readVal = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'))
    const v = m ? String(m[1] || '').trim() : ''
    if (!v) return ''
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
    return v
  }
  const docId = readVal('kgPdfWorkspaceDocId')
  const outputDirRel = readVal('kgPdfWorkspaceOutputDirRel')
  if (!docId) return null
  return { docId, outputDirRel: outputDirRel || readPdfWorkspaceOutputDirRel() }
}

export const parseWebkitRelativePath = (
  webkitRelativePath: string,
  fallbackFileName: string,
): { folderName: string | null; rawRelativePath: string } => {
  const rel = String(webkitRelativePath || '')
    .trim()
    .replace(/\\/g, '/')
  const parts = rel.split('/').filter(Boolean)
  const hasFolder = parts.length >= 2
  const folderName = hasFolder ? String(parts[0] || '').trim() || null : null
  const rawRelativePath = hasFolder
    ? parts.slice(1).join('/')
    : (String(parts[0] || '').trim() || String(fallbackFileName || '').trim())
  return { folderName, rawRelativePath }
}

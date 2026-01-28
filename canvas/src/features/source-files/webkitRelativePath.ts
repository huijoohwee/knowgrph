export const parseWebkitRelativePath = (
  webkitRelativePath: string,
  fallbackFileName: string,
): { folderName: string | null; rawRelativePath: string } => {
  const rel = String(webkitRelativePath || '')
    .trim()
    .replace(/\\/g, '/')
  const parts = rel.split('/').filter(Boolean)
  const folderName = parts.length > 0 ? String(parts[0] || '').trim() || null : null
  const rawRelativePath = parts.length > 1 ? parts.slice(1).join('/') : String(fallbackFileName || '').trim()
  return { folderName, rawRelativePath }
}

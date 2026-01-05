export function coerceHttpUrl(value: string): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return null
  return raw
}

export function isMarkdownUrlPath(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const path = url.pathname.toLowerCase()
    return path.endsWith('.md') || path.endsWith('.markdown')
  } catch {
    return false
  }
}

function normalizeGitHubBlobMarkdownUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    if (url.hostname !== 'github.com') return rawUrl
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 5) return rawUrl
    const [owner, repo, blobOrRaw, ref, ...pathParts] = parts
    if (!owner || !repo || !ref || pathParts.length === 0) return rawUrl
    if (blobOrRaw !== 'blob') return rawUrl
    const rawPath = [owner, repo, ref, ...pathParts].join('/')
    const out = new URL(`https://raw.githubusercontent.com/${rawPath}`)
    out.hash = ''
    out.search = ''
    return out.toString()
  } catch {
    return rawUrl
  }
}

function deriveMarkdownNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    const base = last || 'document.md'
    if (/\.md$/i.test(base) || /\.markdown$/i.test(base)) return base
    return `${base}.md`
  } catch {
    return 'document.md'
  }
}

export async function fetchRemoteMarkdownText(
  rawUrl: string,
): Promise<{ name: string; text: string; displayName: string } | null> {
  const normalized = normalizeGitHubBlobMarkdownUrl(rawUrl)
  const url = coerceHttpUrl(normalized)
  if (!url) return null
  if (!isMarkdownUrlPath(url)) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()
    return { name: url, displayName: deriveMarkdownNameFromUrl(url), text }
  } catch {
    return null
  }
}


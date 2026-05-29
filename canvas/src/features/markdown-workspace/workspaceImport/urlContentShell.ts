const HYDRATION_SHELL_ROOT_HTML_REGEX =
  /<body\b[^>]*>\s*<(?:div|main|section)\b[^>]*\bid\s*=\s*("|')(?:root|__next|app|mount|__nuxt)\1[^>]*>\s*<\/(?:div|main|section)>\s*<\/body>/i
const HYDRATION_SHELL_ROOT_ELEMENT_REGEX =
  /<(?:div|main|section)\b[^>]*\bid\s*=\s*("|')(?:root|__next|app|mount|__nuxt)\1[^>]*>\s*<\/(?:div|main|section)>/i

export const extractWorkspaceWebpageHtmlTitle = (html: string): string => {
  const match = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)
  return match?.[1] ? String(match[1]).replace(/\s+/g, ' ').trim() : ''
}

export const extractHtmlTextForShellProbe = (html: string): string => {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const looksLikeHydrationShellHtml = (html: string): boolean => {
  const raw = String(html || '').trim()
  if (!raw) return true
  if (HYDRATION_SHELL_ROOT_HTML_REGEX.test(raw)) return true
  const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)
  const body = String(bodyMatch?.[1] || '')
  if (!body || !HYDRATION_SHELL_ROOT_ELEMENT_REGEX.test(body)) return false
  return extractHtmlTextForShellProbe(body).length === 0
}

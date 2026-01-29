export const slugify = (text: string): string => {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return normalized || 'x'
}

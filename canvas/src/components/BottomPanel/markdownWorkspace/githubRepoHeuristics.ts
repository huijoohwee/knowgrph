export const detectRepoKeyFiles = (allTreePaths: string[], readmeMarkdown: string, maxFiles: number) => {
  const max = typeof maxFiles === 'number' && Number.isFinite(maxFiles) && maxFiles > 0 ? Math.floor(maxFiles) : 6
  const rootFiles = allTreePaths.filter(p => p && !p.includes('/') && !p.endsWith('/'))
  const readmeLower = String(readmeMarkdown || '').toLowerCase()
  const scoreFor = (file: string): number => {
    const lower = String(file || '').toLowerCase()
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
    let score = 0
    if (ext === 'py') score += 3
    if (ext === 'ts' || ext === 'tsx') score += 2
    if (ext === 'js' || ext === 'jsx') score += 1
    if (lower.includes('main')) score += 9
    if (lower.includes('server')) score += 8
    if (lower.includes('app')) score += 6
    if (lower.includes('execution')) score += 6
    if (lower.includes('node')) score += 5
    if (lower.includes('cli') || lower.includes('command')) score += 3
    if (lower.includes('api')) score += 3
    if (lower.startsWith('index.')) score += 2
    if (readmeLower.includes('entry point') && lower.includes('main')) score += 3
    if (readmeLower.includes('api') && lower.includes('server')) score += 2
    return score
  }
  const titleFor = (file: string): string => {
    const lower = String(file || '').toLowerCase()
    if (lower.includes('main')) return 'Main Entry Point'
    if (lower.includes('server')) return 'Server Module'
    if (lower.includes('execution')) return 'Execution Engine'
    if (lower.includes('node')) return 'Node System'
    if (lower.includes('api')) return 'API Layer'
    if (lower.includes('cli')) return 'CLI'
    return 'Key File'
  }
  const scored = rootFiles.map(file => ({ file, score: scoreFor(file), title: titleFor(file) })).filter(x => x.score > 0)
  scored.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
  const picked: Array<{ file: string; title: string }> = []
  for (const s of scored) {
    if (picked.some(p => p.file === s.file)) continue
    picked.push({ file: s.file, title: s.title })
    if (picked.length >= max) break
  }
  return picked
}

export const extractGitHubRoutesFromServerText = (python: string, maxItems: number) => {
  const text = String(python || '')
  const candidates = new Set<string>()
  for (const m of text.matchAll(/['"]\/(?:[A-Za-z0-9_\-./{}]+)?['"]/g)) {
    const raw = String(m[0] || '')
    const path = raw.replace(/^['"]|['"]$/g, '')
    if (!path || path === '/') continue
    if (path.length > 64) continue
    candidates.add(path)
    if (candidates.size >= maxItems * 3) break
  }
  return [...candidates]
    .filter(p => !/\.(?:css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/i.test(p))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, Math.max(0, maxItems))
}


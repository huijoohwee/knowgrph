export const extractReadmeSectionBlock = (markdown: string, heading: string, maxChars: number) => {
  const text = String(markdown || '')
  const lines = text.split(/\r?\n/)
  const needle = String(heading || '').trim().toLowerCase()
  if (!needle) return ''
  let startIdx = -1
  let startLevel = 0
  for (let index = 0; index < lines.length; index += 1) {
    const m = lines[index].match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const title = String(m[2] || '').trim().toLowerCase()
    if (title === needle) {
      startIdx = index
      startLevel = (m[1] || '').length
      break
    }
  }
  if (startIdx < 0) return ''
  const out: string[] = []
  for (let index = startIdx + 1; index < lines.length; index += 1) {
    const m = lines[index].match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
    if (m) {
      const level = (m[1] || '').length
      if (level <= startLevel) break
    }
    out.push(lines[index])
    if (out.join('\n').length >= maxChars) break
  }
  const joined = out.join('\n').trim()
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined
}

export const extractReadmeSectionBlockAny = (markdown: string, headings: string[], maxChars: number) => {
  for (const h of headings) {
    const block = extractReadmeSectionBlock(markdown, h, maxChars)
    if (block) return block
  }
  return ''
}

export const extractShortcutKeybinds = (readme: string, maxItems: number) => {
  const block = extractReadmeSectionBlockAny(readme, ['Shortcuts', 'Keyboard Shortcuts', 'Keybinds', 'Hotkeys', 'Short Cuts'], 20_000)
  if (!block) return []
  const lines = block.split(/\r?\n/)
  const items: Array<{ key: string; desc: string }> = []
  const push = (keyRaw: string, descRaw: string) => {
    const key = String(keyRaw || '').trim()
    const desc = String(descRaw || '').trim()
    if (!key) return
    if (/keybind/i.test(key) && /explanation/i.test(desc)) return
    items.push({ key, desc: desc || '(not provided)' })
  }
  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index]
    const li = row.match(/^\s{0,3}[-*+]\s+(.+?)\s*$/)
    if (li) {
      const key = String(li[1] || '').trim()
      if (key) push(key, '(not provided)')
      if (items.length >= maxItems) break
      continue
    }
    if (row.includes('|')) {
      if (/^\s*\|\s*-+/.test(row)) continue
      const cells = row
        .split('|')
        .map(c => c.trim())
        .filter(Boolean)
      if (cells.length < 2) continue
      push(cells[0], cells[1])
      if (items.length >= maxItems) break
    }
  }
  const dedup: Array<{ key: string; desc: string }> = []
  for (const it of items) {
    if (dedup.some(x => x.key.toLowerCase() === it.key.toLowerCase())) continue
    dedup.push(it)
  }
  return dedup
}

export const extractRepoReadmeFeatureGroups = (markdown: string) => {
  const clean = String(markdown || '')
  const lines = clean.split(/\r?\n/)
  const groups: Array<{ title: string; items: string[] }> = []
  let curTitle = ''
  let curItems: string[] = []
  const flush = () => {
    const title = curTitle.trim()
    const items = curItems.map(s => s.trim()).filter(Boolean)
    if (title && items.length >= 4) groups.push({ title, items })
    curTitle = ''
    curItems = []
  }
  for (const raw of lines) {
    const h = raw.match(/^\s{0,3}#{2,4}\s+(.+?)\s*$/)
    if (h) {
      flush()
      curTitle = String(h[1] || '').replace(/\s*\(.*?\)\s*$/, '').trim()
      continue
    }
    const li = raw.match(/^\s{0,3}[-*+]\s+(.+?)\s*$/)
    if (li && curTitle) {
      const item = String(li[1] || '').replace(/\s+\[[^\]]*\]\([^\)]*\)\s*$/, '').trim()
      if (item) curItems.push(item)
      continue
    }
    if (curTitle && !raw.trim()) continue
  }
  flush()
  return groups
}

export const buildTemplateGridFromGroups = (groups: Array<{ title: string; items: string[] }>) => {
  const picked: string[] = []
  for (const g of groups) {
    if (picked.length >= 12) break
    for (const it of g.items) {
      const name = String(it || '').replace(/\s*\(.*?\)\s*$/, '').trim()
      if (!name) continue
      if (picked.some(x => x.toLowerCase() === name.toLowerCase())) continue
      picked.push(name)
      if (picked.length >= 12) break
    }
  }
  return picked
}

export const detectSupportedPlatformsFromReadme = (markdown: string) => {
  const t = String(markdown || '')
  const out: string[] = []
  const add = (name: string) => {
    if (!out.some(x => x.toLowerCase() === name.toLowerCase())) out.push(name)
  }
  if (/\bWindows\b/i.test(t)) add('Windows')
  if (/\bmacOS\b/i.test(t)) add('macOS')
  if (/\bLinux\b/i.test(t)) add('Linux')
  return out
}

export const extractGpuTypesFromReadme = (markdown: string) => {
  const t = String(markdown || '')
  const known = ['NVIDIA', 'AMD', 'Intel', 'Intel Arc', 'Apple Silicon', 'Ascend', 'Cambricon', 'Iluvatar', 'CUDA', 'ROCm', 'MPS', 'DirectML']
  const found: string[] = []
  for (const token of known) {
    const re = new RegExp(`\\b${token.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, 'i')
    if (re.test(t)) {
      if (!found.some(x => x.toLowerCase() === token.toLowerCase())) found.push(token)
    }
  }
  return found
}

export const detectApiSupportLabel = (readmeMarkdown: string, allTreePaths: string[]) => {
  const t = String(readmeMarkdown || '').toLowerCase()
  const parts: string[] = []
  const add = (s: string) => {
    if (!parts.some(x => x.toLowerCase() === s.toLowerCase())) parts.push(s)
  }
  if (t.includes('websocket') || allTreePaths.some(p => String(p).toLowerCase().includes('/ws'))) add('WebSocket')
  if (t.includes('rest') || t.includes('restful')) add('REST')
  if (t.includes('api') || allTreePaths.some(p => String(p).toLowerCase().includes('api'))) add('API')
  return parts.length ? parts.join(' + ') : 'Unknown'
}

export const parseRequirements = (text: string, maxItems: number) => {
  const lines = String(text || '').split(/\r?\n/)
  const out: Array<{ pkg: string; spec: string }> = []
  for (const raw of lines) {
    const line = String(raw || '').trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('-r ') || line.startsWith('--')) continue
    const m = line.match(/^([A-Za-z0-9_.-]+)\s*([^;#]*)/)
    if (!m) continue
    const pkg = String(m[1] || '').trim()
    const spec = String(m[2] || '').trim()
    if (!pkg) continue
    out.push({ pkg, spec: spec || '(unspecified)' })
    if (out.length >= maxItems) break
  }
  return out
}

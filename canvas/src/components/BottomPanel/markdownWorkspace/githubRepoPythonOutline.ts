const extractDocstringSummaryAt = (lines: string[], startIndex: number): string => {
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 18); i += 1) {
    const line = String(lines[i] || '').trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    const m1 = line.match(/^"""\s*(.*?)\s*"""\s*$/)
    if (m1) return String(m1[1] || '').trim()
    const m2 = line.match(/^'''\s*(.*?)\s*'''\s*$/)
    if (m2) return String(m2[1] || '').trim()
    if (line.startsWith('"""') || line.startsWith("'''") ) {
      const quote = line.startsWith('"""') ? '"""' : "'''"
      const rest = line.slice(3).trim()
      if (rest && !rest.endsWith(quote)) return rest
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
        const inner = String(lines[j] || '').trim()
        if (!inner) continue
        if (inner.includes(quote)) {
          const before = inner.split(quote)[0].trim()
          return before
        }
        return inner
      }
    }
    return ''
  }
  return ''
}

export const extractPythonStructuredOutline = (python: string, limits: { maxTopLevelDefs: number; maxClasses: number; maxMethodsPerClass: number; maxImports: number }) => {
  const lines = String(python || '').split(/\r?\n/)
  const topLevelDefs: Array<{ name: string; args: string; doc: string }> = []
  const classes: Array<{ name: string; methods: Array<{ name: string; args: string; doc: string }> }> = []
  const imports: string[] = []

  let currentClass: { name: string; methods: Array<{ name: string; args: string; doc: string }> } | null = null
  let currentClassIndent = 0

  const pushClass = () => {
    if (!currentClass) return
    if (classes.length >= limits.maxClasses) {
      currentClass = null
      currentClassIndent = 0
      return
    }
    classes.push(currentClass)
    currentClass = null
    currentClassIndent = 0
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = String(lines[lineIndex] || '')
    const imp = line.match(/^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+|import\s+([a-zA-Z0-9_.]+))/)
    if (imp) {
      const mod = String(imp[1] || imp[2] || '').trim()
      if (mod && !imports.includes(mod)) imports.push(mod)
      continue
    }

    const classMatch = line.match(/^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)\b/)
    if (classMatch) {
      pushClass()
      if (classes.length >= limits.maxClasses) continue
      currentClassIndent = (classMatch[1] || '').length
      currentClass = { name: String(classMatch[2] || '').trim(), methods: [] }
      continue
    }

    const defMatch = line.match(/^(\s*)def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/)
    if (defMatch) {
      const indent = (defMatch[1] || '').length
      const name = String(defMatch[2] || '').trim()
      const args = String(defMatch[3] || '').trim()
      const doc = extractDocstringSummaryAt(lines, lineIndex + 1) || ''
      if (!name) continue

      if (currentClass && indent > currentClassIndent) {
        if (currentClass.methods.length < limits.maxMethodsPerClass) {
          if (!currentClass.methods.some(m => m.name === name)) currentClass.methods.push({ name, args, doc })
        }
        continue
      }

      if (currentClass && indent <= currentClassIndent) pushClass()
      if (topLevelDefs.length < limits.maxTopLevelDefs) {
        if (!topLevelDefs.some(d => d.name === name)) topLevelDefs.push({ name, args, doc })
      }
      continue
    }

    if (currentClass) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^#/.test(trimmed)) continue
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
      if (indent <= currentClassIndent) pushClass()
    }
  }
  pushClass()
  return { topLevelDefs, classes, imports: imports.slice(0, Math.max(0, limits.maxImports)) }
}

export const inferDecisionLogicNote = (name: string) => {
  const n = String(name || '').toLowerCase()
  if (!n) return '—'
  if (n.startsWith('load') || n.includes('load_')) return 'Loads resources'
  if (n.startsWith('setup') || n.includes('setup_')) return 'Initializes configuration/state'
  if (n.startsWith('init') || n.includes('init_')) return 'Initializes components'
  if (n.startsWith('start') || n.includes('start_')) return 'Starts a service/process'
  if (n.startsWith('execute') || n.includes('execute')) return 'Executes a workflow step'
  if (n.startsWith('validate') || n.includes('validate')) return 'Validates inputs/configuration'
  if (n.startsWith('get') || n.includes('get_')) return 'Reads state or data'
  if (n.startsWith('set') || n.includes('set_') || n.includes('update')) return 'Updates state'
  if (n.includes('route') || n.includes('handler') || n.includes('http') || n.includes('ws')) return 'Handles requests'
  return '—'
}

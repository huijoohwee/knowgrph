export type MermaidSplitOptions = {
  maxDiagrams?: number
}

const DIAGRAM_START_RE =
  /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|xychart-beta|requirementDiagram|gitGraph)\b/

const INIT_DIRECTIVE_RE = /^\s*%%\{[\s\S]*\}%%\s*$/

export function splitMermaidIntoDiagrams(raw: string, options: MermaidSplitOptions = {}): string[] {
  const maxDiagrams = Number.isFinite(options.maxDiagrams) ? Math.max(1, options.maxDiagrams as number) : Infinity

  const text = String(raw || '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  let i = 0
  const preamble: string[] = []
  while (i < lines.length) {
    const line = lines[i]
    if (INIT_DIRECTIVE_RE.test(line)) {
      preamble.push(line)
      i += 1
      continue
    }
    if (!preamble.length && !String(line || '').trim()) {
      i += 1
      continue
    }
    break
  }

  while (i < lines.length && !String(lines[i] || '').trim()) i += 1

  const diagrams: string[] = []
  let current: string[] = []
  let hasStart = false

  const flush = () => {
    const body = current.join('\n').trim()
    if (!body) {
      current = []
      hasStart = false
      return
    }
    const merged = [...preamble, body].filter(Boolean).join('\n\n').trim()
    diagrams.push(merged)
    current = []
    hasStart = false
  }

  for (; i < lines.length; i += 1) {
    const line = lines[i]
    if (DIAGRAM_START_RE.test(line)) {
      if (hasStart && current.some(l => String(l || '').trim())) {
        flush()
        if (diagrams.length >= maxDiagrams) return diagrams
      }
      hasStart = true
      current.push(line)
      continue
    }
    current.push(line)
  }

  flush()

  if (!diagrams.length) return [text.trim()].filter(Boolean)
  return diagrams
}


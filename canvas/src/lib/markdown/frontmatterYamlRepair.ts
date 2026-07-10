export const countYamlIndent = (rawLine: string): number => {
  let i = 0
  while (i < rawLine.length && rawLine[i] === ' ') i += 1
  return i
}

const isYamlBoundaryLine = (rawLine: string): boolean => {
  const trimmed = String(rawLine || '').trim()
  if (!trimmed) return false
  return (
    /^-\s+[A-Za-z0-9_.-]+\s*:/.test(trimmed)
    || /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)
    || /^"[^"]+"\s*:/.test(trimmed)
    || /^'[^']+'\s*:/.test(trimmed)
  )
}

const repairYamlBlockScalarIndentation = (raw: string): string => {
  const src = String(raw || '')
  if (!src) return src
  const lines = src.split('\n')
  const out: string[] = []
  let activeScalarIndent = -1
  let requiredScalarIndent = -1
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    const trimmed = line.trim()
    const indent = countYamlIndent(line)

    if (activeScalarIndent >= 0) {
      if (!trimmed) {
        out.push(line)
        continue
      }
      if (indent <= activeScalarIndent && (/^---\s*$/.test(trimmed) || /^\.\.\.\s*$/.test(trimmed))) {
        activeScalarIndent = -1
        requiredScalarIndent = -1
      } else if (indent <= activeScalarIndent && isYamlBoundaryLine(line)) {
        activeScalarIndent = -1
        requiredScalarIndent = -1
      } else if (indent <= activeScalarIndent) {
        out.push(`${' '.repeat(requiredScalarIndent)}${trimmed}`)
        continue
      }
    }

    out.push(line)
    if (/^(\s*)(?:[A-Za-z0-9_.-]+|"[^"]+"|'[^']+')\s*:\s*[|>]\s*$/.test(line)) {
      activeScalarIndent = indent
      requiredScalarIndent = indent + 2
    }
  }
  return out.join('\n')
}

export const repairYamlInlineColonSpacing = (raw: string): string => {
  const src = String(raw || '')
  if (!src) return src
  const out: string[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || ''
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line)
      continue
    }
    const match = /^(\s*[-]?\s*[A-Za-z0-9_.-]+):([^\s].*)$/.exec(line)
    if (match) {
      out.push(`${match[1]}: ${match[2]}`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

export const repairFlowInlineEnvelopeBlockScalars = (raw: string): string => {
  const src = String(raw || '')
  if (!src) return src
  const lines = src.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    const match = /^(\s*)([A-Za-z0-9_.-]+)\s*:\s*\{\s*key:\s*([^,]+?),\s*type:\s*([^,]+?),\s*value:\s*\|\s*$/.exec(line)
    if (!match) {
      out.push(line)
      continue
    }
    const indent = match[1] || ''
    const indentLen = indent.length
    const fieldKey = String(match[2] || '').trim()
    const keyPart = String(match[3] || '').trim()
    const typePart = String(match[4] || '').trim()
    if (!fieldKey || !keyPart || !typePart) {
      out.push(line)
      continue
    }
    out.push(`${indent}${fieldKey}:`)
    out.push(`${indent}  key: ${keyPart}`)
    out.push(`${indent}  type: ${typePart}`)
    out.push(`${indent}  value: |`)
    let consumedClosingBrace = false
    for (let j = i + 1; j < lines.length; j += 1) {
      const bodyLine = String(lines[j] || '')
      const trimmedBody = bodyLine.trim()
      if (/^\s*\}\s*$/.test(bodyLine) && countYamlIndent(bodyLine) <= indentLen) {
        consumedClosingBrace = true
        i = j
        break
      }

      const bodyIndent = countYamlIndent(bodyLine)
      if (trimmedBody && bodyIndent <= indentLen && isYamlBoundaryLine(bodyLine)) {
        consumedClosingBrace = true
        i = j - 1
        break
      }
      if (trimmedBody && bodyIndent <= indentLen) {
        out.push(`${' '.repeat(indentLen + 2)}${trimmedBody}`)
        continue
      }

      if (bodyIndent > indentLen && /\}\s*$/.test(bodyLine) && !/^\s*\}\s*$/.test(bodyLine)) {
        let k = j + 1
        while (k < lines.length) {
          const nextRaw = String(lines[k] || '')
          const nextTrimmed = nextRaw.trim()
          if (!nextTrimmed) {
            k += 1
            continue
          }
          if (countYamlIndent(nextRaw) <= indentLen) {
            const stripped = bodyLine.replace(/\}\s*$/, '')
            out.push(stripped ? `  ${stripped}` : stripped)
            consumedClosingBrace = true
            i = j
            break
          }
          break
        }
        if (consumedClosingBrace) break
      }
      out.push(bodyLine ? `  ${bodyLine}` : bodyLine)
    }
    if (!consumedClosingBrace) {
      out.pop()
      out.pop()
      out.pop()
      out.pop()
      out.push(line)
    }
  }
  return repairYamlBlockScalarIndentation(out.join('\n'))
}

export const findLeadingUnfencedYamlMetadataEnd = (lines: readonly string[]): number => {
  let sawTopLevelKey = false
  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || '')
    const trimmed = raw.trim()
    if (!trimmed) continue
    const indent = countYamlIndent(raw)
    if (indent === 0 && /^#{1,6}\s+/.test(trimmed)) return sawTopLevelKey ? i : -1
    if (indent === 0 && /^(```|~~~)/.test(trimmed)) return sawTopLevelKey ? i : -1
    if (indent === 0 && /^<[A-Za-z!/]/.test(trimmed)) return sawTopLevelKey ? i : -1
    if (indent === 0 && /^[A-Za-z0-9_.:$-]+\s*:/.test(trimmed)) sawTopLevelKey = true
  }
  return sawTopLevelKey ? lines.length : -1
}

export const repairWrappedQuotedFrontmatterKeys = (raw: string): string => {
  return String(raw || '').replace(
    /(^|\n)(\s*)"([A-Za-z0-9_.:-]+(?:\s*\n\s*[A-Za-z0-9_.:-]+)+)"(?=\s*:)/g,
    (_match, lineStart: string, indent: string, joinedSegments: string) =>
      `${lineStart}${indent}"${joinedSegments.replace(/\s+/g, '')}"`,
  )
}

export const repairFrontmatterYamlSyntax = (raw: string): string => {
  return repairFlowInlineEnvelopeBlockScalars(repairYamlInlineColonSpacing(raw))
}

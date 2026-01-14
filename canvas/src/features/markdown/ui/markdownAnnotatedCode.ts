
export type AnnotatedCodeRow = {
  id: string
  code: string
  annotation: string | null
  startLine: number
  endLine: number
}

const COMMENT_PATTERNS: Record<string, RegExp> = {
  yaml: /^\s*#\s?(.*)$/,
  yml: /^\s*#\s?(.*)$/,
  python: /^\s*#\s?(.*)$/,
  py: /^\s*#\s?(.*)$/,
  sh: /^\s*#\s?(.*)$/,
  bash: /^\s*#\s?(.*)$/,
  dockerfile: /^\s*#\s?(.*)$/,
  makefile: /^\s*#\s?(.*)$/,
  javascript: /^\s*\/\/\s?(.*)$/,
  js: /^\s*\/\/\s?(.*)$/,
  typescript: /^\s*\/\/\s?(.*)$/,
  ts: /^\s*\/\/\s?(.*)$/,
  java: /^\s*\/\/\s?(.*)$/,
  c: /^\s*\/\/\s?(.*)$/,
  cpp: /^\s*\/\/\s?(.*)$/,
  rust: /^\s*\/\/\s?(.*)$/,
  go: /^\s*\/\/\s?(.*)$/,
}

export function parseAnnotatedCode(code: string, lang: string, startLine: number = 1): AnnotatedCodeRow[] {
  const lines = code.split('\n')
  const rows: AnnotatedCodeRow[] = []
  const pattern = COMMENT_PATTERNS[lang.toLowerCase()]

  const pendingAnnotation: string[] = []
  let pendingCode: string[] = []
  let pendingCodeStartLine = startLine
  let currentLineNum = startLine

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = pattern ? line.match(pattern) : null
    
    if (match) {
      // It's a comment/annotation
      
      // If we have pending code, that code constitutes a completed row (with NO annotation, 
      // or we need to decide if previous annotation applied to it).
      // Assumption: Annotations *precede* the code they describe.
      
      if (pendingCode.length > 0) {
        rows.push({
          id: `row-${rows.length}`,
          code: pendingCode.join('\n'),
          annotation: pendingAnnotation.length > 0 ? pendingAnnotation.join('\n') : null,
          startLine: pendingCodeStartLine,
          endLine: currentLineNum - 1
        })
        pendingCode = []
        pendingAnnotation.length = 0
      }
      
      // Start accumulating new annotation
      pendingAnnotation.push(match[1].trim())
      
    } else {
      // It's code
      if (pendingCode.length === 0) {
        pendingCodeStartLine = currentLineNum
      }
      pendingCode.push(line)
    }
    currentLineNum++
  }
  
  // Flush remaining
  if (pendingCode.length > 0 || pendingAnnotation.length > 0) {
     rows.push({
        id: `row-${rows.length}`,
        code: pendingCode.join('\n'),
        annotation: pendingAnnotation.length > 0 ? pendingAnnotation.join('\n') : null,
        startLine: pendingCodeStartLine,
        endLine: currentLineNum - 1
      })
  }

  return rows
}

export const mermaidDensityConfig = {
  sparseMaxStatements: 30,
  denseMaxStatements: 100,
  anchorsOnly: { sparse: 1.5, medium: 1.8, dense: 2.1 },
  defaultDiagram: { sparse: 1.3, medium: 1.6, dense: 1.9 },
}

export const computeMermaidTidyTreeSeparation = (
  code: string,
  anchorsOnly: boolean,
): { separation: number; statementCount: number; density: 'none' | 'sparse' | 'medium' | 'dense' } => {
  const lines = String(code || '')
    .split('\n')
    .map(l => l.trim())
  let statementCount = 0
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || ''
    if (!line) continue
    if (line.startsWith('%%')) continue
    if (line.startsWith('graph ')) continue
    if (line.startsWith('subgraph ')) continue
    if (line === 'end') continue
    statementCount += 1
  }
  if (statementCount <= 0) {
    const base = anchorsOnly
      ? mermaidDensityConfig.anchorsOnly.sparse
      : mermaidDensityConfig.defaultDiagram.sparse
    return { separation: base, statementCount, density: 'none' }
  }
  const cfgBucket = anchorsOnly
    ? mermaidDensityConfig.anchorsOnly
    : mermaidDensityConfig.defaultDiagram
  let density: 'sparse' | 'medium' | 'dense'
  if (statementCount <= mermaidDensityConfig.sparseMaxStatements) {
    density = 'sparse'
  } else if (statementCount <= mermaidDensityConfig.denseMaxStatements) {
    density = 'medium'
  } else {
    density = 'dense'
  }
  const sep =
    density === 'sparse'
      ? cfgBucket.sparse
      : density === 'medium'
      ? cfgBucket.medium
      : cfgBucket.dense
  const separation = Number.isFinite(sep) && sep > 0 ? sep : cfgBucket.sparse
  return { separation, statementCount, density }
}

import { normalizeMermaidCodeForRuntime } from 'grph-shared/markdown/mermaidInput'

export const testMermaidNormalizerTightensLabeledEdgesSpacing = () => {
  const src = [
    'flowchart LR',
    '  n-canvas  -->|signal|               n-pack',
    '  n-pack    -->|context|              n-ai',
  ].join('\n')
  const out = normalizeMermaidCodeForRuntime(src)
  if (!out.includes('n-canvas-->|signal|n-pack')) {
    throw new Error('expected labeled edge spacing to be tightened')
  }
  if (!out.includes('n-pack-->|context|n-ai')) {
    throw new Error('expected labeled edge spacing to be tightened')
  }
}

export const testMermaidNormalizerCanonicalizesLegacyClickSpacing = () => {
  const src = [
    'flowchart LR',
    '  click n-pack     "#n-pack--packcontext"               "Context packager"',
  ].join('\n')
  const out = normalizeMermaidCodeForRuntime(src)
  if (!out.includes('click n-pack href "#n-pack--packcontext" "Context packager"')) {
    throw new Error('expected legacy click syntax to be canonicalized with href and compact spacing')
  }
}

import { renderMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'

export const testMermaidFidelityRendererIsRuntimeSafeInNode = async () => {
  const res = await renderMermaidSvgCached({ code: 'graph TD\n  A-->B', theme: 'light' })
  if (!res || typeof res.svg !== 'string') throw new Error('expected svg string result')
}


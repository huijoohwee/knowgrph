import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { readSandboxDemoText, toDocumentPath } from '@/tests/lib/sandboxRoot'

export const testMddemoEdgesVisibleInDisplayGraph = () => {
  const demo = readSandboxDemoText({ preferBasename: 'mddemo.md' })
  if (!demo) return

  const name = toDocumentPath(demo.path) || 'mddemo.md'
  const jsonld = buildMarkdownJsonLd(name, demo.text)
  const graphData = parseJsonLd(jsonld)

  const edgeCount = Array.isArray(graphData.edges) ? graphData.edges.length : 0
  if (edgeCount === 0) return

  const d = deriveSceneDisplayGraph({ graphData })
  if (!d) throw new Error('expected derivation to return non-null')
  if (d.displayEdges.length === 0) {
    throw new Error(`expected visible edges for mddemo.md, got 0 (raw edges=${edgeCount})`)
  }
}


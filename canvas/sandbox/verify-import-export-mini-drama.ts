import fs from 'node:fs/promises'
import path from 'node:path'

import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { toJsonLd } from '@/lib/graph/jsonld/serialize'
import { parseJsonLd } from '@/lib/graph/jsonld/parse'
import { readGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { buildFlowRunAllNodeSequence } from '@/lib/flowEditor/runAllSequenceSsot'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

function readArg(name: string): string {
  const ix = process.argv.indexOf(name)
  const v = ix >= 0 ? process.argv[ix + 1] : ''
  return String(v || '').trim()
}

function must(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

function normalizeId(raw: unknown): string {
  return String(raw || '').trim()
}

async function main(): Promise<void> {
  const inputArg = readArg('--input')
  const inputPath = inputArg
    ? path.resolve(process.cwd(), inputArg)
    : path.resolve(process.cwd(), '../../sandbox/test-data/knowgrph-rich-media-generation-demo.md')
  const text = await fs.readFile(inputPath, 'utf8')
  const name = path.basename(inputPath)

  const loaded = await loadGraphDataFromTextViaParser(name, text, { applyToStore: false, syncMarkdownDocument: false })
  must(loaded && loaded.graphData, 'Failed to parse markdown into graph data')
  const graphData = loaded.graphData as any

  const nodeIds = new Set((graphData.nodes || []).map((n: any) => normalizeId(n?.id)).filter(Boolean))
  const edgeIds = new Set((graphData.edges || []).map((e: any) => normalizeId(e?.id)).filter(Boolean))
  must(nodeIds.has('w-text-script'), 'Missing node w-text-script')
  must(nodeIds.has('w-video-scene'), 'Missing node w-video-scene')
  must(nodeIds.has('p-video-scene'), 'Missing node p-video-scene')
  must(edgeIds.has('e-scene01-to-video-ref'), 'Missing edge e-scene01-to-video-ref')
  must(readGlobalEdgeType((graphData as any).schema || null) === 'bezier', 'Expected global edge type to be bezier')

  const nodes = Array.isArray((graphData as any).nodes) ? ((graphData as any).nodes as any[]) : []
  const runEligible = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i] as { id?: unknown; type?: unknown }
    const nodeId = normalizeId(node?.id)
    const nodeType = normalizeId(node?.type)
    if (!nodeId) continue
    if (
      nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
      || nodeType === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
      || nodeType === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    ) {
      runEligible.add(nodeId)
    }
  }
  const runOrder = buildFlowRunAllNodeSequence({ graphData: graphData as any, eligibleNodeIds: runEligible })
  must(runOrder.phaseCounts.text >= 1, 'Expected at least one TextGeneration node in run sequence')
  must(runOrder.phaseCounts.imageFoundation >= 1, 'Expected at least one foundation image node in run sequence')
  must(runOrder.phaseCounts.imageScene >= 1, 'Expected at least one scene image node in run sequence')
  must(runOrder.phaseCounts.video >= 1, 'Expected at least one video node in run sequence')

  const jsonRoundtrip = JSON.parse(JSON.stringify(graphData)) as any
  const nodeIdsJson = new Set((jsonRoundtrip.nodes || []).map((n: any) => normalizeId(n?.id)).filter(Boolean))
  must(nodeIdsJson.size === nodeIds.size, 'Graph JSON roundtrip changed node count')
  must(nodeIdsJson.has('p-video-scene'), 'Graph JSON roundtrip lost p-video-scene')

  const jsonLdDoc = toJsonLd(graphData)
  const parsedFromJsonLd = parseJsonLd(jsonLdDoc)
  const nodeIdsJsonLd = new Set((parsedFromJsonLd.nodes || []).map(n => normalizeId(n?.id)).filter(Boolean))
  const edgeKeysJsonLd = new Set((parsedFromJsonLd.edges || []).map(e => `${normalizeId((e as any)?.source)}|${normalizeId((e as any)?.label)}|${normalizeId((e as any)?.target)}`))
  must(nodeIdsJsonLd.has('w-text-script'), 'JSON-LD roundtrip lost w-text-script')
  must(nodeIdsJsonLd.has('w-video-scene'), 'JSON-LD roundtrip lost w-video-scene')
  must(nodeIdsJsonLd.has('p-video-scene'), 'JSON-LD roundtrip lost p-video-scene')
  must(edgeKeysJsonLd.size > 0, 'JSON-LD roundtrip lost edges')

  process.stdout.write(
    [
      `OK: parsed ${name}`,
      `nodes=${nodeIds.size}, edges=${edgeIds.size}`,
      `run.sequence=text:${runOrder.phaseCounts.text},foundation:${runOrder.phaseCounts.imageFoundation},scene:${runOrder.phaseCounts.imageScene},video:${runOrder.phaseCounts.video}`,
      `jsonld.nodes=${nodeIdsJsonLd.size}, jsonld.edges=${(parsedFromJsonLd.edges || []).length}`,
    ].join('\n') + '\n',
  )
}

main()

import fs from 'node:fs'
import path from 'node:path'

import { load as parseYaml } from 'js-yaml'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { parseGenerationInvocation } from '@/features/chat/generationInvocation'
import { isVideoAgentDemoPresetInvocation } from '@/features/chat/floatingPanelChat/videoAgentDemoPresetSubmit'
import { buildLiveCanvasHeroModel } from '@/features/agentic-os/liveCanvasHeroModel'

type PlainRecord = Record<string, unknown>

const GITHUB_ROOT = path.resolve(process.cwd(), '..', '..')
const DOC_PATH = path.join(GITHUB_ROOT, 'huijoohwee', 'docs', 'knowgrph-agentic-video-canvas-demo.md')
const SCRIPT_PATH = path.join(GITHUB_ROOT, 'huijoohwee', 'docs', 'AI视频-港岛实景写实风-异城算计与女主绝境求生-终极统一执行总表.md')

const isRecord = (value: unknown): value is PlainRecord => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const unwrap = (value: unknown): unknown => (
  isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value
)

const readFrontmatter = (markdownText: string): PlainRecord => {
  if (!markdownText.startsWith('---\n')) throw new Error('expected byte-zero YAML frontmatter')
  const end = markdownText.indexOf('\n---\n', 4)
  if (end < 0) throw new Error('expected a closing YAML frontmatter fence')
  const parsed = parseYaml(markdownText.slice(4, end))
  if (!isRecord(parsed)) throw new Error('expected frontmatter object')
  return parsed
}

const readFlowNodes = (meta: PlainRecord): PlainRecord[] => {
  const flow = meta.flow
  if (!isRecord(flow) || !Array.isArray(flow.nodes)) throw new Error('expected flow.nodes')
  return flow.nodes.filter(isRecord)
}

const nodeById = (nodes: PlainRecord[], id: string): PlainRecord => {
  const node = nodes.find(candidate => unwrap(candidate.id) === id)
  if (!node) throw new Error(`missing flow node ${id}`)
  return node
}

const property = (node: PlainRecord, key: string): unknown => unwrap(node[key])

export function testAgenticVideoCanvasDemoIsExecutableAndReplayable() {
  const markdownText = fs.readFileSync(DOC_PATH, 'utf8')
  const meta = readFrontmatter(markdownText)
  if (!fs.existsSync(SCRIPT_PATH)) throw new Error('expected the bound video-generation demo script')
  if (meta.schema !== 'kgc-agentic-video-canvas/v1') throw new Error(`unexpected schema ${String(meta.schema)}`)
  if (meta.runtime_status !== 'runtime-ready-in-dev' || meta.publish_scope !== 'local-only' || meta.live_provider_run_proven !== false) {
    throw new Error('expected honest Dev-only runtime state without a fabricated live provider proof')
  }

  const inputs = meta.inputs
  if (!isRecord(inputs)) throw new Error('expected inputs contract')
  if (inputs.video_generation_demo_script !== `workspace:/docs/${path.basename(SCRIPT_PATH)}`) {
    throw new Error('expected the authored source binding to preserve the canonical workspace docs path')
  }
  const invocation = parseGenerationInvocation(inputs.default_invocation)
  if (!invocation) throw new Error('expected default /video-agent invocation to resolve')
  if (!isVideoAgentDemoPresetInvocation(String(inputs.default_invocation || ''))) throw new Error('expected the real default invocation to bypass generic provider chat')
  const heroDefaultQuery = buildLiveCanvasHeroModel().defaultQuery
  if ((heroDefaultQuery.match(/@video-generation-demo-script/g) || []).length !== 1) {
    throw new Error('expected the Hero default query to preserve one canonical video-script binding token')
  }
  if (invocation.provider !== 'byteplus-modelark') throw new Error(`unexpected provider ${invocation.provider}`)
  if (invocation.specification !== 'low') throw new Error(`unexpected specification ${invocation.specification}`)
  if (invocation.kinds.join(',') !== 'text,image,audio,video') throw new Error(`unexpected output kinds ${invocation.kinds.join(',')}`)
  if (!invocation.prompt.includes('@video-generation-demo-script')) throw new Error('expected source binding to remain in the executable prompt')

  const parsedGraph = tryParseMarkdownFrontmatterFlowGraph('knowgrph-agentic-video-canvas-demo.md', markdownText)
  if (!parsedGraph) throw new Error('expected frontmatter flow graph parse result')
  const nodes = readFlowNodes(meta)
  const textNode = nodeById(nodes, 'video_text_generation')
  const imageNode = nodeById(nodes, 'video_image_generation')
  const videoNode = nodeById(nodes, 'video_clip_generation')
  const audioNode = nodeById(nodes, 'video_audio_generation')
  if (property(textNode, 'type') !== 'TextGeneration' || property(textNode, 'flow:widgetFormId') !== 'videoScript') {
    throw new Error('expected executable TextGeneration owner')
  }
  if (property(imageNode, 'type') !== 'ImageGeneration' || property(imageNode, 'flow:widgetFormId') !== 'imageGeneration') {
    throw new Error('expected executable ImageGeneration owner')
  }
  if (property(videoNode, 'type') !== 'VideoGeneration' || property(videoNode, 'flow:widgetFormId') !== 'videoGeneration') {
    throw new Error('expected executable VideoGeneration owner')
  }
  if (property(videoNode, 'generate_audio') !== true) throw new Error('expected provider-generated master audio track')
  if (property(audioNode, 'type') !== 'RichMediaPanel') throw new Error('expected shared audio Rich Media projection')

  const parsedTypes = new Set(parsedGraph.graphData.nodes.map(node => String(node.type || '')))
  for (const requiredType of ['TextGeneration', 'ImageGeneration', 'VideoGeneration', 'RichMediaPanel']) {
    if (!parsedTypes.has(requiredType)) throw new Error(`parsed graph missing ${requiredType}`)
  }
  const artifactContract = meta.runtime_artifact_contract
  if (!isRecord(artifactContract)) throw new Error('expected runtime_artifact_contract')
  for (const kind of invocation.kinds) {
    const record = artifactContract[kind]
    if (!isRecord(record) || record.persisted_by !== 'existing Cloudflare artifact utilities') {
      throw new Error(`expected ${kind} Cloudflare persistence contract`)
    }
  }
}

export function testAgenticVideoCanvasDemoUsesSharedCloudflarePersistenceOwners() {
  const richMediaRunPath = path.join(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts')
  const richMediaRunStoragePath = path.join(process.cwd(), 'src', 'features', 'chat', 'richMediaRunStorage.ts')
  const source = `${fs.readFileSync(richMediaRunPath, 'utf8')}\n${fs.readFileSync(richMediaRunStoragePath, 'utf8')}`
  for (const required of [
    'uploadGeneratedWorkspaceBlobToKnowgrphStorage',
    'publishGeneratedWorkspaceEntriesToKnowgrphStorage',
    'publishGeneratedTextToStorage({ outputPath',
    'outputStorageUrl: storage?.publicUrl',
  ]) {
    if (!source.includes(required)) throw new Error(`shared persistence owner missing ${required}`)
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { load as parseYaml } from 'js-yaml'

const GITHUB_ROOT = path.resolve(process.cwd(), '..', '..')
const HUIJOOHWEE_DOCS_ROOT = path.join(GITHUB_ROOT, 'huijoohwee', 'docs')
const GUIDELINES_ROOT = path.join(GITHUB_ROOT, 'huijoohwee.github.io', 'guidelines')

const YAML_GUIDELINES_PATH = path.join(GUIDELINES_ROOT, 'yaml-frontmatter-guidelines.md')
const MARKDOWN_GUIDELINES_PATH = path.join(GUIDELINES_ROOT, 'markdown-syntax-guidelines.md')
const E2E_VIDEO_DOC_PATHS = [
  path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-video-demo.md'),
  path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-ralphthon-video-demo.md'),
]
const STORYBOARD_TYPED_WRAPPER_DOC_PATH = path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-storyboard-demo.md')
const STORYBOARD_PRODUCT_UI_TYPED_WRAPPER_DOC_PATH = path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-storyboard-product-ui-demo.md')
const STORYBOARD_NEUTRAL_CONTRACT_TYPED_WRAPPER_DOC_PATH = path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-storyboard-neutral-schema-contract-demo.md')
const FLOW_EDITOR_COMPUTING_TEMPLATE_DOC_PATH = path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-flow-editor-computing-flow-template.md')
const APPROVED_STORYBOARD_TYPED_WRAPPER_DOC_PATHS = [
  STORYBOARD_TYPED_WRAPPER_DOC_PATH,
  STORYBOARD_PRODUCT_UI_TYPED_WRAPPER_DOC_PATH,
  STORYBOARD_NEUTRAL_CONTRACT_TYPED_WRAPPER_DOC_PATH,
]
const APPROVED_TYPED_WRAPPER_DOC_PATHS = [
  ...E2E_VIDEO_DOC_PATHS,
  ...APPROVED_STORYBOARD_TYPED_WRAPPER_DOC_PATHS,
  FLOW_EDITOR_COMPUTING_TEMPLATE_DOC_PATH,
]
const E2E_TYPED_WRAPPER_DOC_SET = new Set(APPROVED_TYPED_WRAPPER_DOC_PATHS)
const CANONICAL_PLAIN_YAML_DOC_CONTRACTS = [
  { filePath: path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-animatic-demo.md'), renderer: 'animatic', requiresFlow: true },
  { filePath: path.join(HUIJOOHWEE_DOCS_ROOT, 'knowgrph-storyboard-demo-index.md'), renderer: 'd3', requiresFlow: false },
] as const
const REQUIRED_FLOW_TYPED_SETTING_KEYS = ['direction', 'edgeType', 'snapToGrid', 'computed'] as const
const REQUIRED_FLOW_EDITOR_TYPED_FIXTURE_PRESET: Record<string, string | boolean> = {
  kgCanvasSurfaceMode: '2d',
  kgCanvasRenderMode: '2d',
  kgCanvas2dRenderer: 'flowEditor',
  kgDocumentSemanticMode: 'document',
  kgFrontmatterModeEnabled: true,
  kgMultiDimTableModeEnabled: false,
  kgDocumentStructureBaselineLock: false,
}
const REQUIRED_STORYBOARD_TYPED_FIXTURE_PRESET: Record<string, string | boolean> = {
  kgCanvasSurfaceMode: '2d',
  kgCanvasRenderMode: '2d',
  kgCanvas2dRenderer: 'storyboard',
  kgDocumentSemanticMode: 'document',
  kgFrontmatterModeEnabled: true,
  kgMultiDimTableModeEnabled: false,
  kgDocumentStructureBaselineLock: false,
}

type PlainRecord = Record<string, unknown>
type PublishedFlowEditorDocContract = {
  filePath: string | null
  requiredSummaries: ReadonlyArray<readonly [string, string]>
  requiredNodeTypedFields?: ReadonlyArray<{
    nodeId: string
    fields: readonly string[]
  }>
  requiredNodeLeadingFields?: ReadonlyArray<{
    nodeId: string
    fields: readonly string[]
  }>
  requiredNodeTargetHandles?: ReadonlyArray<{
    nodeId: string
    handles: readonly string[]
  }>
  requiredBlankNodeFields?: ReadonlyArray<{
    nodeId: string
    fields: readonly string[]
  }>
  forbiddenFragments?: readonly string[]
  optional: boolean
}

const listMarkdownFiles = (rootPath: string): string[] => {
  const entries = fs.readdirSync(rootPath, { withFileTypes: true })
  return entries.flatMap(entry => {
    const nextPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) return listMarkdownFiles(nextPath)
    return entry.isFile() && nextPath.endsWith('.md') ? [nextPath] : []
  })
}

const readUtf8 = (filePath: string): string => fs.readFileSync(filePath, 'utf8')

const toRepoRelativePath = (filePath: string): string => path.relative(GITHUB_ROOT, filePath)

const resolveMarkdownDocBySemanticFragments = (
  requiredFragments: readonly string[],
  args: { optional?: boolean } = {},
): string | null => {
  const candidates = listMarkdownFiles(HUIJOOHWEE_DOCS_ROOT)
  const found = candidates.find(filePath => {
    const text = readUtf8(filePath)
    return requiredFragments.every(fragment => text.includes(fragment))
  })
  if (found || args.optional) return found || null
  throw new Error(`Expected huijoohwee docs to contain a markdown document with semantic fragments: ${requiredFragments.join(', ')}`)
}

const isPlainRecord = (value: unknown): value is PlainRecord => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const extractFrontmatterYamlText = (markdownText: string, filePath: string): string => {
  const text = String(markdownText || '')
  if (!text.startsWith('---\n')) {
    throw new Error(`Expected ${toRepoRelativePath(filePath)} to start with a YAML frontmatter block`)
  }
  const endMarkerIndex = text.indexOf('\n---\n', 4)
  if (endMarkerIndex < 0) {
    throw new Error(`Expected ${toRepoRelativePath(filePath)} to close its YAML frontmatter block with ---`)
  }
  return text.slice(4, endMarkerIndex)
}

const readFrontmatterParts = (filePath: string): { yamlText: string; bodyText: string; delimiterCount: number } => {
  const text = readUtf8(filePath)
  if (!text.startsWith('---\n')) {
    throw new Error(`Expected ${toRepoRelativePath(filePath)} to start with a YAML frontmatter block`)
  }
  const endMarkerIndex = text.indexOf('\n---\n', 4)
  if (endMarkerIndex < 0) {
    throw new Error(`Expected ${toRepoRelativePath(filePath)} to close its YAML frontmatter block with ---`)
  }
  return {
    yamlText: text.slice(4, endMarkerIndex),
    bodyText: text.slice(endMarkerIndex + '\n---\n'.length),
    delimiterCount: (text.match(/^---$/gm) || []).length,
  }
}

const readFrontmatterRecord = (filePath: string): PlainRecord => {
  const yamlText = extractFrontmatterYamlText(readUtf8(filePath), filePath)
  const parsed = parseYaml(yamlText)
  if (!isPlainRecord(parsed)) {
    throw new Error(`Expected ${toRepoRelativePath(filePath)} frontmatter to parse as an object`)
  }
  return parsed
}

const assertExactCanvasPreset = (
  filePath: string,
  meta: PlainRecord,
  expected: { renderer: string },
  violations: string[],
) => {
  const requiredPreset: Record<string, string | boolean> = {
    kgCanvasSurfaceMode: '2d',
    kgCanvasRenderMode: '2d',
    kgCanvas2dRenderer: expected.renderer,
    kgDocumentSemanticMode: 'document',
    kgFrontmatterModeEnabled: true,
    kgMultiDimTableModeEnabled: false,
    kgDocumentStructureBaselineLock: false,
  }
  for (const [key, value] of Object.entries(requiredPreset)) {
    if (meta[key] !== value) {
      violations.push(
        `${toRepoRelativePath(filePath)} expected ${key}=${JSON.stringify(value)} but found ${JSON.stringify(meta[key])}`,
      )
    }
  }
}

const isTypedValueWrapper = (value: unknown, expectedKey?: string): value is { key: string; type: string; value: unknown } => {
  if (!isPlainRecord(value)) return false
  const keys = Object.keys(value).sort()
  if (keys.length !== 3 || keys[0] !== 'key' || keys[1] !== 'type' || keys[2] !== 'value') return false
  if (typeof value.key !== 'string' || !value.key.trim()) return false
  if (typeof value.type !== 'string' || !value.type.trim()) return false
  if (expectedKey && value.key !== expectedKey) return false
  return true
}

const listTypedWrapperMarkdownDocs = (): string[] => {
  return listMarkdownFiles(HUIJOOHWEE_DOCS_ROOT).filter(filePath => readUtf8(filePath).includes('{key:'))
}

const validateTypedWrapperFixtureFrontmatter = (
  filePath: string,
  violations: string[],
  requiredPreset: Record<string, string | boolean>,
) => {
  const meta = readFrontmatterRecord(filePath)
  for (const [key, expected] of Object.entries(requiredPreset)) {
    if (meta[key] !== expected) {
      violations.push(
        `${toRepoRelativePath(filePath)} expected ${key}=${JSON.stringify(expected)} but found ${JSON.stringify(meta[key])}`,
      )
    }
  }

  const flow = meta.flow
  if (!isPlainRecord(flow)) {
    violations.push(`${toRepoRelativePath(filePath)} expected frontmatter.flow to be an object`)
    return
  }

  for (const key of REQUIRED_FLOW_TYPED_SETTING_KEYS) {
    if (!isTypedValueWrapper(flow[key], key)) {
      violations.push(`${toRepoRelativePath(filePath)} expected flow.${key} to use a {key, type, value} wrapper`)
    }
  }

  if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
    violations.push(`${toRepoRelativePath(filePath)} expected flow.nodes to contain typed-wrapper nodes`)
  } else {
    flow.nodes.forEach((node, index) => {
      if (!isPlainRecord(node)) {
        violations.push(`${toRepoRelativePath(filePath)} expected flow.nodes[${index}] to be an object`)
        return
      }
      for (const [key, value] of Object.entries(node)) {
        if (!isTypedValueWrapper(value, key)) {
          violations.push(
            `${toRepoRelativePath(filePath)} expected flow.nodes[${index}].${key} to use a {key, type, value} wrapper`,
          )
        }
      }
    })
  }

  if (!Array.isArray(flow.edges) || flow.edges.length === 0) {
    violations.push(`${toRepoRelativePath(filePath)} expected flow.edges to remain present for Canvas rendering`)
  }
}

export function testHuijoohweeDocsAndGuidelinesForbidAbsoluteRepoPathHardcodes() {
  const targets = [
    ...listMarkdownFiles(HUIJOOHWEE_DOCS_ROOT),
    YAML_GUIDELINES_PATH,
    MARKDOWN_GUIDELINES_PATH,
  ]
  const forbiddenNeedles = [
    'file:///Users/huijoohwee/Documents/GitHub/',
    '/Users/huijoohwee/Documents/GitHub/',
  ]
  const violations: Array<{ file: string; needle: string }> = []
  for (const filePath of targets) {
    const text = readUtf8(filePath)
    for (const needle of forbiddenNeedles) {
      if (text.includes(needle)) {
        violations.push({
          file: toRepoRelativePath(filePath),
          needle,
        })
        break
      }
    }
  }
  if (violations.length > 0) {
    const msg = violations.map(v => `${v.file} contains ${JSON.stringify(v.needle)}`).join('\n')
    throw new Error(`Expected docs/guidelines to avoid machine-local repo path hardcodes:\n${msg}`)
  }
}

export function testE2EVideoFixturesUseTypedFrontmatterValueWrappers() {
  const violations: string[] = []
  const typedWrapperDocs = listTypedWrapperMarkdownDocs()
  const unexpectedTypedWrapperDocs = typedWrapperDocs
    .filter(filePath => !E2E_TYPED_WRAPPER_DOC_SET.has(filePath))
    .map(filePath => `${toRepoRelativePath(filePath)} uses {key, type, value} wrappers outside the approved E2E fixture set`)
  const missingTypedWrapperDocs = E2E_VIDEO_DOC_PATHS
    .filter(filePath => !typedWrapperDocs.includes(filePath))
    .map(filePath => `${toRepoRelativePath(filePath)} is missing typed-wrapper frontmatter content`)

  violations.push(...unexpectedTypedWrapperDocs, ...missingTypedWrapperDocs)

  for (const filePath of E2E_VIDEO_DOC_PATHS) {
    validateTypedWrapperFixtureFrontmatter(filePath, violations, REQUIRED_FLOW_EDITOR_TYPED_FIXTURE_PRESET)
  }

  if (violations.length > 0) {
    throw new Error(`Expected normalized E2E fixtures to keep typed frontmatter value wrappers:\n${violations.join('\n')}`)
  }
}

export function testStoryboardDemoUsesTypedFrontmatterValueWrappers() {
  const violations: string[] = []
  const typedWrapperDocs = listTypedWrapperMarkdownDocs()
  for (const filePath of APPROVED_STORYBOARD_TYPED_WRAPPER_DOC_PATHS) {
    if (!typedWrapperDocs.includes(filePath)) {
      violations.push(`${toRepoRelativePath(filePath)} is missing typed-wrapper frontmatter content`)
      continue
    }
    validateTypedWrapperFixtureFrontmatter(filePath, violations, REQUIRED_STORYBOARD_TYPED_FIXTURE_PRESET)
  }

  const meta = readFrontmatterRecord(STORYBOARD_TYPED_WRAPPER_DOC_PATH)
  const flow = meta.flow
  if (!isPlainRecord(flow)) {
    violations.push(`${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected frontmatter.flow to be an object`)
  } else {
    for (const key of ['direction', 'edgeType', 'balancedViewportPreset'] as const) {
      if (!isTypedValueWrapper(flow[key], key)) {
        violations.push(`${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected flow.${key} to use a {key, type, value} wrapper`)
      }
    }
    if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
      violations.push(`${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected flow.nodes to contain typed-wrapper nodes`)
    } else {
      flow.nodes.forEach((node, index) => {
        if (!isPlainRecord(node)) {
          violations.push(`${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected flow.nodes[${index}] to be an object`)
          return
        }
        for (const [key, value] of Object.entries(node)) {
          if (!isTypedValueWrapper(value, key)) {
            violations.push(
              `${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected flow.nodes[${index}].${key} to use a {key, type, value} wrapper`,
            )
          }
        }
      })
      const targetNode = flow.nodes.find(node => isPlainRecord(node) && isTypedValueWrapper(node.id, 'id') && node.id.value === 'SCENE_03')
      if (!isPlainRecord(targetNode) || !isTypedValueWrapper(targetNode.position, 'position')) {
        violations.push(`${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected SCENE_03 to expose wrapped position metadata`)
      } else if (JSON.stringify(targetNode.position.value) !== JSON.stringify({ x: 0, y: -720 })) {
        violations.push(
          `${toRepoRelativePath(STORYBOARD_TYPED_WRAPPER_DOC_PATH)} expected SCENE_03.position to equal {"x":0,"y":-720} but found ${JSON.stringify(targetNode.position.value)}`,
        )
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Expected storyboard demo to keep normalized typed frontmatter value wrappers:\n${violations.join('\n')}`)
  }
}

export function testCanonicalAnimaticAndStoryboardDocsUsePlainYamlFrontmatter() {
  const violations: string[] = []

  for (const { filePath, renderer, requiresFlow } of CANONICAL_PLAIN_YAML_DOC_CONTRACTS) {
    const text = readUtf8(filePath)
    const meta = readFrontmatterRecord(filePath)
    assertExactCanvasPreset(filePath, meta, { renderer }, violations)

    if (text.includes('{key:')) {
      violations.push(`${toRepoRelativePath(filePath)} must keep canonical docs in plain YAML and avoid {key, type, value} wrappers`)
    }

    if (requiresFlow) {
      const flow = meta.flow
      if (!isPlainRecord(flow)) {
        violations.push(`${toRepoRelativePath(filePath)} expected frontmatter.flow to stay present as a plain YAML object`)
      } else {
        if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
          violations.push(`${toRepoRelativePath(filePath)} expected flow.nodes to stay present in canonical plain YAML`)
        }
        const firstNode = Array.isArray(flow.nodes) ? flow.nodes[0] : null
        if (!isPlainRecord(firstNode) || typeof firstNode.id !== 'string') {
          violations.push(`${toRepoRelativePath(filePath)} expected canonical flow.nodes[*].id values to stay plain YAML scalars`)
        }
      }
    } else if ('flow' in meta) {
      violations.push(`${toRepoRelativePath(filePath)} should remain an index-style document without an unnecessary flow block`)
    }
  }

  if (violations.length > 0) {
    throw new Error(`Expected canonical animatic/storyboard docs to keep explicit plain-YAML frontmatter presets:\n${violations.join('\n')}`)
  }
}

export function testGuidelinesDescribeCanonicalAndNormalizedFrontmatterContracts() {
  const yamlGuidelines = readUtf8(YAML_GUIDELINES_PATH)
  const markdownGuidelines = readUtf8(MARKDOWN_GUIDELINES_PATH)
  const yamlRequired = [
    'Canonical authored Markdown stays plain YAML for source-of-truth authoring',
    'E2E ingestion and rendering fixtures may use a normalized typed wrapper shape after parsing',
    'Use `{key, type, value}` wrappers only in normalized validation fixtures',
  ]
  const markdownRequired = [
    'Canonical authored Markdown uses plain YAML scalars, arrays, and objects in the `flow:` block.',
    'Normalized E2E pipeline fixtures may wrap individual values as `{key, type, value}` after parsing',
    '- id: {key: id, type: string, value: "w-text-script"}',
  ]
  const missing = [
    ...yamlRequired.filter(snippet => !yamlGuidelines.includes(snippet)).map(snippet => `yaml-frontmatter-guidelines.md missing ${JSON.stringify(snippet)}`),
    ...markdownRequired.filter(snippet => !markdownGuidelines.includes(snippet)).map(snippet => `markdown-syntax-guidelines.md missing ${JSON.stringify(snippet)}`),
  ]
  if (missing.length > 0) {
    throw new Error(`Expected guidelines to describe canonical authoring and normalized E2E frontmatter contracts:\n${missing.join('\n')}`)
  }
}

export function testPublishedFlowEditorDocsKeepFrontmatterAsMachineSsot() {
  const contracts: PublishedFlowEditorDocContract[] = [
    {
      filePath: resolveMarkdownDocBySemanticFragments([
        'knowgrph-mainpanel-superagent-integrations-demo/v1',
        'kgra_superagent_harness',
        'swarm_prediction_world',
        'panel_text_research_brief',
      ]),
      requiredSummaries: [
        ['kgra_superagent_harness', 'swarm simulation task slices'],
        ['swarm_prediction_world', 'bounded deterministic world simulation'],
        ['panel_text_research_brief', 'staged research brief'],
      ],
      optional: false,
    },
    {
      filePath: FLOW_EDITOR_COMPUTING_TEMPLATE_DOC_PATH,
      requiredSummaries: [
        ['source_input', 'granular query, context, audience, format, constraints, evidence, tone, metric label, and metric target inputs'],
        ['compute_summary', 'semantic ports for granular inputs'],
        ['panel_chart_output', 'outputSrcDoc field'],
      ],
      requiredNodeTypedFields: [
        {
          nodeId: 'source_input',
          fields: [
            'input_query',
            'input_context',
            'input_audience',
            'input_format',
            'input_constraints',
            'input_evidence',
            'input_tone',
            'input_metric_label',
            'input_metric_target',
          ],
        },
      ],
      requiredNodeLeadingFields: [
        {
          nodeId: 'source_input',
          fields: [
            'label',
            'position',
            'input_query',
            'input_context',
            'input_audience',
            'input_format',
            'input_constraints',
            'input_evidence',
            'input_tone',
            'input_metric_label',
            'input_metric_target',
          ],
        },
      ],
      requiredNodeTargetHandles: [
        {
          nodeId: 'compute_summary',
          handles: [
            'input_query',
            'input_context',
            'input_audience',
            'input_format',
            'input_constraints',
            'input_evidence',
            'input_tone',
            'input_metric_label',
            'input_metric_target',
          ],
        },
      ],
      requiredBlankNodeFields: [
        {
          nodeId: 'compute_summary',
          fields: ['output', 'imageUrl', 'outputSrcDoc'],
        },
      ],
      forbiddenFragments: [
        'Computed output',
        '500-word baseline',
      ],
      optional: false,
    },
    {
      filePath: resolveMarkdownDocBySemanticFragments([
        'horizon, portfolio weights',
        'typed compute function',
        'iframe srcdoc',
        'panel_chart_output',
      ], { optional: true }),
      requiredSummaries: [
        ['source_input', 'horizon, portfolio weights'],
        ['compute_summary', 'typed compute function'],
        ['panel_chart_output', 'iframe srcdoc'],
      ],
      optional: true,
    },
  ]
  const violations: string[] = []

  for (const contract of contracts) {
    if (!contract.filePath) continue
    if (contract.optional && !fs.existsSync(contract.filePath)) continue
    const { yamlText, bodyText, delimiterCount } = readFrontmatterParts(contract.filePath)
    if (delimiterCount !== 2) {
      violations.push(`${toRepoRelativePath(contract.filePath)} expected exactly one opening YAML frontmatter block`)
    }
    if (/(^|\n)## KGC Reading Layer\b/.test(bodyText)) {
      violations.push(`${toRepoRelativePath(contract.filePath)} must not keep a body-side KGC Reading Layer`)
    }
    if (/(^|\n)@(?:node|edge):/.test(bodyText)) {
      violations.push(`${toRepoRelativePath(contract.filePath)} must not keep body-side @node/@edge graph mirrors`)
    }
    if (/(^|\n)flow:\s*(\n|$)/.test(bodyText)) {
      violations.push(`${toRepoRelativePath(contract.filePath)} must not keep body-side flow: graph mirrors`)
    }
    for (const fragment of contract.forbiddenFragments || []) {
      if (yamlText.includes(fragment) || bodyText.includes(fragment)) {
        violations.push(`${toRepoRelativePath(contract.filePath)} must not keep stale generated fragment ${JSON.stringify(fragment)}`)
      }
    }

    const meta = parseYaml(yamlText)
    if (!isPlainRecord(meta) || !isPlainRecord(meta.flow) || !Array.isArray(meta.flow.nodes)) {
      violations.push(`${toRepoRelativePath(contract.filePath)} expected frontmatter.flow.nodes to own Flow Editor nodes`)
      continue
    }
    for (const [nodeId, expectedFragment] of contract.requiredSummaries) {
      const node = meta.flow.nodes.find(candidate => {
        if (!isPlainRecord(candidate)) return false
        const idField = candidate.id
        return isPlainRecord(idField) && idField.value === nodeId
      })
      if (!isPlainRecord(node)) {
        violations.push(`${toRepoRelativePath(contract.filePath)} expected frontmatter node ${nodeId}`)
        continue
      }
      const summary = node['kgc:readingSummary']
      if (!isPlainRecord(summary) || !String(summary.value || '').includes(expectedFragment)) {
        violations.push(`${toRepoRelativePath(contract.filePath)} expected node ${nodeId} to own kgc:readingSummary containing ${JSON.stringify(expectedFragment)}`)
      }
    }

    for (const required of contract.requiredNodeTypedFields || []) {
      const node = meta.flow.nodes.find(candidate => {
        if (!isPlainRecord(candidate)) return false
        const idField = candidate.id
        return isPlainRecord(idField) && idField.value === required.nodeId
      })
      if (!isPlainRecord(node)) {
        violations.push(`${toRepoRelativePath(contract.filePath)} expected frontmatter node ${required.nodeId}`)
        continue
      }
      for (const fieldKey of required.fields) {
        if (!isTypedValueWrapper(node[fieldKey], fieldKey)) {
          violations.push(`${toRepoRelativePath(contract.filePath)} expected node ${required.nodeId}.${fieldKey} to use a {key,type,value} KTV wrapper`)
        }
      }
    }

    for (const required of contract.requiredNodeLeadingFields || []) {
      const node = meta.flow.nodes.find(candidate => {
        if (!isPlainRecord(candidate)) return false
        const idField = candidate.id
        return isPlainRecord(idField) && idField.value === required.nodeId
      })
      if (!isPlainRecord(node)) {
        violations.push(`${toRepoRelativePath(contract.filePath)} expected frontmatter node ${required.nodeId}`)
        continue
      }
      const fieldKeys = Object.keys(node).filter(key => key !== 'id' && key !== 'type')
      const leading = fieldKeys.slice(0, required.fields.length)
      if (leading.join('\n') !== required.fields.join('\n')) {
        violations.push(`${toRepoRelativePath(contract.filePath)} expected node ${required.nodeId} to expose granular KTV input fields before metadata rows`)
      }
    }

    for (const required of contract.requiredNodeTargetHandles || []) {
      const edges = Array.isArray(meta.flow.edges) ? meta.flow.edges : []
      const connectedTargetHandles = new Set<string>()
      for (const edge of edges) {
        if (!isPlainRecord(edge)) continue
        const target = edge.target
        const targetHandle = edge.targetHandle
        if (
          isTypedValueWrapper(target, 'target')
          && target.value === required.nodeId
          && isTypedValueWrapper(targetHandle, 'targetHandle')
          && typeof targetHandle.value === 'string'
        ) {
          connectedTargetHandles.add(targetHandle.value)
        }
      }
      for (const handle of required.handles) {
        if (!connectedTargetHandles.has(handle)) {
          violations.push(`${toRepoRelativePath(contract.filePath)} expected node ${required.nodeId} target handle ${handle} to be connected by a typed edge`)
        }
      }
    }

    for (const required of contract.requiredBlankNodeFields || []) {
      const node = meta.flow.nodes.find(candidate => {
        if (!isPlainRecord(candidate)) return false
        const idField = candidate.id
        return isPlainRecord(idField) && idField.value === required.nodeId
      })
      if (!isPlainRecord(node)) {
        violations.push(`${toRepoRelativePath(contract.filePath)} expected frontmatter node ${required.nodeId}`)
        continue
      }
      for (const fieldKey of required.fields) {
        const field = node[fieldKey]
        if (!isTypedValueWrapper(field, fieldKey) || field.value !== '') {
          violations.push(`${toRepoRelativePath(contract.filePath)} expected reusable node ${required.nodeId}.${fieldKey} to keep an empty KTV value`)
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Expected published Flow Editor docs to keep frontmatter as the machine SSOT:\n${violations.join('\n')}`)
  }
}

import { createAgenticOsInvocationCatalogRuntime } from './agenticOsInvocationCatalogRuntime'
import {
  XR_SCENE_INVOCATION_BINDINGS,
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_INVOCATION_SEMANTICS,
} from '@/features/three/xrSceneMcpContract.mjs'

export type AgenticOsDocInvocationId = string

export type AgenticOsDocInvocation = {
  id: AgenticOsDocInvocationId
  fileName: string
  label: string
  summary: string
  slashCommand: `/${string}`
  hashToken: `#${string}`
  atToken: `@${string}`
  sourcePath: string
  keywords: readonly string[]
}

export type AgenticOsDictionaryInvocationKind = 'command' | 'semantic' | 'binding'

export type AgenticOsDictionaryInvocation = {
  id: string
  kind: AgenticOsDictionaryInvocationKind
  token: `/${string}` | `#${string}` | `@${string}`
  label: string
  summary: string
  group: string
  sourcePath: string
  dictionaryFileName: 'DICTIONARY-COMMAND.md' | 'DICTIONARY-SEMANTIC.md' | 'DICTIONARY-BINDING.md'
  keywords: readonly string[]
}

export const AGENTIC_OS_CANVAS_INTERACTION_PANEL_KEYWORD = 'canvas interaction panel' as const
export const AGENTIC_OS_DOCS_GITHUB_ROOT_URL = 'https://github.com/huijoohwee/agentic-canvas-os/blob/main/docs'
export const KNOWGRPH_DOCS_GITHUB_ROOT_URL = 'https://github.com/huijoohwee/knowgrph/blob/main/docs/documents'
export const KNOWGRPH_PROBE_TREE_DOC_INVOCATION = {
  id: 'knowgrph-probe-tree',
  fileName: 'knowgrph-probe-tree-prd-tad.md',
  label: 'Knowgrph Probe-Tree',
  summary: 'Bounded local probe branching that produces user-selectable next-step cards and preserves Markdown graph state as the SSOT.',
  slashCommand: '/knowgrph.probe-tree',
  hashToken: '#knowgrph.probe-tree',
  atToken: '@knowgrph.probe-tree',
  sourcePath: `${KNOWGRPH_DOCS_GITHUB_ROOT_URL}/knowgrph-probe-tree-prd-tad.md`,
  keywords: ['probe tree', 'branching', 'clarification', 'candidate options', 'markdown graph'],
} as const satisfies AgenticOsDocInvocation

export const AGENTIC_OS_DOC_INVOCATIONS: readonly AgenticOsDocInvocation[] = [
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION,
]

export const AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX = 'agentic-os-doc:'
export const AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX = 'agentic-os-invocation:'

const dictionaryFileNameByKind: Record<
  AgenticOsDictionaryInvocationKind,
  AgenticOsDictionaryInvocation['dictionaryFileName']
> = {
  command: 'DICTIONARY-COMMAND.md',
  semantic: 'DICTIONARY-SEMANTIC.md',
  binding: 'DICTIONARY-BINDING.md',
}

const dictionaryPath = (fileName: AgenticOsDictionaryInvocation['dictionaryFileName']): string => (
  `${AGENTIC_OS_DOCS_GITHUB_ROOT_URL}/${encodeURIComponent(fileName)}`
)

const sanitizeInvocationId = (token: string): string => String(token || '')
  .replace(/^[/#@]+/, '')
  .replace(/[^A-Za-z0-9._-]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase()

const buildAgenticOsDictionaryInvocation = (args: {
  kind: AgenticOsDictionaryInvocationKind
  token: AgenticOsDictionaryInvocation['token']
  label: string
  summary: string
  group: string
  dictionaryFileName: AgenticOsDictionaryInvocation['dictionaryFileName']
  keywords: readonly string[]
}): AgenticOsDictionaryInvocation => ({
  ...args,
  id: `${args.kind}:${sanitizeInvocationId(args.token)}`,
  sourcePath: dictionaryPath(args.dictionaryFileName),
})

const XR_SCENE_COMMAND_FALLBACKS = [
  { token: XR_SCENE_INVOCATION_COMMANDS.stage, label: 'Stage XR environment', summary: 'Select the native XR environment for the active canvas scene.' },
  { token: XR_SCENE_INVOCATION_COMMANDS.place, label: 'Place XR asset', summary: 'Place a native 3D asset into the active XR scene.' },
  { token: XR_SCENE_INVOCATION_COMMANDS.label, label: 'Label XR subject', summary: 'Update the label of a placed XR scene subject.' },
  { token: XR_SCENE_INVOCATION_COMMANDS.remove, label: 'Remove XR subject', summary: 'Remove a placed subject from the active XR scene.' },
  { token: XR_SCENE_INVOCATION_COMMANDS.physics, label: 'Control XR physics', summary: 'Control native fixed-step XR world, body, and impulse operations.' },
  { token: XR_SCENE_INVOCATION_COMMANDS.present, label: 'Present XR scene', summary: 'Place the active XR scene at the current immersive reticle.' },
] as const

const XR_SCENE_SEMANTIC_FALLBACKS = [
  { token: XR_SCENE_INVOCATION_SEMANTICS.world, label: 'XR physics world', summary: 'Route an XR physics operation to world and transport settings.' },
  { token: XR_SCENE_INVOCATION_SEMANTICS.body, label: 'XR physics body', summary: 'Route an XR physics operation to one placed subject body.' },
  { token: XR_SCENE_INVOCATION_SEMANTICS.impulse, label: 'XR physics impulse', summary: 'Route a finite impulse to one dynamic XR body.' },
  { token: XR_SCENE_INVOCATION_SEMANTICS.reticle, label: 'XR placement reticle', summary: 'Route immersive placement to the current tracked reticle.' },
] as const

const XR_SCENE_BINDING_FALLBACKS = [
  { token: XR_SCENE_INVOCATION_BINDINGS.canvas, label: 'Active canvas', summary: 'Bind the invocation to the active Knowgrph canvas.' },
  { token: XR_SCENE_INVOCATION_BINDINGS.scene, label: 'Active XR scene', summary: 'Bind the invocation to the active immersive XR scene.' },
] as const

const buildXrSceneFallbackInvocation = (
  kind: AgenticOsDictionaryInvocationKind,
  definition: Readonly<{ token: AgenticOsDictionaryInvocation['token']; label: string; summary: string }>,
): AgenticOsDictionaryInvocation => buildAgenticOsDictionaryInvocation({
  kind,
  token: definition.token,
  label: definition.label,
  summary: definition.summary,
  group: 'XR scene control',
  dictionaryFileName: dictionaryFileNameByKind[kind],
  keywords: [
    AGENTIC_OS_CANVAS_INTERACTION_PANEL_KEYWORD,
    'xr scene control',
    'xr mode',
    'immersive scene',
    'webmcp',
  ],
})

export const AGENTIC_OS_COMMAND_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = Object.freeze(
  XR_SCENE_COMMAND_FALLBACKS.map(definition => buildXrSceneFallbackInvocation('command', definition)),
)
export const AGENTIC_OS_SEMANTIC_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = Object.freeze(
  XR_SCENE_SEMANTIC_FALLBACKS.map(definition => buildXrSceneFallbackInvocation('semantic', definition)),
)
export const AGENTIC_OS_BINDING_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = Object.freeze(
  XR_SCENE_BINDING_FALLBACKS.map(definition => buildXrSceneFallbackInvocation('binding', definition)),
)
export const AGENTIC_OS_DICTIONARY_INVOCATIONS: readonly AgenticOsDictionaryInvocation[] = Object.freeze([
  ...AGENTIC_OS_COMMAND_INVOCATIONS,
  ...AGENTIC_OS_SEMANTIC_INVOCATIONS,
  ...AGENTIC_OS_BINDING_INVOCATIONS,
])

const invocationCatalogRuntime = createAgenticOsInvocationCatalogRuntime({
  docs: AGENTIC_OS_DOC_INVOCATIONS,
  commands: AGENTIC_OS_COMMAND_INVOCATIONS,
  semantics: AGENTIC_OS_SEMANTIC_INVOCATIONS,
  bindings: AGENTIC_OS_BINDING_INVOCATIONS,
  dictionaryActionIdPrefix: AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX,
  buildDictionaryInvocation: args => buildAgenticOsDictionaryInvocation({
    ...args,
    dictionaryFileName: dictionaryFileNameByKind[args.kind],
  }),
})

export const getAgenticOsDocInvocations = invocationCatalogRuntime.getDocs
export const getAgenticOsCommandInvocations = invocationCatalogRuntime.getCommands
export const getAgenticOsSemanticInvocations = invocationCatalogRuntime.getSemantics
export const getAgenticOsBindingInvocations = invocationCatalogRuntime.getBindings
export const getAgenticOsDictionaryInvocations = invocationCatalogRuntime.getDictionary
export const getAgenticOsCanvasInteractionPanelInvocations = (): readonly AgenticOsDictionaryInvocation[] => (
  getAgenticOsDictionaryInvocations().filter(invocation => invocation.keywords.includes(AGENTIC_OS_CANVAS_INTERACTION_PANEL_KEYWORD))
)

export type AgenticOsResolvedInvocation = {
  kind: AgenticOsDictionaryInvocationKind | 'doc'
  token: string
  label: string
  summary: string
  sourcePath: string
}

export const findAgenticOsInvocationByToken = (token: string): AgenticOsResolvedInvocation | null => {
  const value = String(token || '').trim()
  return value ? invocationCatalogRuntime.findByToken(value) : null
}

export const buildAgenticOsInvocationSourceTitle = (invocation: AgenticOsResolvedInvocation): string => (
  [
    `${invocation.token} - ${invocation.label}`,
    invocation.summary,
    `Source: ${invocation.sourcePath}`,
  ].filter(Boolean).join('\n')
)

export const findAgenticOsDocInvocationByActionId = (actionId: string): AgenticOsDocInvocation | null => {
  const id = String(actionId || '').startsWith(AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX)
    ? String(actionId).slice(AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX.length)
    : ''
  return getAgenticOsDocInvocations().find(doc => doc.id === id) || null
}

export const buildAgenticOsDocActionId = (doc: AgenticOsDocInvocation): string => (
  `${AGENTIC_OS_DOC_INVOCATION_ACTION_ID_PREFIX}${doc.id}`
)

export const buildAgenticOsDictionaryActionId = (invocation: AgenticOsDictionaryInvocation): string => (
  `${AGENTIC_OS_DICTIONARY_INVOCATION_ACTION_ID_PREFIX}${invocation.id}`
)

export const findAgenticOsDictionaryInvocationByActionId = (actionId: string): AgenticOsDictionaryInvocation | null => (
  invocationCatalogRuntime.findDictionaryByActionId(String(actionId || ''))
)

export const buildAgenticOsDocInvocationMarkdown = (doc: AgenticOsDocInvocation): string => doc.slashCommand
export const buildAgenticOsDocSemanticInvocationMarkdown = (doc: AgenticOsDocInvocation): string => doc.hashToken
export const buildAgenticOsDocBindingInvocationMarkdown = (doc: AgenticOsDocInvocation): string => doc.atToken
export const buildAgenticOsDictionaryInvocationMarkdown = (invocation: AgenticOsDictionaryInvocation): string => invocation.token

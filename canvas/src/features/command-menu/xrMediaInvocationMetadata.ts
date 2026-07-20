import type { AgenticOsRemoteGrammarSnapshot } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import {
  XR_SCENE_INVOCATION_BINDINGS,
  XR_SCENE_INVOCATION_COMMANDS,
  XR_SCENE_INVOCATION_SEMANTICS,
} from '@/features/three/xrSceneMcpContract.mjs'

const XR_MEDIA_REQUIRED_METADATA_TOKENS = Object.freeze([
  ...Object.values(XR_SCENE_INVOCATION_COMMANDS).map(token => ({ kind: 'command' as const, token })),
  ...Object.values(XR_SCENE_INVOCATION_SEMANTICS).map(token => ({ kind: 'semantic' as const, token })),
  ...Object.values(XR_SCENE_INVOCATION_BINDINGS).map(token => ({ kind: 'binding' as const, token })),
])

export const isXrMediaInvocationMetadataReady = (catalog: AgenticOsRemoteGrammarSnapshot): boolean => (
  catalog.hydration.status === 'fresh'
  && XR_MEDIA_REQUIRED_METADATA_TOKENS.every(required => catalog.entries.some(entry => entry.token === required.token && entry.kind === required.kind))
)

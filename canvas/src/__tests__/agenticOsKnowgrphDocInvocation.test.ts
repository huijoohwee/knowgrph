import {
  AGENTIC_OS_DOC_INVOCATIONS,
  KNOWGRPH_DOCS_GITHUB_ROOT_URL,
  findAgenticOsInvocationByToken,
} from '@/features/agentic-os/agenticOsDocInvocations'
import {
  buildFloatingPanelChatComposerOverlayParts,
} from '@/features/chat/floatingPanelChat/FloatingPanelChatComposerMediaOverlay'
import { buildChatInvocationSystemPrompt, parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { resolveChatRuntimeInvocationQuery } from '@/features/chat/chatRuntimeInvocationQuery'

export function testKnowgrphProbeTreeDocInvocationResolvesAcrossSlashHashAt() {
  const doc = AGENTIC_OS_DOC_INVOCATIONS.find(invocation => invocation.id === 'knowgrph.probe-tree')
  if (!doc) throw new Error('expected Knowgrph probe-tree PRD/TAD doc invocation to be registered')
  if (doc.fileName !== 'knowgrph-probe-tree-prd-tad.md') {
    throw new Error(`expected probe-tree invocation to point at the PRD/TAD doc, got ${doc.fileName}`)
  }
  if (doc.sourcePath !== `${KNOWGRPH_DOCS_GITHUB_ROOT_URL}/knowgrph-probe-tree-prd-tad.md`) {
    throw new Error(`expected portable Knowgrph docs source URL, got ${doc.sourcePath}`)
  }
  if (doc.sourcePath.includes('/Users/') || doc.sourcePath.includes('localhost')) {
    throw new Error(`expected probe-tree source path to stay portable, got ${doc.sourcePath}`)
  }

  const expectedTokens = ['/knowgrph.probe-tree', '#knowgrph.probe-tree', '@knowgrph.probe-tree'] as const
  for (const token of expectedTokens) {
    const resolved = findAgenticOsInvocationByToken(token)
    if (resolved?.kind !== 'doc' || resolved.sourcePath !== doc.sourcePath) {
      throw new Error(`expected ${token} to resolve to the probe-tree doc, got ${JSON.stringify(resolved)}`)
    }
    const runtimeQuery = resolveChatRuntimeInvocationQuery(`${token} generate first branch questions`)
    if (runtimeQuery.leadingRoute?.sourcePath !== doc.sourcePath || runtimeQuery.query !== 'generate first branch questions') {
      throw new Error(`expected ${token} to split route from the live query, got ${JSON.stringify(runtimeQuery)}`)
    }
  }

  const directives = parseChatInvocationDirectives('Bind this response to #knowgrph.probe-tree and #runtime-ready.')
  if (!directives.some(directive => directive.id === 'knowgrph.probe-tree' && directive.sourcePath === doc.sourcePath)) {
    throw new Error(`expected #knowgrph.probe-tree to resolve as a chat invocation directive, got ${JSON.stringify(directives)}`)
  }
  const systemPrompt = buildChatInvocationSystemPrompt({
    userQuery: 'Bind this response to #knowgrph.probe-tree and #runtime-ready.',
    chatProvider: 'local',
    chatModel: 'probe-tree-harness',
  })
  for (const expected of ['#knowgrph.probe-tree', 'knowgrph-probe-tree-prd-tad.md', 'do not authorize Prod or Cloudflare deployment']) {
    if (!systemPrompt.includes(expected)) throw new Error(`expected Knowgrph invocation prompt to include ${expected}`)
  }

  const overlay = buildFloatingPanelChatComposerOverlayParts(expectedTokens.join(' '))
  const overlayTokens = overlay.parts.flatMap(part => part.kind === 'invocation' ? [`${part.tokenKind}:${part.text}`] : [])
  const expectedOverlayTokens = ['slash:/knowgrph.probe-tree', 'keyword:#knowgrph.probe-tree', 'binding:@knowgrph.probe-tree']
  if (!overlay.hasOverlay || JSON.stringify(overlayTokens) !== JSON.stringify(expectedOverlayTokens)) {
    throw new Error(`expected probe-tree / # @ tokens to render through shared invocation chips, got ${JSON.stringify(overlay)}`)
  }
}

import { buildStorageChatRelayDecisionFixture } from '@/__tests__/helpers/chatSubmitArgsFixture'
import { buildStorageChatRelayLogDescriptor } from '@/features/chat/floatingPanelChat/floatingPanelChatRelayDiagnostics'

export function testBuildStorageChatRelayLogDescriptorReturnsNullForDisabledAndLoadingStates() {
  const disabledDescriptor = buildStorageChatRelayLogDescriptor({
    relayDecision: buildStorageChatRelayDecisionFixture({ kind: 'disabled' }),
    workspaceId: 'kgws:test-chat',
    providerLabel: 'Agnes AI',
    authMode: 'serverManaged',
    policy: null,
  })
  if (disabledDescriptor !== null) {
    throw new Error('expected disabled relay diagnostics not to emit a shared log descriptor')
  }

  const loadingDescriptor = buildStorageChatRelayLogDescriptor({
    relayDecision: buildStorageChatRelayDecisionFixture({
      kind: 'loading',
      detail: 'Checking workspace relay policy...',
    }),
    workspaceId: 'kgws:test-chat',
    providerLabel: 'Agnes AI',
    authMode: 'serverManaged',
    policy: null,
  })
  if (loadingDescriptor !== null) {
    throw new Error('expected loading relay diagnostics not to emit a shared log descriptor')
  }
}

export function testBuildStorageChatRelayLogDescriptorBuildsReadyAndBlockedEntries() {
  const readyDecision = buildStorageChatRelayDecisionFixture({
    kind: 'ready',
    detail: 'Agnes AI workspace relay is ready.',
    authMode: 'byok',
    workspaceId: 'kgws:test-chat',
  })
  const readyDescriptor = buildStorageChatRelayLogDescriptor({
    relayDecision: readyDecision,
    workspaceId: 'kgws:test-chat',
    providerLabel: 'Agnes AI',
    authMode: 'byok',
    policy: readyDecision.policy,
  })
  if (!readyDescriptor) {
    throw new Error('expected ready relay diagnostics to emit a shared log descriptor')
  }
  if (readyDescriptor.entry.kind !== 'neutral' || readyDescriptor.entry.source !== 'chat:relay') {
    throw new Error(`expected ready relay descriptor to stay neutral chat:relay, got ${JSON.stringify(readyDescriptor.entry)}`)
  }
  for (const snippet of [
    'Agnes AI',
    'workspace relay is ready',
    'workspace=kgws:test-chat',
    'role=editor',
    'auth=byok',
  ]) {
    if (!String(readyDescriptor.entry.message || '').includes(snippet)) {
      throw new Error(`expected ready relay descriptor message to include ${snippet}, got ${JSON.stringify(readyDescriptor.entry.message)}`)
    }
  }
  if (!readyDescriptor.signature.includes('ready') || !readyDescriptor.signature.includes('editor')) {
    throw new Error(`expected ready relay descriptor signature to encode kind and role, got ${JSON.stringify(readyDescriptor.signature)}`)
  }

  const blockedDecision = buildStorageChatRelayDecisionFixture({
    kind: 'blocked',
    detail: 'Agnes AI server-managed relay is not enabled for this workspace.',
    authMode: 'serverManaged',
    workspaceId: 'kgws:test-chat',
  })
  const blockedDescriptor = buildStorageChatRelayLogDescriptor({
    relayDecision: blockedDecision,
    workspaceId: 'kgws:test-chat',
    providerLabel: 'Agnes AI',
    authMode: 'serverManaged',
    policy: blockedDecision.policy,
  })
  if (!blockedDescriptor) {
    throw new Error('expected blocked relay diagnostics to emit a shared log descriptor')
  }
  if (blockedDescriptor.entry.kind !== 'warning') {
    throw new Error(`expected blocked relay descriptor to warn, got ${JSON.stringify(blockedDescriptor.entry)}`)
  }
  for (const snippet of [
    'Agnes AI',
    'relay is not enabled for this workspace',
    'workspace=kgws:test-chat',
    'auth=server-managed',
  ]) {
    if (!String(blockedDescriptor.entry.message || '').includes(snippet)) {
      throw new Error(`expected blocked relay descriptor message to include ${snippet}, got ${JSON.stringify(blockedDescriptor.entry.message)}`)
    }
  }
}

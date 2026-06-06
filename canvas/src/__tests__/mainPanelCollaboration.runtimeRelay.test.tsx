import React from 'react'
import { createRoot } from 'react-dom/client'
import { P2P_COLLAB_PROTOCOL_VERSION } from '@/features/collaboration/p2pCollaborationProtocol'
import { useP2PCollaborationStore } from '@/features/collaboration/p2pCollaborationStore'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import {
  CollaborationRuntimeHarness,
  FakeGuestPeer,
  FakeHostPeer,
  MockRTCPeerConnection,
  resetCollaborationStore,
  waitForCondition,
} from './mainPanelCollaboration.testkit'

export async function testP2PCollaborationRuntimeRelaysRosterPresenceAndDocumentAcrossGuests() {
  resetCollaborationStore()
  MockRTCPeerConnection.reset()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const previousWindowRtc = (dom.window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection
  const previousGlobalRtc = (globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection
  const applyRemoteDocumentCalls: Array<{ documentKey: string; text: string }> = []
  const revealRemoteLines: number[] = []

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      RTCPeerConnection?: unknown
    }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    anyWindow.RTCPeerConnection = MockRTCPeerConnection
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection

    useGraphStore.getState().resetAll()
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(
      root,
      React.createElement(CollaborationRuntimeHarness, {
        activeText: '# Host draft\n',
        applyRemoteDocumentCalls,
        revealRemoteLines,
      }),
      { window: dom.window, frames: 4 },
    )

    const store = useP2PCollaborationStore.getState()
    store.queueStartHost()
    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'host' && next.phase === 'awaiting-answer' && Boolean(next.inviteToken)
    })

    const guestA = new FakeGuestPeer({ peerId: 'guest-a', displayName: 'Guest A' })
    const inviteTokenA = String(useP2PCollaborationStore.getState().inviteToken || '')
    const answerTokenA = await guestA.buildAnswerFromInvite(inviteTokenA)
    store.setAnswerInput(answerTokenA)
    store.queueApplyAnswer()
    await waitForCondition(() => {
      const peers = useP2PCollaborationStore.getState().peers
      return Boolean(guestA.channel?.readyState === 'open') && peers.some(peer => peer.peerId === 'guest-a' && peer.connectionState === 'connected')
    })

    store.queueStartHost()
    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'host' && next.phase === 'awaiting-answer' && Boolean(next.inviteToken) && next.inviteToken !== inviteTokenA
    })

    const guestB = new FakeGuestPeer({ peerId: 'guest-b', displayName: 'Guest B' })
    const inviteTokenB = String(useP2PCollaborationStore.getState().inviteToken || '')
    const answerTokenB = await guestB.buildAnswerFromInvite(inviteTokenB)
    store.setAnswerInput(answerTokenB)
    store.queueApplyAnswer()
    await waitForCondition(() => {
      const peers = useP2PCollaborationStore.getState().peers
      return Boolean(guestB.channel?.readyState === 'open') && peers.filter(peer => peer.connectionState === 'connected').length >= 3
    })

    await waitForCondition(() => {
      return guestA.receivedMessages.some(message => message.kind === 'session-roster' && message.peers.length === 3)
        && guestB.receivedMessages.some(message => message.kind === 'session-roster' && message.peers.length === 3)
    })

    const sessionId = String(useP2PCollaborationStore.getState().sessionId || '')
    guestA.sendMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'presence',
      sessionId,
      peerId: 'guest-a',
      displayName: 'Guest A',
      documentKey: '/docs/relay.md',
      caretLine: 7,
      ownership: 'guest',
      sentAt: 1,
    })

    await waitForCondition(() => {
      const guestBHasPresence = guestB.receivedMessages.some(
        message => message.kind === 'presence' && message.peerId === 'guest-a' && message.caretLine === 7,
      )
      const hostStoreUpdated = useP2PCollaborationStore.getState().peers.some(
        peer => peer.peerId === 'guest-a' && peer.caretLine === 7,
      )
      return guestBHasPresence && hostStoreUpdated
    })

    guestA.sendMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'document-sync',
      sessionId,
      peerId: 'guest-a',
      documentKey: '/docs/relay.md',
      text: '# Guest A update\n',
      textHash: 'hash-guest-a',
      sentAt: 2,
    })

    await waitForCondition(() => {
      const hostApplied = applyRemoteDocumentCalls.some(
        call => call.documentKey === '/docs/relay.md' && call.text === '# Guest A update\n',
      )
      const guestBReceivedRelay = guestB.receivedMessages.some(
        message => message.kind === 'document-sync' && message.peerId === 'guest-a' && message.text === '# Guest A update\n',
      )
      return hostApplied && guestBReceivedRelay
    })
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    MockRTCPeerConnection.reset()
    ;(dom.window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousWindowRtc
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = previousGlobalRtc
    restoreDom()
    restoreWindow()
  }
}

export async function testP2PCollaborationRuntimeRemovesDisconnectedPeerAndClearsFollowTarget() {
  resetCollaborationStore()
  MockRTCPeerConnection.reset()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const previousWindowRtc = (dom.window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection
  const previousGlobalRtc = (globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection
  const applyRemoteDocumentCalls: Array<{ documentKey: string; text: string }> = []
  const revealRemoteLines: number[] = []

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      RTCPeerConnection?: unknown
    }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    anyWindow.RTCPeerConnection = MockRTCPeerConnection
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection

    useGraphStore.getState().resetAll()
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(
      root,
      React.createElement(CollaborationRuntimeHarness, {
        activeText: '# Host draft\n',
        applyRemoteDocumentCalls,
        revealRemoteLines,
      }),
      { window: dom.window, frames: 4 },
    )

    const store = useP2PCollaborationStore.getState()
    store.queueStartHost()
    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'host' && next.phase === 'awaiting-answer' && Boolean(next.inviteToken)
    })

    const guest = new FakeGuestPeer({ peerId: 'guest-disconnect', displayName: 'Guest Disconnect' })
    const inviteToken = String(useP2PCollaborationStore.getState().inviteToken || '')
    const answerToken = await guest.buildAnswerFromInvite(inviteToken)
    store.setAnswerInput(answerToken)
    store.queueApplyAnswer()
    await waitForCondition(() => {
      const peers = useP2PCollaborationStore.getState().peers
      return Boolean(guest.channel?.readyState === 'open') && peers.some(peer => peer.peerId === 'guest-disconnect' && peer.connectionState === 'connected')
    })

    store.setFollowModeEnabled(true)
    store.setFollowPeerId('guest-disconnect')
    await waitForCondition(() => useP2PCollaborationStore.getState().followPeerId === 'guest-disconnect')

    guest.disconnect()

    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return !next.peers.some(peer => peer.peerId === 'guest-disconnect') && next.followPeerId === null
    })

    const next = useP2PCollaborationStore.getState()
    if (next.statusText !== 'Guest Disconnect disconnected') {
      throw new Error(`expected host status to reflect disconnect, got "${next.statusText}"`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    MockRTCPeerConnection.reset()
    ;(dom.window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousWindowRtc
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = previousGlobalRtc
    restoreDom()
    restoreWindow()
  }
}

export async function testP2PCollaborationRuntimeFollowModeRevealsOnlyTargetedPeer() {
  resetCollaborationStore()
  MockRTCPeerConnection.reset()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const previousWindowRtc = (dom.window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection
  const previousGlobalRtc = (globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection
  const applyRemoteDocumentCalls: Array<{ documentKey: string; text: string }> = []
  const revealRemoteLines: number[] = []

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
      RTCPeerConnection?: unknown
    }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    anyWindow.RTCPeerConnection = MockRTCPeerConnection
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection

    useGraphStore.getState().resetAll()
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(
      root,
      React.createElement(CollaborationRuntimeHarness, {
        activeText: '# Host draft\n',
        applyRemoteDocumentCalls,
        revealRemoteLines,
      }),
      { window: dom.window, frames: 4 },
    )

    const store = useP2PCollaborationStore.getState()
    store.queueStartHost()
    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'host' && next.phase === 'awaiting-answer' && Boolean(next.inviteToken)
    })

    const guestA = new FakeGuestPeer({ peerId: 'guest-follow-a', displayName: 'Guest Follow A' })
    const inviteTokenA = String(useP2PCollaborationStore.getState().inviteToken || '')
    const answerTokenA = await guestA.buildAnswerFromInvite(inviteTokenA)
    store.setAnswerInput(answerTokenA)
    store.queueApplyAnswer()
    await waitForCondition(() => Boolean(guestA.channel?.readyState === 'open'))

    store.queueStartHost()
    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.phase === 'awaiting-answer' && Boolean(next.inviteToken) && next.inviteToken !== inviteTokenA
    })

    const guestB = new FakeGuestPeer({ peerId: 'guest-follow-b', displayName: 'Guest Follow B' })
    const inviteTokenB = String(useP2PCollaborationStore.getState().inviteToken || '')
    const answerTokenB = await guestB.buildAnswerFromInvite(inviteTokenB)
    store.setAnswerInput(answerTokenB)
    store.queueApplyAnswer()
    await waitForCondition(() => Boolean(guestB.channel?.readyState === 'open'))

    const sessionId = String(useP2PCollaborationStore.getState().sessionId || '')
    store.setFollowModeEnabled(true)
    store.setFollowPeerId('guest-follow-b')
    await waitForCondition(() => useP2PCollaborationStore.getState().followPeerId === 'guest-follow-b')

    guestA.sendMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'presence',
      sessionId,
      peerId: 'guest-follow-a',
      displayName: 'Guest Follow A',
      documentKey: '/docs/relay.md',
      caretLine: 11,
      ownership: 'guest',
      sentAt: 11,
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    if (revealRemoteLines.length !== 0) {
      throw new Error(`expected no reveal for untargeted peer, got ${revealRemoteLines.join(',')}`)
    }

    guestB.sendMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'presence',
      sessionId,
      peerId: 'guest-follow-b',
      displayName: 'Guest Follow B',
      documentKey: '/docs/relay.md',
      caretLine: 23,
      ownership: 'guest',
      sentAt: 12,
    })

    await waitForCondition(() => revealRemoteLines.includes(23))
    const revealRemoteLinesAfterTarget = Array.from(revealRemoteLines)
    const targetedRevealLines = revealRemoteLinesAfterTarget.filter(line => line === 23)
    if (targetedRevealLines.length !== 1 || revealRemoteLinesAfterTarget.length !== 1) {
      throw new Error(`expected exactly one targeted reveal, got ${revealRemoteLines.join(',')}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    MockRTCPeerConnection.reset()
    ;(dom.window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousWindowRtc
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = previousGlobalRtc
    restoreDom()
    restoreWindow()
  }
}

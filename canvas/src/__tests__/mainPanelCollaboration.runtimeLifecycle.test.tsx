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

export async function testP2PCollaborationRuntimeOwnerRemovalKeepsSessionAliveAndBroadcastsRoster() {
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

    const guestA = new FakeGuestPeer({ peerId: 'guest-owner-remove-a', displayName: 'Guest Remove A' })
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

    const guestB = new FakeGuestPeer({ peerId: 'guest-owner-remove-b', displayName: 'Guest Remove B' })
    const inviteTokenB = String(useP2PCollaborationStore.getState().inviteToken || '')
    const answerTokenB = await guestB.buildAnswerFromInvite(inviteTokenB)
    store.setAnswerInput(answerTokenB)
    store.queueApplyAnswer()
    await waitForCondition(() => {
      const peers = useP2PCollaborationStore.getState().peers
      return Boolean(guestB.channel?.readyState === 'open') && peers.filter(peer => peer.connectionState === 'connected').length >= 3
    })

    store.queueRemovePeer('guest-owner-remove-a')

    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return !next.peers.some(peer => peer.peerId === 'guest-owner-remove-a')
        && next.peers.some(peer => peer.peerId === 'guest-owner-remove-b' && peer.connectionState === 'connected')
    })

    await waitForCondition(() => {
      return guestB.receivedMessages.some(
        message => message.kind === 'session-roster'
          && !message.peers.some(peer => peer.peerId === 'guest-owner-remove-a')
          && message.peers.some(peer => peer.peerId === 'guest-owner-remove-b'),
      )
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    const guestAStillReceiving = guestA.receivedMessages.some(
      message => message.kind === 'session-roster'
        && !message.peers.some(peer => peer.peerId === 'guest-owner-remove-a')
        && message.peers.some(peer => peer.peerId === 'guest-owner-remove-b'),
    )
    if (guestAStillReceiving) {
      throw new Error('expected removed guest channel to stop receiving roster broadcasts')
    }

    const next = useP2PCollaborationStore.getState()
    if (next.statusText !== 'Removed Guest Remove A') {
      throw new Error(`expected owner removal status, got "${next.statusText}"`)
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

export async function testP2PCollaborationRuntimeGuestResetsWhenOwnerDisconnects() {
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
        activeText: '# Guest draft\n',
        applyRemoteDocumentCalls,
        revealRemoteLines,
      }),
      { window: dom.window, frames: 4 },
    )

    const host = new FakeHostPeer({ peerId: 'owner-host-disconnect', displayName: 'Host Owner' })
    const inviteToken = await host.buildInvite('/docs/relay.md')
    const store = useP2PCollaborationStore.getState()
    store.setInviteInput(inviteToken)
    store.queueJoinInvite()

    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'guest' && next.phase === 'awaiting-host' && Boolean(next.answerToken)
    })

    const answerToken = String(useP2PCollaborationStore.getState().answerToken || '')
    await host.applyGuestAnswer(answerToken)

    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'guest'
        && next.phase === 'connected'
        && next.peers.some(peer => peer.peerId === 'owner-host-disconnect' && peer.connectionState === 'connected')
    })

    store.setFollowModeEnabled(true)
    store.setFollowPeerId('owner-host-disconnect')
    await waitForCondition(() => useP2PCollaborationStore.getState().followPeerId === 'owner-host-disconnect')

    host.disconnect()

    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'idle'
        && next.phase === 'idle'
        && next.statusText === 'Session owner disconnected'
        && next.peers.length === 0
        && next.followPeerId === null
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

export async function testP2PCollaborationRuntimePreservesPendingHostInviteAcrossRemount() {
  resetCollaborationStore()
  MockRTCPeerConnection.reset()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { RTCPeerConnection?: unknown; requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)
    anyWindow.RTCPeerConnection = MockRTCPeerConnection
    ;(globalThis as typeof globalThis & { RTCPeerConnection?: unknown }).RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection

    useGraphStore.getState().resetAll()
    const doc = dom.window.document
    const container = doc.createElement('section')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const applyRemoteDocumentCalls: Array<{ documentKey: string; text: string }> = []
    const revealRemoteLines: number[] = []

    await mountReactRoot(
      root,
      React.createElement(CollaborationRuntimeHarness, {
        activeText: '# Host remount',
        applyRemoteDocumentCalls,
        revealRemoteLines,
      }),
      { window: dom.window, frames: 6 },
    )

    const store = useP2PCollaborationStore.getState()
    store.queueStartHost()
    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'host' && next.phase === 'awaiting-answer' && String(next.inviteToken || '').length > 0
    })

    const beforeUnmount = useP2PCollaborationStore.getState()
    const inviteToken = String(beforeUnmount.inviteToken || '')
    if (!inviteToken) throw new Error('expected host invite token before remount')

    await unmountReactRoot(root, { window: dom.window })
    root = createRoot(container as unknown as HTMLElement)

    await mountReactRoot(
      root,
      React.createElement(CollaborationRuntimeHarness, {
        activeText: '# Host remount',
        applyRemoteDocumentCalls,
        revealRemoteLines,
      }),
      { window: dom.window, frames: 6 },
    )

    const guest = new FakeGuestPeer({ peerId: 'guest-remount', displayName: 'Guest Remount' })
    const answerToken = await guest.buildAnswerFromInvite(inviteToken)
    useP2PCollaborationStore.getState().setAnswerInput(answerToken)
    useP2PCollaborationStore.getState().queueApplyAnswer()

    await waitForCondition(() => {
      const next = useP2PCollaborationStore.getState()
      return next.role === 'host'
        && (next.phase === 'connecting' || next.phase === 'connected')
        && next.peers.some(peer => peer.peerId === 'guest-remount')
    })
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    MockRTCPeerConnection.reset()
    restoreDom()
    restoreWindow()
  }
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import CollaborationView from '@/features/panels/views/CollaborationView'
import {
  encodeP2PAnswerPayload,
  encodeP2PInvitePayload,
  parseP2PCollaborationWireMessage,
  parseP2PAnswerInput,
  parseP2PInviteInput,
  P2P_COLLAB_PROTOCOL_VERSION,
  type P2PCollaborationWireMessage,
} from '@/features/collaboration/p2pCollaborationProtocol'
import { useP2PCollaborationStore, type P2PCollaborationRemotePeer } from '@/features/collaboration/p2pCollaborationStore'
import { __resetP2PCollaborationRuntimeForTests, useP2PCollaborationRuntime } from '@/features/collaboration/useP2PCollaborationRuntime'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { installDeterministicRaf, mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'

function makePeer(args: Partial<P2PCollaborationRemotePeer> & Pick<P2PCollaborationRemotePeer, 'peerId' | 'displayName'>): P2PCollaborationRemotePeer {
  return {
    peerId: args.peerId,
    displayName: args.displayName,
    documentKey: args.documentKey || '/docs/demo.md',
    caretLine: args.caretLine ?? null,
    connectedAt: args.connectedAt || 100,
    lastSeenAt: args.lastSeenAt || 100,
    ownership: args.ownership || 'guest',
    isLocal: args.isLocal ?? false,
    connectionState: args.connectionState || 'connected',
  }
}

function resetCollaborationStore(): void {
  __resetP2PCollaborationRuntimeForTests()
  const store = useP2PCollaborationStore.getState()
  store.resetSession('Idle')
  store.replacePeers([])
  store.setFollowModeEnabled(false)
  store.setFollowPeerId(null)
  store.setInviteInput('')
  store.setAnswerInput('')
}

function assertIncludes(text: string, expected: string): void {
  if (!text.includes(expected)) {
    throw new Error(`expected text to include "${expected}"`)
  }
}

async function waitForCondition(predicate: () => boolean, timeoutMs: number = 1500, stepMs: number = 10): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('timed out waiting for condition')
    }
    await new Promise(resolve => setTimeout(resolve, stepMs))
  }
}

function parseConnectionIdFromSdp(sdp: string): string {
  try {
    const parsed = JSON.parse(String(sdp || '')) as { connectionId?: unknown }
    const connectionId = typeof parsed.connectionId === 'string' ? parsed.connectionId.trim() : ''
    if (!connectionId) throw new Error('missing connection id')
    return connectionId
  } catch {
    throw new Error('expected mock sdp to encode a connection id')
  }
}

type MockMessageEvent = { data: string }
type MockDataChannelEvent = { channel: MockRTCDataChannel }

class MockRTCDataChannel {
  label: string
  readyState: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting'
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MockMessageEvent) => void) | null = null
  partner: MockRTCDataChannel | null = null

  constructor(label: string) {
    this.label = label
  }

  send(data: string): void {
    if (this.readyState !== 'open' || !this.partner) {
      throw new Error('mock data channel is not open')
    }
    const target = this.partner
    setTimeout(() => {
      target.onmessage?.({ data })
    }, 0)
  }

  close(): void {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'
    const partner = this.partner
    this.partner = null
    this.onclose?.()
    if (partner) {
      partner.partner = null
      if (partner.readyState !== 'closed') {
        partner.readyState = 'closed'
        partner.onclose?.()
      }
    }
  }

  open(): void {
    if (this.readyState === 'open') return
    this.readyState = 'open'
    this.onopen?.()
  }
}

class MockRTCPeerConnection {
  static sequence = 0
  static registry = new Map<string, MockRTCPeerConnection>()

  static reset(): void {
    MockRTCPeerConnection.sequence = 0
    MockRTCPeerConnection.registry.clear()
  }

  readonly id: string
  iceGatheringState: RTCIceGatheringState = 'new'
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  remoteDescription: RTCSessionDescriptionInit | null = null
  ondatachannel: ((event: MockDataChannelEvent) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  private listeners = new Map<string, Set<() => void>>()
  private outboundChannels: MockRTCDataChannel[] = []

  constructor(_config?: RTCConfiguration) {
    this.id = `mock-rtc-${++MockRTCPeerConnection.sequence}`
    MockRTCPeerConnection.registry.set(this.id, this)
  }

  addEventListener(type: string, handler: () => void): void {
    const bucket = this.listeners.get(type) || new Set<() => void>()
    bucket.add(handler)
    this.listeners.set(type, bucket)
  }

  removeEventListener(type: string, handler: () => void): void {
    const bucket = this.listeners.get(type)
    bucket?.delete(handler)
  }

  private dispatch(type: string): void {
    const bucket = this.listeners.get(type)
    bucket?.forEach(handler => handler())
  }

  createDataChannel(label: string): RTCDataChannel {
    const channel = new MockRTCDataChannel(label)
    this.outboundChannels.push(channel)
    return channel as unknown as RTCDataChannel
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: JSON.stringify({ connectionId: this.id }) }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: JSON.stringify({ connectionId: this.id }) }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description
    this.iceGatheringState = 'gathering'
    setTimeout(() => {
      this.iceGatheringState = 'complete'
      this.dispatch('icegatheringstatechange')
    }, 0)
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description
    if (description.type !== 'answer') return
    const remoteConnectionId = parseConnectionIdFromSdp(String(description.sdp || ''))
    const remote = MockRTCPeerConnection.registry.get(remoteConnectionId)
    if (!remote) throw new Error('expected remote mock connection to exist')
    const localChannel = this.outboundChannels[0]
    if (!localChannel) throw new Error('expected host outbound channel to exist')
    const remoteChannel = new MockRTCDataChannel(localChannel.label)
    localChannel.partner = remoteChannel
    remoteChannel.partner = localChannel
    remote.ondatachannel?.({ channel: remoteChannel })
    setTimeout(() => {
      this.connectionState = 'connected'
      remote.connectionState = 'connected'
      this.onconnectionstatechange?.()
      remote.onconnectionstatechange?.()
      localChannel.open()
      remoteChannel.open()
    }, 0)
  }

  close(): void {
    this.connectionState = 'closed'
    this.onconnectionstatechange?.()
    this.outboundChannels.forEach(channel => channel.close())
    MockRTCPeerConnection.registry.delete(this.id)
  }
}

class FakeGuestPeer {
  readonly peerId: string
  readonly displayName: string
  readonly connection: MockRTCPeerConnection
  channel: MockRTCDataChannel | null = null
  readonly receivedMessages: P2PCollaborationWireMessage[] = []

  constructor(args: { peerId: string; displayName: string }) {
    this.peerId = args.peerId
    this.displayName = args.displayName
    this.connection = new MockRTCPeerConnection()
    this.connection.ondatachannel = event => {
      this.channel = event.channel
      this.channel.onmessage = messageEvent => {
        const parsed = parseP2PCollaborationWireMessage(String(messageEvent.data || ''))
        if (parsed) this.receivedMessages.push(parsed)
      }
    }
  }

  async buildAnswerFromInvite(inviteToken: string): Promise<string> {
    const invite = parseP2PInviteInput(inviteToken)
    await this.connection.setRemoteDescription(invite.offer)
    const answer = await this.connection.createAnswer()
    await this.connection.setLocalDescription(answer)
    const localDescription = this.connection.localDescription
    if (!localDescription) throw new Error('expected guest local description')
    return encodeP2PAnswerPayload({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'answer',
      inviteId: invite.inviteId,
      sessionId: invite.sessionId,
      ownerPeerId: invite.ownerPeerId,
      guestPeerId: this.peerId,
      guestDisplayName: this.displayName,
      answer: localDescription,
      createdAt: Date.now(),
    })
  }

  sendMessage(message: P2PCollaborationWireMessage): void {
    if (!this.channel || this.channel.readyState !== 'open') {
      throw new Error(`expected open channel for ${this.displayName}`)
    }
    this.channel.send(JSON.stringify(message))
  }

  disconnect(): void {
    this.channel?.close()
  }
}

class FakeHostPeer {
  readonly peerId: string
  readonly displayName: string
  readonly sessionId: string
  readonly connection: MockRTCPeerConnection
  channel: MockRTCDataChannel | null = null
  readonly receivedMessages: P2PCollaborationWireMessage[] = []

  constructor(args: { peerId: string; displayName: string; sessionId?: string }) {
    this.peerId = args.peerId
    this.displayName = args.displayName
    this.sessionId = args.sessionId || 'session-host-disconnect'
    this.connection = new MockRTCPeerConnection()
    this.channel = this.connection.createDataChannel('kg-collab') as unknown as MockRTCDataChannel
    this.channel.onmessage = messageEvent => {
      const parsed = parseP2PCollaborationWireMessage(String(messageEvent.data || ''))
      if (parsed) this.receivedMessages.push(parsed)
    }
  }

  async buildInvite(documentKey: string): Promise<string> {
    const offer = await this.connection.createOffer()
    await this.connection.setLocalDescription(offer)
    const localDescription = this.connection.localDescription
    if (!localDescription) throw new Error('expected host local description')
    return encodeP2PInvitePayload({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'invite',
      inviteId: 'invite-host-disconnect',
      sessionId: this.sessionId,
      ownerPeerId: this.peerId,
      hostPeerId: this.peerId,
      hostDisplayName: this.displayName,
      documentKey,
      offer: localDescription,
      createdAt: Date.now(),
    })
  }

  async applyGuestAnswer(answerToken: string): Promise<void> {
    const answer = parseP2PAnswerInput(answerToken)
    await this.connection.setRemoteDescription(answer.answer)
    await waitForCondition(() => Boolean(this.channel?.readyState === 'open'))
  }

  disconnect(): void {
    this.channel?.close()
  }
}

function CollaborationRuntimeHarness(props: {
  activeText: string
  applyRemoteDocumentCalls: Array<{ documentKey: string; text: string }>
  revealRemoteLines: number[]
}): React.ReactElement | null {
  useP2PCollaborationRuntime({
    active: true,
    activeDocumentKey: '/docs/relay.md',
    activeText: props.activeText,
    applyRemoteDocument: ({ documentKey, text }) => {
      props.applyRemoteDocumentCalls.push({ documentKey, text })
    },
    revealRemoteLine: line => {
      props.revealRemoteLines.push(line)
    },
  })
  return null
}

function CollaborationRegisterActionsHarness(props: {
  metrics: { registerCalls: number }
}): React.ReactElement {
  const [, setSharedActions] = React.useState<{
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  } | null>(null)
  return (
    <CollaborationView
      searchQuery=""
      onRegisterActions={next => {
        props.metrics.registerCalls += 1
        setSharedActions(prev => (prev === next ? prev : next))
      }}
    />
  )
}

export async function testP2PCollaborationProtocolPreservesOwnerInviteAndRosterMetadata() {
  const inviteToken = encodeP2PInvitePayload({
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'invite',
    inviteId: 'invite-01',
    sessionId: 'session-01',
    ownerPeerId: 'owner-01',
    hostPeerId: 'owner-01',
    hostDisplayName: 'Session Owner',
    documentKey: '/docs/roadmap.md',
    offer: { type: 'offer', sdp: 'offer-sdp' },
    createdAt: 111,
  })
  const invitePayload = parseP2PInviteInput(inviteToken)
  if (invitePayload.inviteId !== 'invite-01') throw new Error('expected invite id to round-trip')
  if (invitePayload.ownerPeerId !== 'owner-01') throw new Error('expected owner peer id to round-trip')
  if (invitePayload.documentKey !== '/docs/roadmap.md') throw new Error('expected invite document key to round-trip')

  const answerToken = encodeP2PAnswerPayload({
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'answer',
    inviteId: 'invite-01',
    sessionId: 'session-01',
    ownerPeerId: 'owner-01',
    guestPeerId: 'guest-02',
    guestDisplayName: 'Guest Two',
    answer: { type: 'answer', sdp: 'answer-sdp' },
    createdAt: 222,
  })
  const answerPayload = parseP2PAnswerInput(answerToken)
  if (answerPayload.inviteId !== 'invite-01') throw new Error('expected answer invite id to round-trip')
  if (answerPayload.ownerPeerId !== 'owner-01') throw new Error('expected answer owner id to round-trip')
  if (answerPayload.guestPeerId !== 'guest-02') throw new Error('expected guest peer id to round-trip')

  const rosterMessage: P2PCollaborationWireMessage = {
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'session-roster',
    sessionId: 'session-01',
    ownerPeerId: 'owner-01',
    peers: [
      {
        peerId: 'owner-01',
        displayName: 'Session Owner',
        documentKey: '/docs/roadmap.md',
        caretLine: 4,
        connectedAt: 100,
        lastSeenAt: 120,
        ownership: 'owner',
      },
      {
        peerId: 'guest-02',
        displayName: 'Guest Two',
        documentKey: '/docs/roadmap.md',
        caretLine: 8,
        connectedAt: 110,
        lastSeenAt: 130,
        ownership: 'guest',
      },
    ],
    sentAt: 333,
  }
  const parsedRoster = parseP2PCollaborationWireMessage(JSON.stringify(rosterMessage))
  if (!parsedRoster || parsedRoster.kind !== 'session-roster') {
    throw new Error('expected session roster wire message to parse')
  }
  if (parsedRoster.ownerPeerId !== 'owner-01') throw new Error('expected roster owner to round-trip')
  if (parsedRoster.peers.length !== 2) throw new Error('expected roster peers to round-trip')
  if (parsedRoster.peers[0]?.ownership !== 'owner') throw new Error('expected owner snapshot to round-trip')
  if (parsedRoster.peers[1]?.ownership !== 'guest') throw new Error('expected guest snapshot to round-trip')
}

export async function testP2PCollaborationStoreScopesFollowTargetToLiveRemotePeers() {
  resetCollaborationStore()
  const store = useP2PCollaborationStore.getState()
  store.setSessionState({
    role: 'host',
    phase: 'connected',
    sessionId: 'session-keep',
    localPeerId: 'owner-01',
    ownerPeerId: 'owner-01',
    statusText: 'Connected peers: 2',
  })
  store.replacePeers([
    makePeer({ peerId: 'owner-01', displayName: 'Owner Local', ownership: 'owner', isLocal: true }),
    makePeer({ peerId: 'guest-a', displayName: 'Guest A', ownership: 'guest' }),
    makePeer({ peerId: 'guest-b', displayName: 'Guest B', ownership: 'guest' }),
  ])
  store.setFollowPeerId('guest-a')
  if (useP2PCollaborationStore.getState().followPeerId !== 'guest-a') {
    throw new Error('expected follow target to accept a live remote peer')
  }

  store.removePeer('guest-a')
  if (useP2PCollaborationStore.getState().followPeerId !== null) {
    throw new Error('expected follow target to clear when the tracked peer leaves')
  }

  store.setFollowPeerId('owner-01')
  if (useP2PCollaborationStore.getState().followPeerId !== null) {
    throw new Error('expected follow target to reject the local peer')
  }

  store.replacePeers([
    makePeer({ peerId: 'owner-01', displayName: 'Owner Local', ownership: 'owner', isLocal: true }),
    makePeer({ peerId: 'guest-b', displayName: 'Guest B', ownership: 'guest' }),
  ])
  store.setFollowPeerId('guest-b')
  if (useP2PCollaborationStore.getState().followPeerId !== 'guest-b') {
    throw new Error('expected follow target to move to the surviving remote peer')
  }

  resetCollaborationStore()
}

export async function testMainPanelCollaborationViewRendersPeerOwnershipRoster() {
  resetCollaborationStore()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()
    const store = useP2PCollaborationStore.getState()
    store.setSessionState({
      role: 'guest',
      phase: 'connected',
      sessionId: 'session-roster',
      localPeerId: 'guest-local-01',
      ownerPeerId: 'owner-remote-01',
      statusText: 'Peers in session: 3',
    })
    store.setFollowModeEnabled(true)
    store.replacePeers([
      makePeer({ peerId: 'guest-local-01', displayName: 'Local Guest', ownership: 'guest', isLocal: true }),
      makePeer({ peerId: 'owner-remote-01', displayName: 'Session Owner', ownership: 'owner' }),
      makePeer({ peerId: 'guest-remote-02', displayName: 'Remote Guest', ownership: 'guest' }),
    ])
    store.setFollowPeerId('guest-remote-02')

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(root, React.createElement(CollaborationView, { searchQuery: '' }), { window: dom.window, frames: 3 })

    const text = container.textContent || ''
    assertIncludes(text, 'Session Owner')
    assertIncludes(text, 'Remote Guest')
    assertIncludes(text, 'Peers')
    assertIncludes(text, 'Owner')
    assertIncludes(text, 'You')
    assertIncludes(text, 'Guest')
    assertIncludes(text, 'connected')
    assertIncludes(text, 'total 3')
    assertIncludes(text, 'remote 2')
    assertIncludes(text, 'Target guest-re')
    assertIncludes(text, 'Follow')
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelCollaborationViewShowsRemoveActionOnlyForOwnerGuestRows() {
  resetCollaborationStore()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()
    const store = useP2PCollaborationStore.getState()
    store.setSessionState({
      role: 'host',
      phase: 'connected',
      sessionId: 'session-owner-remove',
      localPeerId: 'owner-local-01',
      ownerPeerId: 'owner-local-01',
      statusText: 'Connected peers: 2',
    })
    store.replacePeers([
      makePeer({ peerId: 'owner-local-01', displayName: 'Owner Local', ownership: 'owner', isLocal: true }),
      makePeer({ peerId: 'guest-removable-01', displayName: 'Guest Removable', ownership: 'guest' }),
      makePeer({ peerId: 'guest-removable-02', displayName: 'Guest Removable Two', ownership: 'guest' }),
    ])

    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(root, React.createElement(CollaborationView, { searchQuery: '' }), { window: dom.window, frames: 3 })

    const text = container.textContent || ''
    assertIncludes(text, 'Guest Removable')
    assertIncludes(text, 'Remove')

    const buttons = Array.from(container.querySelectorAll('button'))
      .map(button => (button.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const removeButtons = buttons.filter(label => label.includes('Remove'))
    if (removeButtons.length !== 2) {
      throw new Error(`expected exactly two owner remove buttons for guest rows, got ${removeButtons.length}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    restoreDom()
    restoreWindow()
  }
}

export async function testMainPanelCollaborationViewStabilizesRegisteredActions() {
  resetCollaborationStore()
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  const metrics = { registerCalls: 0 }

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    useGraphStore.getState().resetAll()
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    await mountReactRoot(
      root,
      React.createElement(CollaborationRegisterActionsHarness, { metrics }),
      { window: dom.window, frames: 6 },
    )

    await new Promise(resolve => setTimeout(resolve, 30))
    if (metrics.registerCalls > 3) {
      throw new Error(`expected collaboration action registration to stabilize, got ${metrics.registerCalls} calls`)
    }
    assertIncludes(container.textContent || '', 'Host Session')
  } finally {
    await unmountReactRoot(root, { window: dom.window })
    resetCollaborationStore()
    restoreDom()
    restoreWindow()
  }
}

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
    const container = dom.window.document.createElement('div')
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
    const container = dom.window.document.createElement('div')
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
    const container = dom.window.document.createElement('div')
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
    if (revealRemoteLines.length !== 1) {
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
    const container = dom.window.document.createElement('div')
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
    const container = dom.window.document.createElement('div')
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
    const container = doc.createElement('div')
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

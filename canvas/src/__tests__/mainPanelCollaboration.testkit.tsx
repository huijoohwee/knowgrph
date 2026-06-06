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

export function makePeer(args: Partial<P2PCollaborationRemotePeer> & Pick<P2PCollaborationRemotePeer, 'peerId' | 'displayName'>): P2PCollaborationRemotePeer {
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

export function resetCollaborationStore(): void {
  __resetP2PCollaborationRuntimeForTests()
  const store = useP2PCollaborationStore.getState()
  store.resetSession('Idle')
  store.replacePeers([])
  store.setFollowModeEnabled(false)
  store.setFollowPeerId(null)
  store.setInviteInput('')
  store.setAnswerInput('')
}

export function assertIncludes(text: string, expected: string): void {
  if (!text.includes(expected)) {
    throw new Error(`expected text to include "${expected}"`)
  }
}

export async function waitForCondition(predicate: () => boolean, timeoutMs: number = 1500, stepMs: number = 10): Promise<void> {
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

export class MockRTCDataChannel {
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

export class MockRTCPeerConnection {
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

export class FakeGuestPeer {
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

export class FakeHostPeer {
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

export function CollaborationRuntimeHarness(props: {
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

export function CollaborationRegisterActionsHarness(props: {
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


import React from 'react'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import {
  buildP2PInviteUrl,
  encodeP2PAnswerPayload,
  encodeP2PInvitePayload,
  parseP2PAnswerInput,
  parseP2PCollaborationWireMessage,
  parseP2PInviteInput,
  readP2PInviteTokenFromLocation,
  P2P_COLLAB_PROTOCOL_VERSION,
  type P2PCollaborationPeerSnapshot,
  type P2PCollaborationRole,
  type P2PCollaborationWireMessage,
  type P2PCollaborationWirePeerRole,
} from './p2pCollaborationProtocol'
import { useP2PCollaborationStore, type P2PCollaborationRemotePeer } from './p2pCollaborationStore'

type UseP2PCollaborationRuntimeArgs = {
  active: boolean
  activeDocumentKey: string
  activeText: string
  applyRemoteDocument: (args: { documentKey: string; text: string }) => Promise<void> | void
  revealRemoteLine: (line: number) => void
}

type RuntimeConnectionRef = {
  inviteId: string | null
  peerId: string | null
  displayName: string
  ownership: P2PCollaborationWirePeerRole
  connection: RTCPeerConnection
  channel: RTCDataChannel | null
  connectedAt: number
  lastSeenAt: number
}

type RuntimeSessionRefs = {
  role: P2PCollaborationRole
  sessionId: string | null
  localPeerId: string | null
  ownerPeerId: string | null
  localConnectedAt: number | null
  guestConnection: RuntimeConnectionRef | null
  pendingHostInvite: RuntimeConnectionRef | null
  hostConnectionsByPeerId: Map<string, RuntimeConnectionRef>
}

type MutableRefValue<T> = { current: T }

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

function createInitialRuntimeSessionRefs(): RuntimeSessionRefs {
  return {
    role: 'idle',
    sessionId: null,
    localPeerId: null,
    ownerPeerId: null,
    localConnectedAt: null,
    guestConnection: null,
    pendingHostInvite: null,
    hostConnectionsByPeerId: new Map<string, RuntimeConnectionRef>(),
  }
}

function resetRuntimeSessionRefs(runtime: RuntimeSessionRefs): void {
  closeConnectionRef(runtime.guestConnection, { suppressEvents: true })
  closeConnectionRef(runtime.pendingHostInvite, { suppressEvents: true })
  runtime.hostConnectionsByPeerId.forEach(connectionRef => closeConnectionRef(connectionRef, { suppressEvents: true }))
  runtime.role = 'idle'
  runtime.sessionId = null
  runtime.localPeerId = null
  runtime.ownerPeerId = null
  runtime.localConnectedAt = null
  runtime.guestConnection = null
  runtime.pendingHostInvite = null
  runtime.hostConnectionsByPeerId.clear()
}

const sharedRuntimeRefs: MutableRefValue<RuntimeSessionRefs> = {
  current: createInitialRuntimeSessionRefs(),
}
const sharedLastCommandIdRef: MutableRefValue<number> = { current: 0 }
const sharedCurrentDocumentKeyRef: MutableRefValue<string> = { current: '' }
const sharedCurrentTextRef: MutableRefValue<string> = { current: '' }
const sharedCurrentDisplayNameRef: MutableRefValue<string> = { current: '' }
const sharedCurrentFollowModeRef: MutableRefValue<boolean> = { current: false }
const sharedCurrentFollowPeerIdRef: MutableRefValue<string | null> = { current: null }
const sharedCurrentCaretLineRef: MutableRefValue<number | null> = { current: null }
const sharedSuppressOutboundDocumentSigRef: MutableRefValue<string | null> = { current: null }
const sharedLastOutboundDocumentSigRef: MutableRefValue<string | null> = { current: null }
const sharedLastFollowRevealSigRef: MutableRefValue<string | null> = { current: null }

function resetSharedRuntimeRefs(): void {
  resetRuntimeSessionRefs(sharedRuntimeRefs.current)
  sharedLastCommandIdRef.current = 0
  sharedCurrentDocumentKeyRef.current = ''
  sharedCurrentTextRef.current = ''
  sharedCurrentDisplayNameRef.current = ''
  sharedCurrentFollowModeRef.current = false
  sharedCurrentFollowPeerIdRef.current = null
  sharedCurrentCaretLineRef.current = null
  sharedSuppressOutboundDocumentSigRef.current = null
  sharedLastOutboundDocumentSigRef.current = null
  sharedLastFollowRevealSigRef.current = null
}

export function __resetP2PCollaborationRuntimeForTests(): void {
  resetSharedRuntimeRefs()
}

function supportsWebRtc(): boolean {
  return typeof window !== 'undefined' && typeof window.RTCPeerConnection !== 'undefined'
}

function generatePeerId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `peer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function buildDocumentSignature(documentKey: string, text: string): string {
  const key = String(documentKey || '').trim()
  const hash = hashStringToHexCached(`p2p-collab:${key}`, String(text || ''))
  return `${key}|${hash}`
}

function waitForIceGatheringComplete(connection: RTCPeerConnection, timeoutMs: number = 2_500): Promise<void> {
  if (connection.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise(resolve => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      try {
        connection.removeEventListener('icegatheringstatechange', handleChange)
      } catch {
        void 0
      }
      resolve()
    }
    const handleChange = () => {
      if (connection.iceGatheringState === 'complete') finish()
    }
    connection.addEventListener('icegatheringstatechange', handleChange)
    window.setTimeout(finish, timeoutMs)
  })
}

function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })
}

function closeConnectionRef(connectionRef: RuntimeConnectionRef | null, options?: { suppressEvents?: boolean }): void {
  if (!connectionRef) return
  if (options?.suppressEvents) {
    try {
      if (connectionRef.channel) {
        connectionRef.channel.onopen = null
        connectionRef.channel.onclose = null
        connectionRef.channel.onerror = null
        connectionRef.channel.onmessage = null
      }
      connectionRef.connection.onconnectionstatechange = null
      connectionRef.connection.ondatachannel = null
    } catch {
      void 0
    }
  }
  try {
    connectionRef.channel?.close()
  } catch {
    void 0
  }
  try {
    connectionRef.connection.close()
  } catch {
    void 0
  }
}

function countConnectedRemotePeers(peers: P2PCollaborationRemotePeer[]): number {
  return peers.filter(peer => !peer.isLocal && peer.connectionState === 'connected').length
}

function buildPeerSummary(peers: P2PCollaborationRemotePeer[]): string {
  const count = countConnectedRemotePeers(peers)
  return count > 0 ? `Connected peers: ${count}` : 'Host ready. Generate an invite.'
}

export function useP2PCollaborationRuntime(args: UseP2PCollaborationRuntimeArgs): {
  onEditorCaretLine: (line: number) => void
} {
  const displayName = useP2PCollaborationStore(s => s.displayName)
  const inviteInput = useP2PCollaborationStore(s => s.inviteInput)
  const answerInput = useP2PCollaborationStore(s => s.answerInput)
  const followModeEnabled = useP2PCollaborationStore(s => s.followModeEnabled)
  const followPeerId = useP2PCollaborationStore(s => s.followPeerId)
  const localCaretLine = useP2PCollaborationStore(s => s.localCaretLine)
  const pendingCommand = useP2PCollaborationStore(s => s.pendingCommand)
  const seedInviteInputFromLocation = useP2PCollaborationStore(s => s.seedInviteInputFromLocation)
  const setLocalCaretLine = useP2PCollaborationStore(s => s.setLocalCaretLine)
  const setSessionState = useP2PCollaborationStore(s => s.setSessionState)
  const upsertPeer = useP2PCollaborationStore(s => s.upsertPeer)
  const replacePeers = useP2PCollaborationStore(s => s.replacePeers)
  const removePeer = useP2PCollaborationStore(s => s.removePeer)
  const setRuntimeStatus = useP2PCollaborationStore(s => s.setRuntimeStatus)
  const setRuntimeError = useP2PCollaborationStore(s => s.setRuntimeError)
  const resetSession = useP2PCollaborationStore(s => s.resetSession)

  const runtimeRefs = sharedRuntimeRefs
  const lastCommandIdRef = sharedLastCommandIdRef
  const currentDocumentKeyRef = sharedCurrentDocumentKeyRef
  const currentTextRef = sharedCurrentTextRef
  const currentDisplayNameRef = sharedCurrentDisplayNameRef
  const currentFollowModeRef = sharedCurrentFollowModeRef
  const currentFollowPeerIdRef = sharedCurrentFollowPeerIdRef
  const currentCaretLineRef = sharedCurrentCaretLineRef
  const suppressOutboundDocumentSigRef = sharedSuppressOutboundDocumentSigRef
  const lastOutboundDocumentSigRef = sharedLastOutboundDocumentSigRef
  const lastFollowRevealSigRef = sharedLastFollowRevealSigRef

  React.useEffect(() => {
    currentDocumentKeyRef.current = String(args.activeDocumentKey || '').trim()
    currentTextRef.current = String(args.activeText || '')
    currentDisplayNameRef.current = String(displayName || '').trim() || 'Peer'
    currentFollowModeRef.current = followModeEnabled
    currentFollowPeerIdRef.current = String(followPeerId || '').trim() || null
    currentCaretLineRef.current = typeof localCaretLine === 'number' && Number.isFinite(localCaretLine)
      ? Math.max(1, Math.floor(localCaretLine))
      : null
  }, [args.activeDocumentKey, args.activeText, displayName, followModeEnabled, followPeerId, localCaretLine])

  const buildLocalOwnership = React.useCallback((): P2PCollaborationWirePeerRole => {
    const runtime = runtimeRefs.current
    return runtime.localPeerId && runtime.localPeerId === runtime.ownerPeerId ? 'owner' : 'guest'
  }, [])

  const buildPeerRecord = React.useCallback((args: {
    peerId: string
    displayName: string
    documentKey?: string
    caretLine?: number | null
    connectedAt?: number
    lastSeenAt?: number
    ownership: P2PCollaborationWirePeerRole
    isLocal: boolean
    connectionState: 'invited' | 'connecting' | 'connected'
  }): P2PCollaborationRemotePeer => {
    return {
      peerId: args.peerId,
      displayName: args.displayName || 'Peer',
      documentKey: String(args.documentKey || ''),
      caretLine: args.caretLine ?? null,
      connectedAt: Number(args.connectedAt || Date.now()),
      lastSeenAt: Number(args.lastSeenAt || Date.now()),
      ownership: args.ownership,
      isLocal: args.isLocal,
      connectionState: args.connectionState,
    }
  }, [])

  const ensureLocalPeer = React.useCallback((connectionState: 'connecting' | 'connected') => {
    const runtime = runtimeRefs.current
    if (!runtime.localPeerId) return
    upsertPeer(buildPeerRecord({
      peerId: runtime.localPeerId,
      displayName: currentDisplayNameRef.current || 'Peer',
      documentKey: currentDocumentKeyRef.current,
      caretLine: currentCaretLineRef.current,
      connectedAt: runtime.localConnectedAt || Date.now(),
      lastSeenAt: Date.now(),
      ownership: buildLocalOwnership(),
      isLocal: true,
      connectionState,
    }))
  }, [buildLocalOwnership, buildPeerRecord, upsertPeer])

  const snapshotFromPeer = React.useCallback((peer: P2PCollaborationRemotePeer): P2PCollaborationPeerSnapshot => {
    return {
      peerId: peer.peerId,
      displayName: peer.displayName,
      documentKey: peer.documentKey,
      caretLine: peer.caretLine,
      connectedAt: peer.connectedAt,
      lastSeenAt: peer.lastSeenAt,
      ownership: peer.ownership,
    }
  }, [])

  const sendWireMessageToConnection = React.useCallback((connectionRef: RuntimeConnectionRef | null, message: P2PCollaborationWireMessage): boolean => {
    const channel = connectionRef?.channel
    if (!channel || channel.readyState !== 'open') return false
    try {
      channel.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }, [])

  const broadcastToGuests = React.useCallback((message: P2PCollaborationWireMessage, excludedPeerId?: string | null) => {
    const runtime = runtimeRefs.current
    for (const [peerId, connectionRef] of runtime.hostConnectionsByPeerId.entries()) {
      if (excludedPeerId && peerId === excludedPeerId) continue
      sendWireMessageToConnection(connectionRef, message)
    }
  }, [sendWireMessageToConnection])

  const broadcastRosterToGuests = React.useCallback(() => {
    const runtime = runtimeRefs.current
    if (runtime.role !== 'host' || !runtime.sessionId || !runtime.ownerPeerId) return
    const peers = useP2PCollaborationStore.getState().peers
      .filter(peer => peer.connectionState === 'connected' || peer.isLocal)
      .map(snapshotFromPeer)
    broadcastToGuests({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'session-roster',
      sessionId: runtime.sessionId,
      ownerPeerId: runtime.ownerPeerId,
      peers,
      sentAt: Date.now(),
    })
  }, [broadcastToGuests, snapshotFromPeer])

  const updateHostStatus = React.useCallback((fallback: string = 'Host ready. Generate an invite.', options?: { forceStatusText?: string }) => {
    const peers = useP2PCollaborationStore.getState().peers
    const connectedCount = countConnectedRemotePeers(peers)
    const forcedStatusText = String(options?.forceStatusText || '').trim()
    setSessionState({
      role: 'host',
      phase: connectedCount > 0 ? 'connected' : 'connected',
      statusText: forcedStatusText || (connectedCount > 0 ? buildPeerSummary(peers) : fallback),
      errorText: '',
    })
  }, [setSessionState])

  const disconnectRuntime = React.useCallback((statusText: string = 'Disconnected') => {
    const runtime = runtimeRefs.current
    resetRuntimeSessionRefs(runtime)
    suppressOutboundDocumentSigRef.current = null
    lastOutboundDocumentSigRef.current = null
    lastFollowRevealSigRef.current = null
    resetSession(statusText)
  }, [resetSession, runtimeRefs])

  const handleHostPeerDisconnect = React.useCallback((peerId: string, statusText: string) => {
    const runtime = runtimeRefs.current
    const connectionRef = runtime.hostConnectionsByPeerId.get(peerId) || null
    if (connectionRef) {
      closeConnectionRef(connectionRef, { suppressEvents: true })
      runtime.hostConnectionsByPeerId.delete(peerId)
    }
    removePeer(peerId)
    broadcastRosterToGuests()
    updateHostStatus(statusText)
  }, [broadcastRosterToGuests, removePeer, updateHostStatus])

  const handleGuestOwnerDisconnect = React.useCallback((statusText: string = 'Session owner disconnected') => {
    disconnectRuntime(statusText)
  }, [disconnectRuntime])

  const removeHostPeerByOwner = React.useCallback((peerId: string) => {
    const normalizedPeerId = String(peerId || '').trim()
    if (!normalizedPeerId) return
    const runtime = runtimeRefs.current
    if (runtime.role !== 'host') return
    const connectionRef = runtime.hostConnectionsByPeerId.get(normalizedPeerId) || null
    if (!connectionRef) {
      removePeer(normalizedPeerId)
      broadcastRosterToGuests()
      updateHostStatus(buildPeerSummary(useP2PCollaborationStore.getState().peers))
      return
    }
    runtime.hostConnectionsByPeerId.delete(normalizedPeerId)
    closeConnectionRef(connectionRef, { suppressEvents: true })
    removePeer(normalizedPeerId)
    broadcastRosterToGuests()
    updateHostStatus('Host ready. Generate an invite.', { forceStatusText: `Removed ${connectionRef.displayName || 'guest'}` })
  }, [broadcastRosterToGuests, removePeer, updateHostStatus])

  const sendHelloToConnection = React.useCallback((connectionRef: RuntimeConnectionRef | null) => {
    const runtime = runtimeRefs.current
    if (!runtime.sessionId || !runtime.localPeerId) return
    sendWireMessageToConnection(connectionRef, {
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'hello',
      sessionId: runtime.sessionId,
      peerId: runtime.localPeerId,
      displayName: currentDisplayNameRef.current || 'Peer',
      documentKey: currentDocumentKeyRef.current,
      caretLine: currentCaretLineRef.current,
      ownership: buildLocalOwnership(),
      sentAt: Date.now(),
    })
  }, [buildLocalOwnership, sendWireMessageToConnection])

  const sendPresenceToConnection = React.useCallback((connectionRef: RuntimeConnectionRef | null) => {
    const runtime = runtimeRefs.current
    if (!runtime.sessionId || !runtime.localPeerId) return
    sendWireMessageToConnection(connectionRef, {
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'presence',
      sessionId: runtime.sessionId,
      peerId: runtime.localPeerId,
      displayName: currentDisplayNameRef.current || 'Peer',
      documentKey: currentDocumentKeyRef.current,
      caretLine: currentCaretLineRef.current,
      ownership: buildLocalOwnership(),
      sentAt: Date.now(),
    })
  }, [buildLocalOwnership, sendWireMessageToConnection])

  const sendDocumentToConnection = React.useCallback((connectionRef: RuntimeConnectionRef | null) => {
    const runtime = runtimeRefs.current
    if (!runtime.sessionId || !runtime.localPeerId) return
    const documentKey = currentDocumentKeyRef.current
    if (!documentKey) return
    const text = currentTextRef.current
    const documentSignature = buildDocumentSignature(documentKey, text)
    lastOutboundDocumentSigRef.current = documentSignature
    sendWireMessageToConnection(connectionRef, {
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'document-sync',
      sessionId: runtime.sessionId,
      peerId: runtime.localPeerId,
      documentKey,
      text,
      textHash: documentSignature.split('|').slice(1).join('|'),
      sentAt: Date.now(),
    })
  }, [sendWireMessageToConnection])

  const broadcastLocalHello = React.useCallback(() => {
    const runtime = runtimeRefs.current
    if (runtime.role === 'guest') {
      sendHelloToConnection(runtime.guestConnection)
      return
    }
    if (runtime.role === 'host') {
      for (const connectionRef of runtime.hostConnectionsByPeerId.values()) {
        sendHelloToConnection(connectionRef)
      }
    }
  }, [sendHelloToConnection])

  const broadcastLocalPresence = React.useCallback(() => {
    const runtime = runtimeRefs.current
    if (runtime.role === 'guest') {
      sendPresenceToConnection(runtime.guestConnection)
      return
    }
    if (runtime.role === 'host') {
      for (const connectionRef of runtime.hostConnectionsByPeerId.values()) {
        sendPresenceToConnection(connectionRef)
      }
    }
  }, [sendPresenceToConnection])

  const broadcastLocalDocument = React.useCallback(() => {
    const runtime = runtimeRefs.current
    if (runtime.role === 'guest') {
      sendDocumentToConnection(runtime.guestConnection)
      return
    }
    if (runtime.role === 'host') {
      for (const connectionRef of runtime.hostConnectionsByPeerId.values()) {
        sendDocumentToConnection(connectionRef)
      }
    }
  }, [sendDocumentToConnection])

  const applyRemoteRoster = React.useCallback((message: Extract<P2PCollaborationWireMessage, { kind: 'session-roster' }>) => {
    const runtime = runtimeRefs.current
    runtime.ownerPeerId = message.ownerPeerId
    const peers = message.peers.map(peer => buildPeerRecord({
      peerId: peer.peerId,
      displayName: peer.displayName,
      documentKey: peer.documentKey,
      caretLine: peer.caretLine,
      connectedAt: peer.connectedAt,
      lastSeenAt: peer.lastSeenAt,
      ownership: peer.ownership,
      isLocal: peer.peerId === runtime.localPeerId,
      connectionState: 'connected',
    }))
    replacePeers(peers)
    setSessionState({
      ownerPeerId: message.ownerPeerId,
      role: runtime.role === 'idle' ? 'guest' : runtime.role,
      phase: 'connected',
      statusText: `Peers in session: ${message.peers.length}`,
      errorText: '',
    })
  }, [buildPeerRecord, replacePeers, setSessionState])

  const maybeRevealFollowPeer = React.useCallback((message: Extract<P2PCollaborationWireMessage, { kind: 'hello' | 'presence' }>) => {
    if (!currentFollowModeRef.current || message.caretLine == null) return
    const selectedPeerId = currentFollowPeerIdRef.current
    if (!selectedPeerId || selectedPeerId !== message.peerId) return
    if (message.documentKey !== currentDocumentKeyRef.current) return
    const revealSig = `${message.peerId}|${message.documentKey}|${message.caretLine}`
    if (lastFollowRevealSigRef.current === revealSig) return
    lastFollowRevealSigRef.current = revealSig
    args.revealRemoteLine(message.caretLine)
  }, [args])

  const applyRemotePresence = React.useCallback((message: Extract<P2PCollaborationWireMessage, { kind: 'hello' | 'presence' }>) => {
    const runtime = runtimeRefs.current
    const existingPeer = useP2PCollaborationStore.getState().peers.find(peer => peer.peerId === message.peerId)
    upsertPeer(buildPeerRecord({
      peerId: message.peerId,
      displayName: message.displayName,
      documentKey: message.documentKey,
      caretLine: message.caretLine,
      connectedAt: existingPeer?.connectedAt || Date.now(),
      lastSeenAt: Date.now(),
      ownership: message.ownership,
      isLocal: message.peerId === runtime.localPeerId,
      connectionState: 'connected',
    }))
    maybeRevealFollowPeer(message)
  }, [buildPeerRecord, maybeRevealFollowPeer, upsertPeer])

  const applyRemoteDocument = React.useCallback(async (message: Extract<P2PCollaborationWireMessage, { kind: 'document-sync' }>) => {
    const runtime = runtimeRefs.current
    const documentSignature = buildDocumentSignature(message.documentKey, message.text)
    const currentSignature = buildDocumentSignature(currentDocumentKeyRef.current, currentTextRef.current)
    const existingPeer = useP2PCollaborationStore.getState().peers.find(peer => peer.peerId === message.peerId)
    if (existingPeer) {
      upsertPeer({
        ...existingPeer,
        documentKey: message.documentKey,
        lastSeenAt: Date.now(),
        connectionState: 'connected',
      })
    }
    if (runtime.role === 'host') {
      broadcastToGuests(message, message.peerId)
    }
    if (documentSignature === currentSignature) return
    suppressOutboundDocumentSigRef.current = documentSignature
    await args.applyRemoteDocument({ documentKey: message.documentKey, text: message.text })
  }, [args, broadcastToGuests, upsertPeer])

  const attachChannel = React.useCallback((connectionRef: RuntimeConnectionRef, channel: RTCDataChannel) => {
    connectionRef.channel = channel
    channel.onopen = () => {
      const runtime = runtimeRefs.current
      connectionRef.connectedAt = connectionRef.connectedAt || Date.now()
      connectionRef.lastSeenAt = Date.now()
      ensureLocalPeer('connected')
      if (runtime.role === 'host' && connectionRef.peerId) {
        upsertPeer(buildPeerRecord({
          peerId: connectionRef.peerId,
          displayName: connectionRef.displayName,
          documentKey: currentDocumentKeyRef.current,
          caretLine: null,
          connectedAt: connectionRef.connectedAt,
          lastSeenAt: Date.now(),
          ownership: connectionRef.ownership,
          isLocal: false,
          connectionState: 'connected',
        }))
        updateHostStatus(buildPeerSummary(useP2PCollaborationStore.getState().peers))
        broadcastRosterToGuests()
      } else if (runtime.role === 'guest' && connectionRef.peerId) {
        upsertPeer(buildPeerRecord({
          peerId: connectionRef.peerId,
          displayName: connectionRef.displayName,
          documentKey: currentDocumentKeyRef.current,
          caretLine: null,
          connectedAt: connectionRef.connectedAt,
          lastSeenAt: Date.now(),
          ownership: connectionRef.ownership,
          isLocal: false,
          connectionState: 'connected',
        }))
        setSessionState({
          role: 'guest',
          phase: 'connected',
          statusText: 'Connected to session owner',
          errorText: '',
        })
      }
      sendHelloToConnection(connectionRef)
      sendDocumentToConnection(connectionRef)
      sendPresenceToConnection(connectionRef)
      if (runtime.role === 'host') {
        broadcastRosterToGuests()
      }
    }
    channel.onclose = () => {
      const runtime = runtimeRefs.current
      if (runtime.role === 'host' && connectionRef.peerId) {
        handleHostPeerDisconnect(connectionRef.peerId, `${connectionRef.displayName} disconnected`)
        return
      }
      handleGuestOwnerDisconnect(connectionRef.ownership === 'owner' ? 'Session owner disconnected' : 'Peer disconnected')
    }
    channel.onerror = () => {
      const runtime = runtimeRefs.current
      if (runtime.role === 'host') {
        setRuntimeStatus(`Peer channel error: ${connectionRef.displayName || 'guest'}`)
        return
      }
      setRuntimeError('Peer channel error')
    }
    channel.onmessage = event => {
      const runtime = runtimeRefs.current
      const message = parseP2PCollaborationWireMessage(String(event.data || ''))
      if (!message || message.sessionId !== runtime.sessionId) return
      if (message.kind === 'session-roster') {
        if (runtime.role === 'guest') applyRemoteRoster(message)
        return
      }
      if (message.kind === 'hello' || message.kind === 'presence') {
        applyRemotePresence(message)
        if (runtime.role === 'host' && message.peerId !== runtime.localPeerId) {
          broadcastToGuests(message, message.peerId)
          if (message.kind === 'hello') broadcastRosterToGuests()
        }
        return
      }
      if (message.kind === 'document-sync') {
        void applyRemoteDocument(message)
      }
    }
  }, [
    applyRemoteDocument,
    applyRemotePresence,
    applyRemoteRoster,
    broadcastToGuests,
    broadcastRosterToGuests,
    buildPeerRecord,
    ensureLocalPeer,
    handleGuestOwnerDisconnect,
    handleHostPeerDisconnect,
    sendDocumentToConnection,
    sendHelloToConnection,
    sendPresenceToConnection,
    setRuntimeError,
    setRuntimeStatus,
    setSessionState,
    updateHostStatus,
    upsertPeer,
  ])

  const bindConnectionLifecycle = React.useCallback((connectionRef: RuntimeConnectionRef) => {
    connectionRef.connection.onconnectionstatechange = () => {
      const state = connectionRef.connection.connectionState
      if (state === 'failed') {
        if (runtimeRefs.current.role === 'host' && connectionRef.peerId) {
          handleHostPeerDisconnect(connectionRef.peerId, `${connectionRef.displayName} failed`)
          return
        }
        if (runtimeRefs.current.role === 'guest' && connectionRef.ownership === 'owner') {
          handleGuestOwnerDisconnect('Session owner transport failed')
          return
        }
        setRuntimeError('Peer transport failed')
        return
      }
      if (state === 'disconnected' || state === 'closed') {
        if (runtimeRefs.current.role === 'host' && connectionRef.peerId) {
          handleHostPeerDisconnect(connectionRef.peerId, `${connectionRef.displayName} disconnected`)
          return
        }
        handleGuestOwnerDisconnect(connectionRef.ownership === 'owner' ? 'Session owner disconnected' : 'Peer disconnected')
      }
    }
    connectionRef.connection.ondatachannel = event => {
      attachChannel(connectionRef, event.channel)
    }
  }, [attachChannel, handleGuestOwnerDisconnect, handleHostPeerDisconnect, setRuntimeError])

  const closePendingHostInvite = React.useCallback(() => {
    const runtime = runtimeRefs.current
    if (!runtime.pendingHostInvite) return
    closeConnectionRef(runtime.pendingHostInvite, { suppressEvents: true })
    runtime.pendingHostInvite = null
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const inviteToken = readP2PInviteTokenFromLocation(window.location.href)
      if (inviteToken) seedInviteInputFromLocation(inviteToken)
    } catch {
      void 0
    }
  }, [seedInviteInputFromLocation])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePageHide = () => {
      disconnectRuntime('Idle')
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [disconnectRuntime])

  React.useEffect(() => {
    if (!args.active) return
    if (!pendingCommand || pendingCommand.id <= lastCommandIdRef.current) return
    lastCommandIdRef.current = pendingCommand.id
    if (!supportsWebRtc()) {
      setRuntimeError('WebRTC is not available in this browser')
      return
    }

    if (pendingCommand.kind === 'disconnect') {
      disconnectRuntime('Disconnected')
      return
    }

    if (pendingCommand.kind === 'remove-peer') {
      removeHostPeerByOwner(pendingCommand.peerId || '')
      return
    }

    if (pendingCommand.kind === 'start-host') {
      void (async () => {
        const runtime = runtimeRefs.current
        if (runtime.role !== 'host' || !runtime.sessionId || !runtime.localPeerId || !runtime.ownerPeerId) {
          disconnectRuntime('Idle')
          runtime.role = 'host'
          runtime.sessionId = generatePeerId()
          runtime.localPeerId = generatePeerId()
          runtime.ownerPeerId = runtime.localPeerId
          runtime.localConnectedAt = Date.now()
          runtime.guestConnection = null
          runtime.pendingHostInvite = null
          runtime.hostConnectionsByPeerId.clear()
          replacePeers([])
        } else {
          closePendingHostInvite()
        }
        ensureLocalPeer('connected')
        setSessionState({
          role: 'host',
          phase: 'preparing-invite',
          statusText: 'Preparing invite…',
          errorText: '',
          sessionId: runtime.sessionId,
          localPeerId: runtime.localPeerId,
          ownerPeerId: runtime.ownerPeerId,
          inviteToken: '',
          inviteUrl: '',
          answerToken: '',
          answerInput: '',
        })
        const inviteId = generatePeerId()
        const connectionRef: RuntimeConnectionRef = {
          inviteId,
          peerId: null,
          displayName: '',
          ownership: 'guest',
          connection: createPeerConnection(),
          channel: null,
          connectedAt: Date.now(),
          lastSeenAt: Date.now(),
        }
        bindConnectionLifecycle(connectionRef)
        const channel = connectionRef.connection.createDataChannel('kg-collab', { ordered: true })
        attachChannel(connectionRef, channel)
        runtime.pendingHostInvite = connectionRef
        const offer = await connectionRef.connection.createOffer()
        await connectionRef.connection.setLocalDescription(offer)
        await waitForIceGatheringComplete(connectionRef.connection)
        const localDescription = connectionRef.connection.localDescription
        if (!localDescription || !runtime.sessionId || !runtime.localPeerId || !runtime.ownerPeerId) {
          setRuntimeError('Failed to generate collaboration invite')
          return
        }
        const inviteToken = encodeP2PInvitePayload({
          v: P2P_COLLAB_PROTOCOL_VERSION,
          kind: 'invite',
          inviteId,
          sessionId: runtime.sessionId,
          ownerPeerId: runtime.ownerPeerId,
          hostPeerId: runtime.localPeerId,
          hostDisplayName: currentDisplayNameRef.current || 'Peer',
          documentKey: currentDocumentKeyRef.current,
          offer: { type: localDescription.type, sdp: localDescription.sdp || '' },
          createdAt: Date.now(),
        })
        const inviteUrl = typeof window !== 'undefined'
          ? buildP2PInviteUrl(inviteToken, window.location.href)
          : inviteToken
        setSessionState({
          role: 'host',
          phase: 'awaiting-answer',
          statusText: 'Invite ready. Waiting for guest answer…',
          errorText: '',
          sessionId: runtime.sessionId,
          localPeerId: runtime.localPeerId,
          ownerPeerId: runtime.ownerPeerId,
          inviteToken,
          inviteUrl,
        })
      })().catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to prepare collaboration invite'
        setRuntimeError(message)
      })
      return
    }

    if (pendingCommand.kind === 'join-invite') {
      void (async () => {
        disconnectRuntime('Idle')
        const invitePayload = parseP2PInviteInput(inviteInput)
        const runtime = runtimeRefs.current
        runtime.role = 'guest'
        runtime.sessionId = invitePayload.sessionId
        runtime.localPeerId = generatePeerId()
        runtime.ownerPeerId = invitePayload.ownerPeerId
        runtime.localConnectedAt = Date.now()
        replacePeers([])
        ensureLocalPeer('connecting')
        upsertPeer(buildPeerRecord({
          peerId: invitePayload.hostPeerId,
          displayName: invitePayload.hostDisplayName,
          documentKey: invitePayload.documentKey,
          caretLine: null,
          connectedAt: Date.now(),
          lastSeenAt: Date.now(),
          ownership: 'owner',
          isLocal: false,
          connectionState: 'connecting',
        }))
        setSessionState({
          role: 'guest',
          phase: 'preparing-answer',
          statusText: 'Preparing guest answer…',
          errorText: '',
          sessionId: invitePayload.sessionId,
          localPeerId: runtime.localPeerId,
          ownerPeerId: invitePayload.ownerPeerId,
          answerToken: '',
          inviteToken: '',
          inviteUrl: '',
        })
        const connectionRef: RuntimeConnectionRef = {
          inviteId: invitePayload.inviteId,
          peerId: invitePayload.hostPeerId,
          displayName: invitePayload.hostDisplayName,
          ownership: 'owner',
          connection: createPeerConnection(),
          channel: null,
          connectedAt: Date.now(),
          lastSeenAt: Date.now(),
        }
        bindConnectionLifecycle(connectionRef)
        runtime.guestConnection = connectionRef
        await connectionRef.connection.setRemoteDescription(invitePayload.offer)
        const answer = await connectionRef.connection.createAnswer()
        await connectionRef.connection.setLocalDescription(answer)
        await waitForIceGatheringComplete(connectionRef.connection)
        const localDescription = connectionRef.connection.localDescription
        if (!localDescription || !runtime.localPeerId) {
          setRuntimeError('Failed to generate collaboration answer')
          return
        }
        const answerToken = encodeP2PAnswerPayload({
          v: P2P_COLLAB_PROTOCOL_VERSION,
          kind: 'answer',
          inviteId: invitePayload.inviteId,
          sessionId: invitePayload.sessionId,
          ownerPeerId: invitePayload.ownerPeerId,
          guestPeerId: runtime.localPeerId,
          guestDisplayName: currentDisplayNameRef.current || 'Peer',
          answer: { type: localDescription.type, sdp: localDescription.sdp || '' },
          createdAt: Date.now(),
        })
        setSessionState({
          role: 'guest',
          phase: 'awaiting-host',
          statusText: 'Answer ready. Send it back to the host.',
          errorText: '',
          sessionId: invitePayload.sessionId,
          localPeerId: runtime.localPeerId,
          ownerPeerId: invitePayload.ownerPeerId,
          answerToken,
        })
      })().catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to join collaboration invite'
        setRuntimeError(message)
      })
      return
    }

    if (pendingCommand.kind === 'apply-answer') {
      void (async () => {
        const runtime = runtimeRefs.current
        const pendingInvite = runtime.pendingHostInvite
        if (!pendingInvite || runtime.role !== 'host' || !runtime.sessionId || !runtime.ownerPeerId) {
          setRuntimeError('Generate a host invite before applying a guest answer')
          return
        }
        const answerPayload = parseP2PAnswerInput(answerInput)
        if (
          answerPayload.sessionId !== runtime.sessionId
          || answerPayload.ownerPeerId !== runtime.ownerPeerId
          || answerPayload.inviteId !== pendingInvite.inviteId
        ) {
          setRuntimeError('Guest answer does not match the current invite')
          return
        }
        pendingInvite.peerId = answerPayload.guestPeerId
        pendingInvite.displayName = answerPayload.guestDisplayName
        runtime.hostConnectionsByPeerId.set(answerPayload.guestPeerId, pendingInvite)
        runtime.pendingHostInvite = null
        upsertPeer(buildPeerRecord({
          peerId: answerPayload.guestPeerId,
          displayName: answerPayload.guestDisplayName,
          documentKey: currentDocumentKeyRef.current,
          caretLine: null,
          connectedAt: Date.now(),
          lastSeenAt: Date.now(),
          ownership: 'guest',
          isLocal: false,
          connectionState: 'connecting',
        }))
        setSessionState({
          role: 'host',
          phase: 'connecting',
          statusText: 'Applying guest answer…',
          errorText: '',
          inviteToken: '',
          inviteUrl: '',
          answerInput: '',
        })
        await pendingInvite.connection.setRemoteDescription(answerPayload.answer)
        setRuntimeStatus('Guest answer applied. Waiting for peer channel…')
      })().catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to apply collaboration answer'
        setRuntimeError(message)
      })
    }
  }, [
    answerInput,
    args.active,
    attachChannel,
    bindConnectionLifecycle,
    buildPeerRecord,
    closePendingHostInvite,
    disconnectRuntime,
    ensureLocalPeer,
    inviteInput,
    pendingCommand,
    replacePeers,
    removeHostPeerByOwner,
    setRuntimeError,
    setRuntimeStatus,
    setSessionState,
    upsertPeer,
  ])

  React.useEffect(() => {
    if (!args.active) return
    const runtime = runtimeRefs.current
    const hasOpenChannel = runtime.role === 'guest'
      ? Boolean(runtime.guestConnection?.channel && runtime.guestConnection.channel.readyState === 'open')
      : Array.from(runtime.hostConnectionsByPeerId.values()).some(connectionRef => connectionRef.channel?.readyState === 'open')
    if (!hasOpenChannel) return
    const documentKey = String(args.activeDocumentKey || '').trim()
    if (!documentKey) return
    const documentSignature = buildDocumentSignature(documentKey, args.activeText)
    if (suppressOutboundDocumentSigRef.current === documentSignature) {
      suppressOutboundDocumentSigRef.current = null
      lastOutboundDocumentSigRef.current = documentSignature
      return
    }
    if (lastOutboundDocumentSigRef.current === documentSignature) return
    const timerId = window.setTimeout(() => {
      broadcastLocalDocument()
    }, 180)
    return () => window.clearTimeout(timerId)
  }, [args.active, args.activeDocumentKey, args.activeText, broadcastLocalDocument])

  React.useEffect(() => {
    if (!args.active) return
    const runtime = runtimeRefs.current
    const hasOpenChannel = runtime.role === 'guest'
      ? Boolean(runtime.guestConnection?.channel && runtime.guestConnection.channel.readyState === 'open')
      : Array.from(runtime.hostConnectionsByPeerId.values()).some(connectionRef => connectionRef.channel?.readyState === 'open')
    if (!hasOpenChannel) return
    ensureLocalPeer('connected')
    const timerId = window.setTimeout(() => {
      broadcastLocalPresence()
      broadcastLocalHello()
      if (runtime.role === 'host') broadcastRosterToGuests()
    }, 80)
    return () => window.clearTimeout(timerId)
  }, [
    args.active,
    args.activeDocumentKey,
    broadcastLocalHello,
    broadcastLocalPresence,
    broadcastRosterToGuests,
    displayName,
    ensureLocalPeer,
    followPeerId,
    localCaretLine,
  ])

  const onEditorCaretLine = React.useCallback((line: number) => {
    setLocalCaretLine(line)
  }, [setLocalCaretLine])

  return { onEditorCaretLine }
}

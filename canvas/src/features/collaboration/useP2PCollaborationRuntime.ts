import React from 'react'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import {
  buildP2PInviteUrl,
  encodeP2PAnswerPayload,
  encodeP2PInvitePayload,
  parseP2PAnswerInput,
  parseP2PInviteInput,
  readP2PInviteTokenFromLocation,
  P2P_COLLAB_PROTOCOL_VERSION,
  type P2PCollaborationRole,
  type P2PCollaborationWireMessage,
} from './p2pCollaborationProtocol'
import { useP2PCollaborationStore, type P2PCollaborationRemotePeer } from './p2pCollaborationStore'

type UseP2PCollaborationRuntimeArgs = {
  active: boolean
  activeDocumentKey: string
  activeText: string
  applyRemoteDocument: (args: { documentKey: string; text: string }) => Promise<void> | void
  revealRemoteLine: (line: number) => void
}

type RuntimePeerRefs = {
  connection: RTCPeerConnection | null
  channel: RTCDataChannel | null
  role: P2PCollaborationRole
  sessionId: string | null
  localPeerId: string | null
  remotePeer: P2PCollaborationRemotePeer | null
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

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

function parseWireMessage(raw: string): P2PCollaborationWireMessage | null {
  try {
    const parsed = JSON.parse(String(raw || '')) as Partial<P2PCollaborationWireMessage>
    if (!parsed || parsed.v !== P2P_COLLAB_PROTOCOL_VERSION || typeof parsed.kind !== 'string') return null
    if (parsed.kind === 'hello' || parsed.kind === 'presence') {
      return {
        v: P2P_COLLAB_PROTOCOL_VERSION,
        kind: parsed.kind,
        peerId: String(parsed.peerId || ''),
        displayName: String(parsed.displayName || ''),
        documentKey: String(parsed.documentKey || ''),
        caretLine: typeof parsed.caretLine === 'number' && Number.isFinite(parsed.caretLine) ? Math.max(1, Math.floor(parsed.caretLine)) : null,
        sentAt: Number(parsed.sentAt || Date.now()),
      }
    }
    if (parsed.kind === 'document-sync') {
      return {
        v: P2P_COLLAB_PROTOCOL_VERSION,
        kind: 'document-sync',
        peerId: String(parsed.peerId || ''),
        documentKey: String(parsed.documentKey || ''),
        text: String(parsed.text || ''),
        textHash: String(parsed.textHash || ''),
        sentAt: Number(parsed.sentAt || Date.now()),
      }
    }
    return null
  } catch {
    return null
  }
}

export function useP2PCollaborationRuntime(args: UseP2PCollaborationRuntimeArgs): {
  onEditorCaretLine: (line: number) => void
} {
  const displayName = useP2PCollaborationStore(s => s.displayName)
  const inviteInput = useP2PCollaborationStore(s => s.inviteInput)
  const answerInput = useP2PCollaborationStore(s => s.answerInput)
  const followModeEnabled = useP2PCollaborationStore(s => s.followModeEnabled)
  const localCaretLine = useP2PCollaborationStore(s => s.localCaretLine)
  const pendingCommand = useP2PCollaborationStore(s => s.pendingCommand)
  const seedInviteInputFromLocation = useP2PCollaborationStore(s => s.seedInviteInputFromLocation)
  const setLocalCaretLine = useP2PCollaborationStore(s => s.setLocalCaretLine)
  const markPreparingHost = useP2PCollaborationStore(s => s.markPreparingHost)
  const markAwaitingAnswer = useP2PCollaborationStore(s => s.markAwaitingAnswer)
  const markPreparingGuest = useP2PCollaborationStore(s => s.markPreparingGuest)
  const markAwaitingHost = useP2PCollaborationStore(s => s.markAwaitingHost)
  const markConnecting = useP2PCollaborationStore(s => s.markConnecting)
  const markConnected = useP2PCollaborationStore(s => s.markConnected)
  const updateRemotePeer = useP2PCollaborationStore(s => s.updateRemotePeer)
  const setRuntimeStatus = useP2PCollaborationStore(s => s.setRuntimeStatus)
  const setRuntimeError = useP2PCollaborationStore(s => s.setRuntimeError)
  const resetSession = useP2PCollaborationStore(s => s.resetSession)

  const runtimeRefs = React.useRef<RuntimePeerRefs>({
    connection: null,
    channel: null,
    role: 'idle',
    sessionId: null,
    localPeerId: null,
    remotePeer: null,
  })
  const lastCommandIdRef = React.useRef<number>(0)
  const currentDocumentKeyRef = React.useRef('')
  const currentTextRef = React.useRef('')
  const currentDisplayNameRef = React.useRef('')
  const currentFollowModeRef = React.useRef(false)
  const currentCaretLineRef = React.useRef<number | null>(null)
  const suppressOutboundDocumentSigRef = React.useRef<string | null>(null)
  const lastOutboundDocumentSigRef = React.useRef<string | null>(null)
  const lastFollowRevealSigRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    currentDocumentKeyRef.current = String(args.activeDocumentKey || '').trim()
    currentTextRef.current = String(args.activeText || '')
    currentDisplayNameRef.current = String(displayName || '').trim() || 'Peer'
    currentFollowModeRef.current = followModeEnabled
    currentCaretLineRef.current = typeof localCaretLine === 'number' && Number.isFinite(localCaretLine)
      ? Math.max(1, Math.floor(localCaretLine))
      : null
  }, [args.activeDocumentKey, args.activeText, displayName, followModeEnabled, localCaretLine])

  const disconnectRuntime = React.useCallback((statusText: string = 'Disconnected') => {
    const runtime = runtimeRefs.current
    try {
      runtime.channel?.close()
    } catch {
      void 0
    }
    try {
      runtime.connection?.close()
    } catch {
      void 0
    }
    runtime.channel = null
    runtime.connection = null
    runtime.role = 'idle'
    runtime.sessionId = null
    runtime.localPeerId = null
    runtime.remotePeer = null
    suppressOutboundDocumentSigRef.current = null
    lastOutboundDocumentSigRef.current = null
    lastFollowRevealSigRef.current = null
    updateRemotePeer(null)
    resetSession(statusText)
  }, [resetSession, updateRemotePeer])

  const sendWireMessage = React.useCallback((message: P2PCollaborationWireMessage) => {
    const channel = runtimeRefs.current.channel
    if (!channel || channel.readyState !== 'open') return false
    try {
      channel.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }, [])

  const sendHelloMessage = React.useCallback(() => {
    const runtime = runtimeRefs.current
    const peerId = String(runtime.localPeerId || '').trim()
    if (!peerId) return
    sendWireMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'hello',
      peerId,
      displayName: currentDisplayNameRef.current || 'Peer',
      documentKey: currentDocumentKeyRef.current,
      caretLine: currentCaretLineRef.current,
      sentAt: Date.now(),
    })
  }, [sendWireMessage])

  const sendPresenceMessage = React.useCallback(() => {
    const runtime = runtimeRefs.current
    const peerId = String(runtime.localPeerId || '').trim()
    if (!peerId) return
    sendWireMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'presence',
      peerId,
      displayName: currentDisplayNameRef.current || 'Peer',
      documentKey: currentDocumentKeyRef.current,
      caretLine: currentCaretLineRef.current,
      sentAt: Date.now(),
    })
  }, [sendWireMessage])

  const sendDocumentMessage = React.useCallback(() => {
    const runtime = runtimeRefs.current
    const peerId = String(runtime.localPeerId || '').trim()
    const documentKey = currentDocumentKeyRef.current
    if (!peerId || !documentKey) return
    const text = currentTextRef.current
    const documentSignature = buildDocumentSignature(documentKey, text)
    lastOutboundDocumentSigRef.current = documentSignature
    sendWireMessage({
      v: P2P_COLLAB_PROTOCOL_VERSION,
      kind: 'document-sync',
      peerId,
      documentKey,
      text,
      textHash: documentSignature.split('|').slice(1).join('|'),
      sentAt: Date.now(),
    })
  }, [sendWireMessage])

  const applyRemotePresence = React.useCallback((message: Extract<P2PCollaborationWireMessage, { kind: 'hello' | 'presence' }>) => {
    const runtime = runtimeRefs.current
    const nextRemotePeer: P2PCollaborationRemotePeer = {
      peerId: message.peerId,
      displayName: message.displayName || 'Peer',
      documentKey: message.documentKey,
      caretLine: message.caretLine,
      connectedAt: runtime.remotePeer?.connectedAt || Date.now(),
      lastSeenAt: Date.now(),
    }
    runtime.remotePeer = nextRemotePeer
    if (runtime.role !== 'idle' && runtime.sessionId) {
      markConnected({
        role: runtime.role === 'guest' ? 'guest' : 'host',
        sessionId: runtime.sessionId,
        remotePeer: nextRemotePeer,
      })
    } else {
      updateRemotePeer(nextRemotePeer)
    }
    const revealLine = message.caretLine
    const revealSig = revealLine == null ? null : `${message.documentKey}|${revealLine}`
    if (
      currentFollowModeRef.current
      && revealLine != null
      && revealSig
      && revealSig !== lastFollowRevealSigRef.current
      && message.documentKey === currentDocumentKeyRef.current
    ) {
      lastFollowRevealSigRef.current = revealSig
      args.revealRemoteLine(revealLine)
    }
  }, [args, markConnected, updateRemotePeer])

  const applyRemoteDocument = React.useCallback(async (message: Extract<P2PCollaborationWireMessage, { kind: 'document-sync' }>) => {
    const documentSignature = buildDocumentSignature(message.documentKey, message.text)
    const currentSignature = buildDocumentSignature(currentDocumentKeyRef.current, currentTextRef.current)
    if (documentSignature === currentSignature) return
    suppressOutboundDocumentSigRef.current = documentSignature
    await args.applyRemoteDocument({ documentKey: message.documentKey, text: message.text })
    const runtime = runtimeRefs.current
    if (runtime.remotePeer) {
      const nextRemotePeer = { ...runtime.remotePeer, documentKey: message.documentKey, lastSeenAt: Date.now() }
      runtime.remotePeer = nextRemotePeer
      updateRemotePeer(nextRemotePeer)
    }
  }, [args, updateRemotePeer])

  const attachChannel = React.useCallback((channel: RTCDataChannel) => {
    runtimeRefs.current.channel = channel
    channel.onopen = () => {
      setRuntimeStatus('Peer channel open. Syncing state…')
      sendHelloMessage()
      sendDocumentMessage()
      sendPresenceMessage()
    }
    channel.onclose = () => {
      disconnectRuntime('Peer disconnected')
    }
    channel.onerror = () => {
      setRuntimeError('Peer channel error')
    }
    channel.onmessage = event => {
      const message = parseWireMessage(String(event.data || ''))
      if (!message) return
      if (message.kind === 'hello' || message.kind === 'presence') {
        applyRemotePresence(message)
        return
      }
      if (message.kind === 'document-sync') {
        void applyRemoteDocument(message)
      }
    }
  }, [applyRemoteDocument, applyRemotePresence, disconnectRuntime, sendDocumentMessage, sendHelloMessage, sendPresenceMessage, setRuntimeError, setRuntimeStatus])

  const prepareConnection = React.useCallback((role: P2PCollaborationRole, sessionId: string, localPeerId: string): RTCPeerConnection => {
    const connection = createPeerConnection()
    runtimeRefs.current.connection = connection
    runtimeRefs.current.role = role
    runtimeRefs.current.sessionId = sessionId
    runtimeRefs.current.localPeerId = localPeerId
    runtimeRefs.current.remotePeer = null
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === 'connected') {
        setRuntimeStatus('Peer transport connected')
        return
      }
      if (state === 'failed') {
        setRuntimeError('Peer transport failed')
        return
      }
      if (state === 'disconnected' || state === 'closed') {
        disconnectRuntime('Peer disconnected')
      }
    }
    connection.ondatachannel = event => {
      attachChannel(event.channel)
    }
    return connection
  }, [attachChannel, disconnectRuntime, setRuntimeError, setRuntimeStatus])

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
    return () => {
      disconnectRuntime('Idle')
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

    if (pendingCommand.kind === 'start-host') {
      void (async () => {
        disconnectRuntime('Idle')
        markPreparingHost()
        const localPeerId = generatePeerId()
        const sessionId = generatePeerId()
        const connection = prepareConnection('host', sessionId, localPeerId)
        const channel = connection.createDataChannel('kg-collab', { ordered: true })
        attachChannel(channel)
        markConnecting({ role: 'host', sessionId, statusText: 'Creating host offer…' })
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        await waitForIceGatheringComplete(connection)
        const localDescription = connection.localDescription
        if (!localDescription) {
          setRuntimeError('Failed to generate collaboration invite')
          return
        }
        const inviteToken = encodeP2PInvitePayload({
          v: P2P_COLLAB_PROTOCOL_VERSION,
          kind: 'invite',
          sessionId,
          hostPeerId: localPeerId,
          hostDisplayName: currentDisplayNameRef.current || 'Peer',
          documentKey: currentDocumentKeyRef.current,
          offer: { type: localDescription.type, sdp: localDescription.sdp || '' },
          createdAt: Date.now(),
        })
        const inviteUrl = typeof window !== 'undefined'
          ? buildP2PInviteUrl(inviteToken, window.location.href)
          : inviteToken
        markAwaitingAnswer({ sessionId, inviteToken, inviteUrl })
      })().catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to prepare collaboration invite'
        setRuntimeError(message)
      })
      return
    }

    if (pendingCommand.kind === 'join-invite') {
      void (async () => {
        disconnectRuntime('Idle')
        markPreparingGuest()
        const invitePayload = parseP2PInviteInput(inviteInput)
        const localPeerId = generatePeerId()
        const connection = prepareConnection('guest', invitePayload.sessionId, localPeerId)
        markConnecting({ role: 'guest', sessionId: invitePayload.sessionId, statusText: 'Creating guest answer…' })
        await connection.setRemoteDescription(invitePayload.offer)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        await waitForIceGatheringComplete(connection)
        const localDescription = connection.localDescription
        if (!localDescription) {
          setRuntimeError('Failed to generate collaboration answer')
          return
        }
        runtimeRefs.current.remotePeer = {
          peerId: invitePayload.hostPeerId,
          displayName: invitePayload.hostDisplayName,
          documentKey: invitePayload.documentKey,
          caretLine: null,
          connectedAt: Date.now(),
          lastSeenAt: Date.now(),
        }
        updateRemotePeer(runtimeRefs.current.remotePeer)
        const answerToken = encodeP2PAnswerPayload({
          v: P2P_COLLAB_PROTOCOL_VERSION,
          kind: 'answer',
          sessionId: invitePayload.sessionId,
          guestPeerId: localPeerId,
          guestDisplayName: currentDisplayNameRef.current || 'Peer',
          answer: { type: localDescription.type, sdp: localDescription.sdp || '' },
          createdAt: Date.now(),
        })
        markAwaitingHost({ sessionId: invitePayload.sessionId, answerToken })
      })().catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to join collaboration invite'
        setRuntimeError(message)
      })
      return
    }

    if (pendingCommand.kind === 'apply-answer') {
      void (async () => {
        const runtime = runtimeRefs.current
        const connection = runtime.connection
        if (!connection || runtime.role !== 'host' || !runtime.sessionId) {
          setRuntimeError('Start a host session before applying a guest answer')
          return
        }
        const answerPayload = parseP2PAnswerInput(answerInput)
        if (answerPayload.sessionId !== runtime.sessionId) {
          setRuntimeError('Guest answer does not match the current session')
          return
        }
        runtime.remotePeer = {
          peerId: answerPayload.guestPeerId,
          displayName: answerPayload.guestDisplayName,
          documentKey: currentDocumentKeyRef.current,
          caretLine: null,
          connectedAt: Date.now(),
          lastSeenAt: Date.now(),
        }
        updateRemotePeer(runtime.remotePeer)
        markConnecting({ role: 'host', sessionId: runtime.sessionId, statusText: 'Applying guest answer…' })
        await connection.setRemoteDescription(answerPayload.answer)
        setRuntimeStatus('Guest answer applied. Waiting for data channel…')
      })().catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to apply collaboration answer'
        setRuntimeError(message)
      })
    }
  }, [
    answerInput,
    args.active,
    attachChannel,
    disconnectRuntime,
    inviteInput,
    markAwaitingAnswer,
    markAwaitingHost,
    markConnecting,
    markPreparingGuest,
    markPreparingHost,
    pendingCommand,
    prepareConnection,
    setRuntimeError,
    setRuntimeStatus,
    updateRemotePeer,
  ])

  React.useEffect(() => {
    if (!args.active) return
    const channel = runtimeRefs.current.channel
    if (!channel || channel.readyState !== 'open') return
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
      if (!runtimeRefs.current.channel || runtimeRefs.current.channel.readyState !== 'open') return
      sendDocumentMessage()
    }, 180)
    return () => window.clearTimeout(timerId)
  }, [args.active, args.activeDocumentKey, args.activeText, sendDocumentMessage])

  React.useEffect(() => {
    if (!args.active) return
    const channel = runtimeRefs.current.channel
    if (!channel || channel.readyState !== 'open') return
    const timerId = window.setTimeout(() => {
      sendPresenceMessage()
    }, 80)
    return () => window.clearTimeout(timerId)
  }, [args.active, args.activeDocumentKey, displayName, localCaretLine, sendPresenceMessage])

  const onEditorCaretLine = React.useCallback((line: number) => {
    setLocalCaretLine(line)
  }, [setLocalCaretLine])

  return { onEditorCaretLine }
}

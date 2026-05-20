import { decodeBase64ToUtf8, encodeUtf8ToBase64 } from '@/features/markdown/markdownRoundTrip'

export const P2P_COLLAB_INVITE_SEARCH_PARAM = 'kgCollab'
export const P2P_COLLAB_ANSWER_SEARCH_PARAM = 'kgCollabAnswer'
export const P2P_COLLAB_PROTOCOL_VERSION = 1 as const

export type P2PCollaborationRole = 'idle' | 'host' | 'guest'
export type P2PCollaborationPhase =
  | 'idle'
  | 'preparing-invite'
  | 'awaiting-answer'
  | 'preparing-answer'
  | 'awaiting-host'
  | 'connecting'
  | 'connected'
  | 'error'

export type P2PInvitePayload = {
  v: typeof P2P_COLLAB_PROTOCOL_VERSION
  kind: 'invite'
  inviteId: string
  sessionId: string
  ownerPeerId: string
  hostPeerId: string
  hostDisplayName: string
  documentKey: string
  offer: RTCSessionDescriptionInit
  createdAt: number
}

export type P2PAnswerPayload = {
  v: typeof P2P_COLLAB_PROTOCOL_VERSION
  kind: 'answer'
  inviteId: string
  sessionId: string
  ownerPeerId: string
  guestPeerId: string
  guestDisplayName: string
  answer: RTCSessionDescriptionInit
  createdAt: number
}

export type P2PCollaborationWirePeerRole = 'owner' | 'guest'

export type P2PCollaborationPeerSnapshot = {
  peerId: string
  displayName: string
  documentKey: string
  caretLine: number | null
  connectedAt: number
  lastSeenAt: number
  ownership: P2PCollaborationWirePeerRole
}

export type P2PCollaborationWireMessage =
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'hello'
      sessionId: string
      peerId: string
      displayName: string
      documentKey: string
      caretLine: number | null
      ownership: P2PCollaborationWirePeerRole
      sentAt: number
    }
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'document-sync'
      sessionId: string
      peerId: string
      documentKey: string
      text: string
      textHash: string
      sentAt: number
    }
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'presence'
      sessionId: string
      peerId: string
      displayName: string
      documentKey: string
      caretLine: number | null
      ownership: P2PCollaborationWirePeerRole
      sentAt: number
    }
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'session-roster'
      sessionId: string
      ownerPeerId: string
      peers: P2PCollaborationPeerSnapshot[]
      sentAt: number
    }

const toBase64Url = (value: string): string => {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromBase64Url = (value: string): string => {
  const normalized = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/')
  if (!normalized) return ''
  const remainder = normalized.length % 4
  if (remainder === 0) return normalized
  return `${normalized}${'='.repeat(4 - remainder)}`
}

function decodePayloadToken(raw: string): unknown {
  const token = String(raw || '').trim()
  if (!token) throw new Error('Missing collaboration payload')
  const decoded = decodeBase64ToUtf8(fromBase64Url(token))
  return JSON.parse(decoded) as unknown
}

function encodePayloadToken(value: object): string {
  return toBase64Url(encodeUtf8ToBase64(JSON.stringify(value)))
}

function isSessionDescriptionInit(value: unknown): value is RTCSessionDescriptionInit {
  if (!value || typeof value !== 'object') return false
  const type = String((value as { type?: unknown }).type || '')
  const sdp = String((value as { sdp?: unknown }).sdp || '')
  return (type === 'offer' || type === 'answer' || type === 'pranswer' || type === 'rollback') && sdp.length > 0
}

function parsePayloadFromInput(input: string, paramName: string): unknown {
  const trimmed = String(input || '').trim()
  if (!trimmed) throw new Error('Missing collaboration payload')
  if (!trimmed.includes('://')) {
    return decodePayloadToken(trimmed)
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Invalid collaboration URL')
  }
  const paramValue = url.searchParams.get(paramName) || url.hash.replace(/^#/, '')
  if (!paramValue) throw new Error(`Missing ${paramName} payload`)
  return decodePayloadToken(paramValue)
}

function isWirePeerRole(value: unknown): value is P2PCollaborationWirePeerRole {
  return value === 'owner' || value === 'guest'
}

function parseCaretLine(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : null
}

function isPeerSnapshot(value: unknown): value is P2PCollaborationPeerSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<P2PCollaborationPeerSnapshot>
  return (
    typeof snapshot.peerId === 'string'
    && typeof snapshot.displayName === 'string'
    && typeof snapshot.documentKey === 'string'
    && isWirePeerRole(snapshot.ownership)
    && typeof snapshot.connectedAt === 'number'
    && Number.isFinite(snapshot.connectedAt)
    && typeof snapshot.lastSeenAt === 'number'
    && Number.isFinite(snapshot.lastSeenAt)
    && (snapshot.caretLine == null || (typeof snapshot.caretLine === 'number' && Number.isFinite(snapshot.caretLine)))
  )
}

export function encodeP2PInvitePayload(payload: P2PInvitePayload): string {
  return encodePayloadToken(payload)
}

export function encodeP2PAnswerPayload(payload: P2PAnswerPayload): string {
  return encodePayloadToken(payload)
}

export function parseP2PInviteInput(input: string): P2PInvitePayload {
  const value = parsePayloadFromInput(input, P2P_COLLAB_INVITE_SEARCH_PARAM)
  if (!value || typeof value !== 'object') throw new Error('Invalid collaboration invite payload')
  const payload = value as Partial<P2PInvitePayload>
  if (payload.v !== P2P_COLLAB_PROTOCOL_VERSION || payload.kind !== 'invite') {
    throw new Error('Unsupported collaboration invite payload')
  }
  if (!payload.sessionId || !payload.hostPeerId || !payload.hostDisplayName) {
    throw new Error('Incomplete collaboration invite payload')
  }
  if (!payload.ownerPeerId || !payload.inviteId) {
    throw new Error('Incomplete collaboration invite metadata')
  }
  if (!isSessionDescriptionInit(payload.offer) || payload.offer.type !== 'offer') {
    throw new Error('Invalid collaboration offer payload')
  }
  return {
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'invite',
    inviteId: String(payload.inviteId),
    sessionId: String(payload.sessionId),
    ownerPeerId: String(payload.ownerPeerId),
    hostPeerId: String(payload.hostPeerId),
    hostDisplayName: String(payload.hostDisplayName),
    documentKey: String(payload.documentKey || ''),
    offer: payload.offer,
    createdAt: Number(payload.createdAt || Date.now()),
  }
}

export function parseP2PAnswerInput(input: string): P2PAnswerPayload {
  const value = parsePayloadFromInput(input, P2P_COLLAB_ANSWER_SEARCH_PARAM)
  if (!value || typeof value !== 'object') throw new Error('Invalid collaboration answer payload')
  const payload = value as Partial<P2PAnswerPayload>
  if (payload.v !== P2P_COLLAB_PROTOCOL_VERSION || payload.kind !== 'answer') {
    throw new Error('Unsupported collaboration answer payload')
  }
  if (!payload.sessionId || !payload.guestPeerId || !payload.guestDisplayName) {
    throw new Error('Incomplete collaboration answer payload')
  }
  if (!payload.ownerPeerId || !payload.inviteId) {
    throw new Error('Incomplete collaboration answer metadata')
  }
  if (!isSessionDescriptionInit(payload.answer) || payload.answer.type !== 'answer') {
    throw new Error('Invalid collaboration answer payload')
  }
  return {
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'answer',
    inviteId: String(payload.inviteId),
    sessionId: String(payload.sessionId),
    ownerPeerId: String(payload.ownerPeerId),
    guestPeerId: String(payload.guestPeerId),
    guestDisplayName: String(payload.guestDisplayName),
    answer: payload.answer,
    createdAt: Number(payload.createdAt || Date.now()),
  }
}

export function buildP2PInviteUrl(inviteToken: string, locationHref: string): string {
  const baseUrl = new URL(locationHref)
  baseUrl.searchParams.set(P2P_COLLAB_INVITE_SEARCH_PARAM, inviteToken)
  baseUrl.searchParams.delete(P2P_COLLAB_ANSWER_SEARCH_PARAM)
  return baseUrl.toString()
}

export function readP2PInviteTokenFromLocation(locationHref: string): string {
  const url = new URL(locationHref)
  return String(url.searchParams.get(P2P_COLLAB_INVITE_SEARCH_PARAM) || '').trim()
}

export function parseP2PCollaborationWireMessage(raw: string): P2PCollaborationWireMessage | null {
  try {
    const parsed = JSON.parse(String(raw || '')) as Partial<P2PCollaborationWireMessage>
    if (!parsed || parsed.v !== P2P_COLLAB_PROTOCOL_VERSION || typeof parsed.kind !== 'string' || typeof parsed.sessionId !== 'string') {
      return null
    }
    if (parsed.kind === 'hello' || parsed.kind === 'presence') {
      if (!isWirePeerRole(parsed.ownership)) return null
      return {
        v: P2P_COLLAB_PROTOCOL_VERSION,
        kind: parsed.kind,
        sessionId: parsed.sessionId,
        peerId: String(parsed.peerId || ''),
        displayName: String(parsed.displayName || ''),
        documentKey: String(parsed.documentKey || ''),
        caretLine: parseCaretLine(parsed.caretLine),
        ownership: parsed.ownership,
        sentAt: Number(parsed.sentAt || Date.now()),
      }
    }
    if (parsed.kind === 'document-sync') {
      return {
        v: P2P_COLLAB_PROTOCOL_VERSION,
        kind: 'document-sync',
        sessionId: parsed.sessionId,
        peerId: String(parsed.peerId || ''),
        documentKey: String(parsed.documentKey || ''),
        text: String(parsed.text || ''),
        textHash: String(parsed.textHash || ''),
        sentAt: Number(parsed.sentAt || Date.now()),
      }
    }
    if (parsed.kind === 'session-roster') {
      const peers = Array.isArray(parsed.peers) ? parsed.peers.filter(isPeerSnapshot) : []
      return {
        v: P2P_COLLAB_PROTOCOL_VERSION,
        kind: 'session-roster',
        sessionId: parsed.sessionId,
        ownerPeerId: String(parsed.ownerPeerId || ''),
        peers: peers.map(peer => ({
          ...peer,
          caretLine: parseCaretLine(peer.caretLine),
        })),
        sentAt: Number(parsed.sentAt || Date.now()),
      }
    }
    return null
  } catch {
    return null
  }
}

export function buildDefaultCollaborationDisplayName(): string {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const platform = typeof navigator !== 'undefined' ? navigator.platform : ''
  const label = [platform, userAgent]
    .map(value => String(value || '').trim())
    .find(Boolean)
  if (!label) return 'Peer'
  if (/mac/i.test(label)) return 'Mac Peer'
  if (/win/i.test(label)) return 'Windows Peer'
  if (/iphone|ipad|ios/i.test(label)) return 'iOS Peer'
  if (/android/i.test(label)) return 'Android Peer'
  if (/linux/i.test(label)) return 'Linux Peer'
  return 'Peer'
}

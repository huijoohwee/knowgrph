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
  sessionId: string
  hostPeerId: string
  hostDisplayName: string
  documentKey: string
  offer: RTCSessionDescriptionInit
  createdAt: number
}

export type P2PAnswerPayload = {
  v: typeof P2P_COLLAB_PROTOCOL_VERSION
  kind: 'answer'
  sessionId: string
  guestPeerId: string
  guestDisplayName: string
  answer: RTCSessionDescriptionInit
  createdAt: number
}

export type P2PCollaborationWireMessage =
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'hello'
      peerId: string
      displayName: string
      documentKey: string
      caretLine: number | null
      sentAt: number
    }
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'document-sync'
      peerId: string
      documentKey: string
      text: string
      textHash: string
      sentAt: number
    }
  | {
      v: typeof P2P_COLLAB_PROTOCOL_VERSION
      kind: 'presence'
      peerId: string
      displayName: string
      documentKey: string
      caretLine: number | null
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
  if (!isSessionDescriptionInit(payload.offer) || payload.offer.type !== 'offer') {
    throw new Error('Invalid collaboration offer payload')
  }
  return {
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'invite',
    sessionId: String(payload.sessionId),
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
  if (!isSessionDescriptionInit(payload.answer) || payload.answer.type !== 'answer') {
    throw new Error('Invalid collaboration answer payload')
  }
  return {
    v: P2P_COLLAB_PROTOCOL_VERSION,
    kind: 'answer',
    sessionId: String(payload.sessionId),
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

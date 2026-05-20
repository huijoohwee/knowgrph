import { create } from 'zustand'
import {
  buildDefaultCollaborationDisplayName,
  type P2PCollaborationPhase,
  type P2PCollaborationRole,
  type P2PCollaborationWirePeerRole,
} from './p2pCollaborationProtocol'

export type P2PCollaborationCommandKind = 'start-host' | 'join-invite' | 'apply-answer' | 'disconnect' | 'remove-peer'

export type P2PCollaborationCommand = {
  id: number
  kind: P2PCollaborationCommandKind
  peerId?: string
}

export type P2PCollaborationRemotePeer = {
  peerId: string
  displayName: string
  documentKey: string
  caretLine: number | null
  connectedAt: number
  lastSeenAt: number
  ownership: P2PCollaborationWirePeerRole
  isLocal: boolean
  connectionState: 'invited' | 'connecting' | 'connected'
}

type P2PCollaborationStoreSessionPatch = Partial<
  Pick<
    P2PCollaborationStoreState,
    | 'role'
    | 'phase'
    | 'statusText'
    | 'errorText'
    | 'sessionId'
    | 'localPeerId'
    | 'ownerPeerId'
    | 'inviteToken'
    | 'inviteUrl'
    | 'inviteInput'
    | 'answerToken'
    | 'answerInput'
    | 'followPeerId'
  >
>

type P2PCollaborationStoreState = {
  displayName: string
  role: P2PCollaborationRole
  phase: P2PCollaborationPhase
  statusText: string
  errorText: string
  sessionId: string | null
  localPeerId: string | null
  ownerPeerId: string | null
  inviteInput: string
  inviteToken: string
  inviteUrl: string
  answerInput: string
  answerToken: string
  followModeEnabled: boolean
  followPeerId: string | null
  localCaretLine: number | null
  peers: P2PCollaborationRemotePeer[]
  pendingCommand: P2PCollaborationCommand | null
  commandSeq: number
  setDisplayName: (value: string) => void
  setInviteInput: (value: string) => void
  setAnswerInput: (value: string) => void
  setFollowModeEnabled: (value: boolean) => void
  setFollowPeerId: (value: string | null) => void
  setLocalCaretLine: (value: number | null) => void
  seedInviteInputFromLocation: (value: string) => void
  setSessionState: (patch: P2PCollaborationStoreSessionPatch) => void
  upsertPeer: (value: P2PCollaborationRemotePeer) => void
  replacePeers: (peers: P2PCollaborationRemotePeer[]) => void
  removePeer: (peerId: string) => void
  queueStartHost: () => void
  queueJoinInvite: () => void
  queueApplyAnswer: () => void
  queueDisconnect: () => void
  queueRemovePeer: (peerId: string) => void
  setRuntimeStatus: (statusText: string) => void
  setRuntimeError: (errorText: string) => void
  resetSession: (statusText?: string) => void
}

function sortPeers(peers: P2PCollaborationRemotePeer[]): P2PCollaborationRemotePeer[] {
  return [...peers].sort((left, right) => {
    if (left.ownership !== right.ownership) return left.ownership === 'owner' ? -1 : 1
    if (left.isLocal !== right.isLocal) return left.isLocal ? -1 : 1
    return left.displayName.localeCompare(right.displayName)
  })
}

function normalizeFollowPeerId(peers: P2PCollaborationRemotePeer[], followPeerId: string | null): string | null {
  const normalized = String(followPeerId || '').trim()
  if (!normalized) return null
  return peers.some(peer => peer.peerId === normalized && !peer.isLocal) ? normalized : null
}

const initialState = (): Pick<
  P2PCollaborationStoreState,
  | 'displayName'
  | 'role'
  | 'phase'
  | 'statusText'
  | 'errorText'
  | 'sessionId'
  | 'localPeerId'
  | 'ownerPeerId'
  | 'inviteInput'
  | 'inviteToken'
  | 'inviteUrl'
  | 'answerInput'
  | 'answerToken'
  | 'followModeEnabled'
  | 'followPeerId'
  | 'localCaretLine'
  | 'peers'
  | 'pendingCommand'
  | 'commandSeq'
> => ({
  displayName: buildDefaultCollaborationDisplayName(),
  role: 'idle',
  phase: 'idle',
  statusText: 'Idle',
  errorText: '',
  sessionId: null,
  localPeerId: null,
  ownerPeerId: null,
  inviteInput: '',
  inviteToken: '',
  inviteUrl: '',
  answerInput: '',
  answerToken: '',
  followModeEnabled: false,
  followPeerId: null,
  localCaretLine: null,
  peers: [],
  pendingCommand: null,
  commandSeq: 0,
})

function nextCommand(kind: P2PCollaborationCommandKind, commandSeq: number, args?: { peerId?: string }): P2PCollaborationCommand {
  return { id: commandSeq + 1, kind, peerId: args?.peerId }
}

export const useP2PCollaborationStore = create<P2PCollaborationStoreState>((set, get) => ({
  ...initialState(),
  setDisplayName: value => {
    const trimmed = String(value || '').trimStart()
    set(state => (state.displayName === trimmed ? state : { displayName: trimmed }))
  },
  setInviteInput: value => {
    const next = String(value || '')
    set(state => (state.inviteInput === next ? state : { inviteInput: next }))
  },
  setAnswerInput: value => {
    const next = String(value || '')
    set(state => (state.answerInput === next ? state : { answerInput: next }))
  },
  setFollowModeEnabled: value => {
    set(state => (state.followModeEnabled === value ? state : { followModeEnabled: value }))
  },
  setFollowPeerId: value => {
    const next = String(value || '').trim() || null
    set(state => {
      const normalized = normalizeFollowPeerId(state.peers, next)
      return state.followPeerId === normalized ? state : { followPeerId: normalized }
    })
  },
  setLocalCaretLine: value => {
    set(state => (state.localCaretLine === value ? state : { localCaretLine: value }))
  },
  seedInviteInputFromLocation: value => {
    const next = String(value || '').trim()
    if (!next) return
    set(state => {
      if (String(state.inviteInput || '').trim()) return state
      return { inviteInput: next }
    })
  },
  setSessionState: patch => {
    set(state => {
      const nextPatch: P2PCollaborationStoreSessionPatch = { ...patch }
      if ('followPeerId' in nextPatch) {
        nextPatch.followPeerId = normalizeFollowPeerId(state.peers, nextPatch.followPeerId || null)
      }
      return nextPatch
    })
  },
  upsertPeer: value => {
    set(state => {
      const nextPeers = sortPeers([
        ...state.peers.filter(peer => peer.peerId !== value.peerId),
        value,
      ])
      return {
        peers: nextPeers,
        followPeerId: normalizeFollowPeerId(nextPeers, state.followPeerId),
      }
    })
  },
  replacePeers: peers => {
    set(state => {
      const nextPeers = sortPeers(peers)
      return {
        peers: nextPeers,
        followPeerId: normalizeFollowPeerId(nextPeers, state.followPeerId),
      }
    })
  },
  removePeer: peerId => {
    const normalizedPeerId = String(peerId || '').trim()
    if (!normalizedPeerId) return
    set(state => {
      const nextPeers = sortPeers(state.peers.filter(peer => peer.peerId !== normalizedPeerId))
      return {
        peers: nextPeers,
        followPeerId: normalizeFollowPeerId(nextPeers, state.followPeerId),
      }
    })
  },
  queueStartHost: () => {
    const state = get()
    set({
      pendingCommand: nextCommand('start-host', state.commandSeq),
      commandSeq: state.commandSeq + 1,
      errorText: '',
    })
  },
  queueJoinInvite: () => {
    const state = get()
    set({
      pendingCommand: nextCommand('join-invite', state.commandSeq),
      commandSeq: state.commandSeq + 1,
      errorText: '',
    })
  },
  queueApplyAnswer: () => {
    const state = get()
    set({
      pendingCommand: nextCommand('apply-answer', state.commandSeq),
      commandSeq: state.commandSeq + 1,
      errorText: '',
    })
  },
  queueDisconnect: () => {
    const state = get()
    set({
      pendingCommand: nextCommand('disconnect', state.commandSeq),
      commandSeq: state.commandSeq + 1,
      errorText: '',
    })
  },
  queueRemovePeer: peerId => {
    const normalizedPeerId = String(peerId || '').trim()
    if (!normalizedPeerId) return
    const state = get()
    set({
      pendingCommand: nextCommand('remove-peer', state.commandSeq, { peerId: normalizedPeerId }),
      commandSeq: state.commandSeq + 1,
      errorText: '',
    })
  },
  setRuntimeStatus: statusText => {
    const next = String(statusText || '').trim()
    set(state => (state.statusText === next ? state : { statusText: next }))
  },
  setRuntimeError: errorText => {
    const next = String(errorText || '').trim()
    set({
      phase: 'error',
      statusText: next || 'Collaboration error',
      errorText: next,
    })
  },
  resetSession: statusText => {
    const nextStatusText = String(statusText || '').trim() || 'Idle'
    set(state => ({
      ...state,
      role: 'idle',
      phase: 'idle',
      statusText: nextStatusText,
      errorText: '',
      sessionId: null,
      localPeerId: null,
      ownerPeerId: null,
      inviteToken: '',
      inviteUrl: '',
      answerToken: '',
      followPeerId: null,
      localCaretLine: null,
      peers: [],
    }))
  },
}))

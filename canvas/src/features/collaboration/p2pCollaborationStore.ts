import { create } from 'zustand'
import {
  buildDefaultCollaborationDisplayName,
  type P2PCollaborationPhase,
  type P2PCollaborationRole,
} from './p2pCollaborationProtocol'

export type P2PCollaborationCommandKind = 'start-host' | 'join-invite' | 'apply-answer' | 'disconnect'

export type P2PCollaborationCommand = {
  id: number
  kind: P2PCollaborationCommandKind
}

export type P2PCollaborationRemotePeer = {
  peerId: string
  displayName: string
  documentKey: string
  caretLine: number | null
  connectedAt: number
  lastSeenAt: number
}

type P2PCollaborationStoreState = {
  displayName: string
  role: P2PCollaborationRole
  phase: P2PCollaborationPhase
  statusText: string
  errorText: string
  sessionId: string | null
  inviteInput: string
  inviteToken: string
  inviteUrl: string
  answerInput: string
  answerToken: string
  followModeEnabled: boolean
  localCaretLine: number | null
  remotePeer: P2PCollaborationRemotePeer | null
  pendingCommand: P2PCollaborationCommand | null
  commandSeq: number
  setDisplayName: (value: string) => void
  setInviteInput: (value: string) => void
  setAnswerInput: (value: string) => void
  setFollowModeEnabled: (value: boolean) => void
  setLocalCaretLine: (value: number | null) => void
  seedInviteInputFromLocation: (value: string) => void
  queueStartHost: () => void
  queueJoinInvite: () => void
  queueApplyAnswer: () => void
  queueDisconnect: () => void
  markPreparingHost: () => void
  markAwaitingAnswer: (args: { sessionId: string; inviteToken: string; inviteUrl: string }) => void
  markPreparingGuest: () => void
  markAwaitingHost: (args: { sessionId: string; answerToken: string }) => void
  markConnecting: (args: { role: P2PCollaborationRole; sessionId: string | null; statusText?: string }) => void
  markConnected: (args: { role: 'host' | 'guest'; sessionId: string; remotePeer: P2PCollaborationRemotePeer }) => void
  updateRemotePeer: (value: P2PCollaborationRemotePeer | null) => void
  setRuntimeStatus: (statusText: string) => void
  setRuntimeError: (errorText: string) => void
  resetSession: (statusText?: string) => void
}

const initialState = (): Pick<
  P2PCollaborationStoreState,
  | 'displayName'
  | 'role'
  | 'phase'
  | 'statusText'
  | 'errorText'
  | 'sessionId'
  | 'inviteInput'
  | 'inviteToken'
  | 'inviteUrl'
  | 'answerInput'
  | 'answerToken'
  | 'followModeEnabled'
  | 'localCaretLine'
  | 'remotePeer'
  | 'pendingCommand'
  | 'commandSeq'
> => ({
  displayName: buildDefaultCollaborationDisplayName(),
  role: 'idle',
  phase: 'idle',
  statusText: 'Idle',
  errorText: '',
  sessionId: null,
  inviteInput: '',
  inviteToken: '',
  inviteUrl: '',
  answerInput: '',
  answerToken: '',
  followModeEnabled: false,
  localCaretLine: null,
  remotePeer: null,
  pendingCommand: null,
  commandSeq: 0,
})

function nextCommand(kind: P2PCollaborationCommandKind, commandSeq: number): P2PCollaborationCommand {
  return { id: commandSeq + 1, kind }
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
  markPreparingHost: () => {
    set({
      role: 'host',
      phase: 'preparing-invite',
      statusText: 'Preparing invite…',
      errorText: '',
      sessionId: null,
      inviteToken: '',
      inviteUrl: '',
      answerInput: '',
      answerToken: '',
      remotePeer: null,
    })
  },
  markAwaitingAnswer: ({ sessionId, inviteToken, inviteUrl }) => {
    set({
      role: 'host',
      phase: 'awaiting-answer',
      statusText: 'Invite ready. Waiting for guest answer…',
      errorText: '',
      sessionId,
      inviteToken,
      inviteUrl,
      remotePeer: null,
    })
  },
  markPreparingGuest: () => {
    set({
      role: 'guest',
      phase: 'preparing-answer',
      statusText: 'Preparing guest answer…',
      errorText: '',
      sessionId: null,
      answerToken: '',
      remotePeer: null,
    })
  },
  markAwaitingHost: ({ sessionId, answerToken }) => {
    set({
      role: 'guest',
      phase: 'awaiting-host',
      statusText: 'Answer ready. Send it back to the host.',
      errorText: '',
      sessionId,
      answerToken,
    })
  },
  markConnecting: ({ role, sessionId, statusText }) => {
    set({
      role,
      phase: 'connecting',
      sessionId,
      statusText: statusText || 'Connecting peer session…',
      errorText: '',
    })
  },
  markConnected: ({ role, sessionId, remotePeer }) => {
    set({
      role,
      phase: 'connected',
      statusText: `Connected to ${remotePeer.displayName}`,
      errorText: '',
      sessionId,
      remotePeer,
    })
  },
  updateRemotePeer: value => {
    set(state => {
      if (
        state.remotePeer?.peerId === value?.peerId
        && state.remotePeer?.documentKey === value?.documentKey
        && state.remotePeer?.caretLine === value?.caretLine
        && state.remotePeer?.lastSeenAt === value?.lastSeenAt
      ) {
        return state
      }
      return { remotePeer: value }
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
      inviteToken: '',
      inviteUrl: '',
      answerToken: '',
      localCaretLine: null,
      remotePeer: null,
    }))
  },
}))

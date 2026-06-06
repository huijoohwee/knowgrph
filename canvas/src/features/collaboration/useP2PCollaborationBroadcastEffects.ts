import React from 'react'
import {
  buildDocumentSignature,
  type MutableRefValue,
  type RuntimeSessionRefs,
} from './p2pCollaborationRuntimeState'

type UseP2PCollaborationBroadcastEffectsArgs = {
  active: boolean
  activeDocumentKey: string
  activeText: string
  displayName: string
  followPeerId: string | null
  localCaretLine: number | null
  runtimeRefs: MutableRefValue<RuntimeSessionRefs>
  suppressOutboundDocumentSigRef: MutableRefValue<string | null>
  lastOutboundDocumentSigRef: MutableRefValue<string | null>
  broadcastLocalDocument: () => void
  broadcastLocalHello: () => void
  broadcastLocalPresence: () => void
  broadcastRosterToGuests: () => void
  ensureLocalPeer: (connectionState: 'connecting' | 'connected') => void
}

const hasOpenRuntimeChannel = (runtime: RuntimeSessionRefs): boolean => {
  return runtime.role === 'guest'
    ? Boolean(runtime.guestConnection?.channel && runtime.guestConnection.channel.readyState === 'open')
    : Array.from(runtime.hostConnectionsByPeerId.values()).some(connectionRef => connectionRef.channel?.readyState === 'open')
}

export function useP2PCollaborationBroadcastEffects(args: UseP2PCollaborationBroadcastEffectsArgs): void {
  React.useEffect(() => {
    if (!args.active) return
    const runtime = args.runtimeRefs.current
    if (!hasOpenRuntimeChannel(runtime)) return
    const documentKey = String(args.activeDocumentKey || '').trim()
    if (!documentKey) return
    const documentSignature = buildDocumentSignature(documentKey, args.activeText)
    if (args.suppressOutboundDocumentSigRef.current === documentSignature) {
      args.suppressOutboundDocumentSigRef.current = null
      args.lastOutboundDocumentSigRef.current = documentSignature
      return
    }
    if (args.lastOutboundDocumentSigRef.current === documentSignature) return
    const timerId = window.setTimeout(() => {
      args.broadcastLocalDocument()
    }, 180)
    return () => window.clearTimeout(timerId)
  }, [
    args,
    args.active,
    args.activeDocumentKey,
    args.activeText,
    args.broadcastLocalDocument,
  ])

  React.useEffect(() => {
    if (!args.active) return
    const runtime = args.runtimeRefs.current
    if (!hasOpenRuntimeChannel(runtime)) return
    args.ensureLocalPeer('connected')
    const timerId = window.setTimeout(() => {
      args.broadcastLocalPresence()
      args.broadcastLocalHello()
      if (runtime.role === 'host') args.broadcastRosterToGuests()
    }, 80)
    return () => window.clearTimeout(timerId)
  }, [
    args,
    args.active,
    args.activeDocumentKey,
    args.broadcastLocalHello,
    args.broadcastLocalPresence,
    args.broadcastRosterToGuests,
    args.displayName,
    args.ensureLocalPeer,
    args.followPeerId,
    args.localCaretLine,
  ])
}

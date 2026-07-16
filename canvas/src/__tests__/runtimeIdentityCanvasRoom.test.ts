import { KnowgrphCanvasSyncRoom } from '../../../cloudflare/workers/knowgrph-storage/canvasSyncRoom'
import { KNOWGRPH_RUNTIME_IDENTITY_ROOM_ID } from '@/lib/storage/knowgrphRuntimeIdentityRoomContract'
import {
  deriveAuthenticatedDevicePrincipalId,
  normalizeKnowgrphClientDeviceId,
} from '../../../cloudflare/workers/knowgrph-storage/devicePrincipal'

type SentMessage = Record<string, unknown> & { type?: string }

export async function testRuntimeIdentityCanvasRoomEnforcesAuthenticatedSessionBoundary(): Promise<void> {
  let attachment: Record<string, unknown> = {
    workspaceId: 'kgws:canonical-docs',
    roomId: KNOWGRPH_RUNTIME_IDENTITY_ROOM_ID,
    userId: 'user-a',
    sessionId: 'session-a',
    devicePrincipalId: '1'.repeat(64),
    displayName: 'Device A',
    role: 'editor',
    joinedAt: Date.now(),
    caretLine: null,
    runtimeDevice: null,
    runtimeInstanceId: null,
  }
  const sent: SentMessage[] = []
  const socket = {
    readyState: 1,
    send: (text: string) => sent.push(JSON.parse(text) as SentMessage),
    deserializeAttachment: () => attachment,
    serializeAttachment: (next: unknown) => { attachment = next as Record<string, unknown> },
  } as unknown as WebSocket
  const room = new KnowgrphCanvasSyncRoom({
    storage: { put: async () => undefined },
    getWebSockets: () => [socket],
  })

  await room.webSocketMessage(socket, JSON.stringify({ type: 'runtime.identity.challenge.request' }))
  const challenge = sent.find(message => message.type === 'runtime.identity.challenge')
  if (!challenge || typeof challenge.challenge !== 'string') {
    throw new Error(`Expected dedicated identity room to issue a challenge, got ${JSON.stringify(sent)}`)
  }

  const attestation = {
    schema: 'knowgrph-runtime-identity-attestation/v1',
    sessionId: KNOWGRPH_RUNTIME_IDENTITY_ROOM_ID,
    challenge: challenge.challenge,
    runtimeInstanceId: 'runtime-a',
    identityDigest: 'a'.repeat(64),
    identity: { device: 'device-a' },
  }
  await room.webSocketMessage(socket, JSON.stringify({ type: 'runtime.identity.attestation', attestation }))
  const authenticatedRelay = sent.find(message => message.type === 'runtime.identity.attested')
  if (
    authenticatedRelay?.authenticatedPeerId !== 'user-a'
    || authenticatedRelay.authenticatedSessionId !== 'session-a'
    || authenticatedRelay.authenticatedDevicePrincipalId !== '1'.repeat(64)
    || attachment.runtimeDevice !== 'device-a'
    || attachment.runtimeInstanceId !== 'runtime-a'
  ) {
    throw new Error(`Expected authenticated attestation relay and immutable socket binding, got ${JSON.stringify(sent)}`)
  }

  await room.webSocketMessage(socket, JSON.stringify({
    type: 'runtime.identity.attestation',
    attestation: {
      ...attestation,
      runtimeInstanceId: 'runtime-b',
      identity: { device: 'device-b' },
    },
  }))
  await room.webSocketMessage(socket, JSON.stringify({ type: 'document.sync', documentKey: 'forbidden', text: 'forbidden' }))
  const errors = sent.filter(message => message.type === 'error').map(message => message.error)
  if (
    !errors.includes('runtime identity cannot change within an authenticated room session')
    || !errors.includes('identity room accepts attestation messages only')
  ) {
    throw new Error(`Expected identity room to reject socket identity mutation and document traffic, got ${JSON.stringify(errors)}`)
  }
}

export async function testRuntimeIdentityDevicePrincipalIsOpaqueAndStable(): Promise<void> {
  const identityScope = {
    workspaceId: 'kgws:canonical-docs',
    userId: 'user-a',
  }
  const deviceId = 'dev:device-a-1234567890'
  const first = await deriveAuthenticatedDevicePrincipalId({ ...identityScope, deviceId })
  const second = await deriveAuthenticatedDevicePrincipalId({ ...identityScope, deviceId })
  const different = await deriveAuthenticatedDevicePrincipalId({
    ...identityScope,
    deviceId: 'dev:device-b-1234567890',
  })
  const differentUser = await deriveAuthenticatedDevicePrincipalId({
    ...identityScope,
    userId: 'user-b',
    deviceId,
  })
  if (
    !/^[0-9a-f]{64}$/.test(first)
    || first !== second
    || first === different
    || first === differentUser
    || normalizeKnowgrphClientDeviceId('short') !== ''
  ) {
    throw new Error('Expected stable opaque principals only for valid persistent client device ids')
  }
}

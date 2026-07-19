import {
  readThreeKeyboardMovementKeys,
  resolveThreeKeyboardCommandAmount,
} from '@/features/three/threeKeyboardChoreography'

export type CameraKeyboardInvocationTokens = Readonly<{
  animate: string
  camera: string
  cameraMotion: string
  cameraShot: string
  frame: string
  selectedActor: string
}>

export function buildCameraKeyboardInvocationFromTokens(
  tokens: CameraKeyboardInvocationTokens,
  input: Readonly<{
    action: 'animate' | 'frame'
    keys: Iterable<string>
    amount?: number
    fine?: boolean
    markId?: string
    target?: 'camera' | 'selected-actor'
  }>,
): string {
  const keys = readThreeKeyboardMovementKeys(input.keys)
  const fine = input.fine === true
  const amount = keys ? resolveThreeKeyboardCommandAmount({ amount: input.amount, fine, target: 'camera' }) : null
  const markId = String(input.markId || '').trim()
  if (!keys || amount === null || (markId && (input.action !== 'animate' || !/^[a-zA-Z0-9:._-]+$/.test(markId)))) return ''
  const command = input.action === 'frame' ? tokens.frame : tokens.animate
  const semantic = input.action === 'frame' ? tokens.cameraShot : tokens.cameraMotion
  const binding = input.target === 'selected-actor' ? tokens.selectedActor : tokens.camera
  const parameters = [
    `keys=${keys.join('+')}`,
    ...(input.amount === undefined ? [] : [`amount=${Number(amount.toFixed(3))}`]),
    ...(fine ? ['fine=true'] : []),
    ...(markId ? [`markId=${markId}`] : []),
  ]
  return `${command} ${binding} ${semantic} ${parameters.join(' ')}`
}

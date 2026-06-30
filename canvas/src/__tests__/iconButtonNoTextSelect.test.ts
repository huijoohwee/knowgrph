import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testIconButtonPointerDownPreventsTextSelection = () => {
  const root = process.cwd()
  const iconButtonPath = path.resolve(root, 'src', 'components', 'IconButton.tsx')
  const text = readUtf8(iconButtonPath)
  if (!text.includes('onPointerDown={e => {')) throw new Error('Expected IconButton to handle onPointerDown')
  if (!text.includes('e.preventDefault()')) throw new Error('Expected IconButton to call preventDefault to avoid text selection')
  if (!text.includes('onPointerUp={e => {') || !text.includes('pointerActivationHandledRef.current = true')) {
    throw new Error('Expected IconButton to activate from pointerup when prevented pointerdown suppresses click')
  }
  if (!text.includes('if (pointerActivationHandledRef.current)') || !text.includes('pointerActivationHandledRef.current = false')) {
    throw new Error('Expected IconButton native click handler to skip duplicate pointer activations')
  }
}

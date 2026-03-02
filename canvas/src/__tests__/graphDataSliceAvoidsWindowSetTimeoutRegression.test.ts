import fs from 'node:fs'
import path from 'node:path'

export function testGraphDataSliceAvoidsWindowSetTimeout() {
  const filePath = path.resolve(process.cwd(), 'src/hooks/store/graphDataSlice.ts')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (text.includes('window.setTimeout')) {
    throw new Error('Expected graphDataSlice to avoid window.setTimeout (use global timers instead)')
  }
}


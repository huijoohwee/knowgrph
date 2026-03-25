import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testComposedPositionWritebackIsManualOnly() {
  const p = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSlice.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('composedPendingPositionWriteTimer')) {
    throw new Error('expected composed position writeback to avoid timers')
  }
  if (text.includes('scheduleFlushComposedPositionWrites')) {
    throw new Error('expected composed position writeback to not be auto-scheduled')
  }
  if (!text.includes('flushComposedPositionWritesNow')) {
    throw new Error('expected explicit composed position flush function')
  }
}


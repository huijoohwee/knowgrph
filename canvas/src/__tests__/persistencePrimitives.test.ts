import { readNumFromStorage, writeNumToStorage, readBoolFromStorage, writeBoolToStorage, readIntFromStorage, writeIntToStorage } from '@/lib/persistence'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export function testPersistencePrimitives() {
  const storage = new MemoryStorage()

  const numEmpty = readNumFromStorage(storage, 'k-num', 0.5)
  if (numEmpty !== 0.5) {
    throw new Error('expected numeric fallback when storage empty')
  }

  storage.setItem('k-num', '0.2')
  const numLow = readNumFromStorage(storage, 'k-num', 0.5)
  if (numLow !== 0.2) {
    throw new Error('expected parsed numeric value')
  }

  storage.setItem('k-num', '2.5')
  const numClampedHigh = readNumFromStorage(storage, 'k-num', 0.5)
  if (numClampedHigh !== 1) {
    throw new Error('expected numeric value to be clamped to 1')
  }

  const writtenNum = writeNumToStorage(storage, 'k-num-write', 1.5)
  if (writtenNum !== 1) {
    throw new Error('expected writeNumToStorage to clamp to 1')
  }
  const rawWrittenNum = storage.getItem('k-num-write')
  if (rawWrittenNum !== '1') {
    throw new Error('expected storage to contain clamped numeric string')
  }

  const boolEmpty = readBoolFromStorage(storage, 'k-bool', true)
  if (boolEmpty !== true) {
    throw new Error('expected boolean fallback when storage empty')
  }

  storage.setItem('k-bool', '1')
  const boolTrue = readBoolFromStorage(storage, 'k-bool', false)
  if (boolTrue !== true) {
    throw new Error('expected true when storage contains 1')
  }

  storage.setItem('k-bool', 'false')
  const boolFalse = readBoolFromStorage(storage, 'k-bool', true)
  if (boolFalse !== false) {
    throw new Error('expected false when storage contains false')
  }

  const writtenBoolTrue = writeBoolToStorage(storage, 'k-bool-write', true)
  if (writtenBoolTrue !== true) {
    throw new Error('expected writeBoolToStorage to return true')
  }
  const rawBoolTrue = storage.getItem('k-bool-write')
  if (rawBoolTrue !== '1') {
    throw new Error('expected storage to contain 1 for true')
  }

  const writtenBoolFalse = writeBoolToStorage(storage, 'k-bool-write', false)
  if (writtenBoolFalse !== false) {
    throw new Error('expected writeBoolToStorage to return false')
  }
  const rawBoolFalse = storage.getItem('k-bool-write')
  if (rawBoolFalse !== '0') {
    throw new Error('expected storage to contain 0 for false')
  }

  const intEmpty = readIntFromStorage(storage, 'k-int', 10)
  if (intEmpty !== 10) {
    throw new Error('expected int fallback when storage empty')
  }

  storage.setItem('k-int', '42')
  const intParsed = readIntFromStorage(storage, 'k-int', 10)
  if (intParsed !== 42) {
    throw new Error('expected parsed int value')
  }

  const writtenIntDefaultBounds = writeIntToStorage(storage, 'k-int-write', 0)
  if (writtenIntDefaultBounds !== 1) {
    throw new Error('expected int to respect default min bound')
  }
  const rawIntDefaultBounds = storage.getItem('k-int-write')
  if (rawIntDefaultBounds !== '1') {
    throw new Error('expected storage to contain clamped min int')
  }

  const writtenIntWithBounds = writeIntToStorage(storage, 'k-int-write2', 5000, { min: 10, max: 100 })
  if (writtenIntWithBounds !== 100) {
    throw new Error('expected int to respect max bound')
  }
  const rawIntWithBounds = storage.getItem('k-int-write2')
  if (rawIntWithBounds !== '100') {
    throw new Error('expected storage to contain clamped max int')
  }
}

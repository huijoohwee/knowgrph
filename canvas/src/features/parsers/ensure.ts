import { builtInParsers } from './default'
import { listParsers, registerParser } from './registry'

export function ensureBuiltInParsersRegistered(): void {
  if (listParsers().length > 0) return
  builtInParsers.forEach(spec => registerParser(spec))
}


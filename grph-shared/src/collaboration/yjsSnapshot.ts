import * as Y from 'yjs'
import { hashStringToHex } from '../hash/stringHash.js'

export type CollaborationDocumentKind = 'markdown' | 'json'

export type CollaborationJsonValue =
  | null
  | boolean
  | number
  | string
  | CollaborationJsonValue[]
  | { [key: string]: CollaborationJsonValue }

export const YJS_MARKDOWN_TEXT_NAME = 'markdown'
export const YJS_JSON_MAP_NAME = 'json'

const JSON_ROOT_VALUE_KEY = '__collaboration_yjs_json_root_value__'

const normalizeString = (value: unknown): string => String(value || '').trim()

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const resolveCollaborationDocumentKind = (documentKey: string): CollaborationDocumentKind | null => {
  const key = normalizeString(documentKey).toLowerCase()
  if (!key) return null
  if (key.endsWith('.md') || key.endsWith('.markdown') || key.endsWith('.mdx')) return 'markdown'
  if (key.endsWith('.json')) return 'json'
  return null
}

export const canEditRawJsonForCollaboration = (args: {
  documentKind: CollaborationDocumentKind | null
  activePeerCount: number
}): boolean => {
  if (args.documentKind !== 'json') return true
  return Math.max(0, Math.floor(Number(args.activePeerCount || 0))) < 2
}

const normalizeJsonValue = (value: unknown): CollaborationJsonValue => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(item => normalizeJsonValue(item))
  if (isPlainRecord(value)) {
    const out: Record<string, CollaborationJsonValue> = {}
    const keys = Object.keys(value).sort()
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      out[key] = normalizeJsonValue(value[key])
    }
    return out
  }
  return null
}

export const parseCollaborationJsonText = (text: string): CollaborationJsonValue => {
  const raw = String(text || '').trim()
  if (!raw) return {}
  return normalizeJsonValue(JSON.parse(raw))
}

export const formatCollaborationJson = (value: unknown): string =>
  `${JSON.stringify(normalizeJsonValue(value), null, 2)}\n`

const clearYMap = (map: Y.Map<unknown>): void => {
  const keys = Array.from(map.keys())
  for (let i = 0; i < keys.length; i += 1) {
    map.delete(keys[i]!)
  }
}

const toYValue = (value: CollaborationJsonValue): unknown => {
  if (Array.isArray(value)) {
    const array = new Y.Array<unknown>()
    array.insert(0, value.map(item => toYValue(item)))
    return array
  }
  if (isPlainRecord(value)) {
    const map = new Y.Map<unknown>()
    const keys = Object.keys(value).sort()
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      map.set(key, toYValue(value[key] as CollaborationJsonValue))
    }
    return map
  }
  return value
}

const fromYValue = (value: unknown): CollaborationJsonValue => {
  if (value instanceof Y.Map) {
    const out: Record<string, CollaborationJsonValue> = {}
    const keys = Array.from(value.keys()).sort()
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      out[key] = fromYValue(value.get(key))
    }
    return out
  }
  if (value instanceof Y.Array) {
    return value.toArray().map(item => fromYValue(item))
  }
  return normalizeJsonValue(value)
}

const setJsonRoot = (root: Y.Map<unknown>, value: CollaborationJsonValue): void => {
  clearYMap(root)
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort()
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      root.set(key, toYValue(value[key] as CollaborationJsonValue))
    }
    return
  }
  root.set(JSON_ROOT_VALUE_KEY, toYValue(value))
}

const readJsonRoot = (root: Y.Map<unknown>): CollaborationJsonValue => {
  if (root.size === 1 && root.has(JSON_ROOT_VALUE_KEY)) return fromYValue(root.get(JSON_ROOT_VALUE_KEY))
  const out: Record<string, CollaborationJsonValue> = {}
  const keys = Array.from(root.keys()).sort()
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]!
    out[key] = fromYValue(root.get(key))
  }
  return out
}

const readObjectRootMap = (root: Y.Map<unknown>): Y.Map<unknown> | null => {
  return root.size === 1 && root.has(JSON_ROOT_VALUE_KEY) ? null : root
}

const readCommonPrefixLength = (left: string, right: string): number => {
  const max = Math.min(left.length, right.length)
  let index = 0
  while (index < max && left.charCodeAt(index) === right.charCodeAt(index)) index += 1
  return index
}

const readCommonSuffixLength = (left: string, right: string, prefixLength: number): number => {
  const max = Math.min(left.length, right.length) - prefixLength
  let length = 0
  while (
    length < max
    && left.charCodeAt(left.length - 1 - length) === right.charCodeAt(right.length - 1 - length)
  ) {
    length += 1
  }
  return length
}

type Base64Runtime = {
  btoa?: (value: string) => string
  atob?: (value: string) => string
  Buffer?: {
    from: (value: Uint8Array | string, encoding?: string) => {
      length: number
      [index: number]: number
      toString: (encoding?: string) => string
    }
  }
}

const readBase64Runtime = (): Base64Runtime => globalThis as unknown as Base64Runtime

export const createCollaborationYDoc = (args: {
  documentKey: string
  documentKind: CollaborationDocumentKind
  initialText?: string | null
}): Y.Doc => {
  const documentKey = normalizeString(args.documentKey)
  const doc = new Y.Doc({
    guid: `collaboration:${hashStringToHex(`${args.documentKind}:${documentKey}`)}`,
    gc: true,
    meta: {
      documentKey,
      documentKind: args.documentKind,
    },
  })
  if (args.documentKind === 'markdown') {
    const text = doc.getText(YJS_MARKDOWN_TEXT_NAME)
    const initialText = String(args.initialText || '')
    if (initialText) text.insert(0, initialText)
    return doc
  }
  const root = doc.getMap<unknown>(YJS_JSON_MAP_NAME)
  setJsonRoot(root, parseCollaborationJsonText(String(args.initialText || '{}')))
  return doc
}

export const serializeCollaborationYDoc = (args: {
  doc: Y.Doc
  documentKind: CollaborationDocumentKind
}): string => {
  if (args.documentKind === 'markdown') {
    return args.doc.getText(YJS_MARKDOWN_TEXT_NAME).toString()
  }
  return formatCollaborationJson(readJsonRoot(args.doc.getMap<unknown>(YJS_JSON_MAP_NAME)))
}

export const applySourceTextToCollaborationYDoc = (args: {
  doc: Y.Doc
  documentKind: CollaborationDocumentKind
  text: string
  origin?: unknown
}): boolean => {
  const nextText = String(args.text || '')
  const currentText = serializeCollaborationYDoc({ doc: args.doc, documentKind: args.documentKind })
  if (args.documentKind === 'markdown') {
    if (currentText === nextText) return false
    args.doc.transact(() => {
      const yText = args.doc.getText(YJS_MARKDOWN_TEXT_NAME)
      const prefixLength = readCommonPrefixLength(currentText, nextText)
      const suffixLength = readCommonSuffixLength(currentText, nextText, prefixLength)
      const deleteLength = currentText.length - prefixLength - suffixLength
      const insertText = nextText.slice(prefixLength, nextText.length - suffixLength)
      if (deleteLength > 0) yText.delete(prefixLength, deleteLength)
      if (insertText) yText.insert(prefixLength, insertText)
    }, args.origin)
    return true
  }
  const nextJson = parseCollaborationJsonText(nextText)
  const nextCanonical = formatCollaborationJson(nextJson)
  if (currentText === nextCanonical) return false
  args.doc.transact(() => {
    setJsonRoot(args.doc.getMap<unknown>(YJS_JSON_MAP_NAME), nextJson)
  }, args.origin)
  return true
}

export const setCollaborationJsonObjectField = (args: {
  doc: Y.Doc
  key: string
  value: unknown
  origin?: unknown
}): void => {
  const key = normalizeString(args.key)
  if (!key) return
  args.doc.transact(() => {
    const root = args.doc.getMap<unknown>(YJS_JSON_MAP_NAME)
    let objectRoot = readObjectRootMap(root)
    if (!objectRoot) {
      clearYMap(root)
      objectRoot = root
    }
    objectRoot.set(key, toYValue(normalizeJsonValue(args.value)))
  }, args.origin)
}

export const encodeYjsUpdateBase64 = (update: Uint8Array): string => {
  const runtime = readBase64Runtime()
  if (typeof runtime.btoa !== 'function' && runtime.Buffer) return runtime.Buffer.from(update).toString('base64')
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < update.length; i += chunkSize) {
    const chunk = update.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  if (typeof runtime.btoa === 'function') return runtime.btoa(binary)
  throw new Error('base64 encoding is unavailable')
}

export const decodeYjsUpdateBase64 = (value: string): Uint8Array => {
  const raw = normalizeString(value)
  if (!raw) return new Uint8Array()
  const runtime = readBase64Runtime()
  if (typeof runtime.atob !== 'function' && runtime.Buffer) {
    const buffer = runtime.Buffer.from(raw, 'base64')
    const bytes = new Uint8Array(buffer.length)
    for (let i = 0; i < buffer.length; i += 1) bytes[i] = buffer[i] || 0
    return bytes
  }
  if (typeof runtime.atob !== 'function') throw new Error('base64 decoding is unavailable')
  const binary = runtime.atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const encodeCollaborationYDocStateBase64 = (doc: Y.Doc): string =>
  encodeYjsUpdateBase64(Y.encodeStateAsUpdate(doc))

export const applyYjsUpdateBase64 = (args: {
  doc: Y.Doc
  updateBase64: string
  origin?: unknown
}): boolean => {
  const update = decodeYjsUpdateBase64(args.updateBase64)
  if (update.length === 0) return false
  Y.applyUpdate(args.doc, update, args.origin)
  return true
}

export const serializeCollaborationYDocStateBase64 = (args: {
  documentKind: CollaborationDocumentKind
  yjsStateBase64: string
  documentKey?: string | null
}): string => {
  const doc = createCollaborationYDoc({
    documentKey: args.documentKey || `snapshot.${args.documentKind === 'json' ? 'json' : 'md'}`,
    documentKind: args.documentKind,
    initialText: args.documentKind === 'json' ? '{}' : '',
  })
  applyYjsUpdateBase64({ doc, updateBase64: args.yjsStateBase64 })
  return serializeCollaborationYDoc({ doc, documentKind: args.documentKind })
}

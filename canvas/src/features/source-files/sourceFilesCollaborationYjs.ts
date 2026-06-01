import * as Y from 'yjs'
import { hashStringToHex } from '@/lib/hash/stringHash'

export type KnowgrphCollaborationDocumentKind = 'markdown' | 'json'

export type KnowgrphJsonValue =
  | null
  | boolean
  | number
  | string
  | KnowgrphJsonValue[]
  | { [key: string]: KnowgrphJsonValue }

export const KNOWGRPH_YJS_MARKDOWN_TEXT_NAME = 'markdown'
export const KNOWGRPH_YJS_JSON_MAP_NAME = 'json'

const JSON_ROOT_VALUE_KEY = '__kg_yjs_json_root_value__'

const normalizeString = (value: unknown): string => String(value || '').trim()

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const resolveKnowgrphCollaborationDocumentKind = (documentKey: string): KnowgrphCollaborationDocumentKind | null => {
  const key = normalizeString(documentKey).toLowerCase()
  if (!key) return null
  if (key.endsWith('.md') || key.endsWith('.markdown') || key.endsWith('.mdx')) return 'markdown'
  if (key.endsWith('.json')) return 'json'
  return null
}

export const canEditRawJsonForKnowgrphCollaboration = (args: {
  documentKind: KnowgrphCollaborationDocumentKind | null
  activePeerCount: number
}): boolean => {
  if (args.documentKind !== 'json') return true
  return Math.max(0, Math.floor(Number(args.activePeerCount || 0))) < 2
}

const normalizeJsonValue = (value: unknown): KnowgrphJsonValue => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(item => normalizeJsonValue(item))
  if (isPlainRecord(value)) {
    const out: Record<string, KnowgrphJsonValue> = {}
    const keys = Object.keys(value).sort()
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      out[key] = normalizeJsonValue(value[key])
    }
    return out
  }
  return null
}

export const parseKnowgrphCollaborationJsonText = (text: string): KnowgrphJsonValue => {
  const raw = String(text || '').trim()
  if (!raw) return {}
  return normalizeJsonValue(JSON.parse(raw))
}

export const formatKnowgrphCollaborationJson = (value: unknown): string =>
  `${JSON.stringify(normalizeJsonValue(value), null, 2)}\n`

const clearYMap = (map: Y.Map<unknown>): void => {
  const keys = Array.from(map.keys())
  for (let i = 0; i < keys.length; i += 1) {
    map.delete(keys[i]!)
  }
}

const toYValue = (value: KnowgrphJsonValue): unknown => {
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
      map.set(key, toYValue(value[key] as KnowgrphJsonValue))
    }
    return map
  }
  return value
}

const fromYValue = (value: unknown): KnowgrphJsonValue => {
  if (value instanceof Y.Map) {
    const out: Record<string, KnowgrphJsonValue> = {}
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

const setJsonRoot = (root: Y.Map<unknown>, value: KnowgrphJsonValue): void => {
  clearYMap(root)
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort()
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      root.set(key, toYValue(value[key] as KnowgrphJsonValue))
    }
    return
  }
  root.set(JSON_ROOT_VALUE_KEY, toYValue(value))
}

const readJsonRoot = (root: Y.Map<unknown>): KnowgrphJsonValue => {
  if (root.size === 1 && root.has(JSON_ROOT_VALUE_KEY)) return fromYValue(root.get(JSON_ROOT_VALUE_KEY))
  const out: Record<string, KnowgrphJsonValue> = {}
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

export const createKnowgrphCollaborationYDoc = (args: {
  documentKey: string
  documentKind: KnowgrphCollaborationDocumentKind
  initialText?: string | null
}): Y.Doc => {
  const documentKey = normalizeString(args.documentKey)
  const doc = new Y.Doc({
    guid: `knowgrph:${hashStringToHex(`${args.documentKind}:${documentKey}`)}`,
    gc: true,
    meta: {
      documentKey,
      documentKind: args.documentKind,
    },
  })
  if (args.documentKind === 'markdown') {
    const text = doc.getText(KNOWGRPH_YJS_MARKDOWN_TEXT_NAME)
    const initialText = String(args.initialText || '')
    if (initialText) text.insert(0, initialText)
    return doc
  }
  const root = doc.getMap<unknown>(KNOWGRPH_YJS_JSON_MAP_NAME)
  setJsonRoot(root, parseKnowgrphCollaborationJsonText(String(args.initialText || '{}')))
  return doc
}

export const serializeKnowgrphCollaborationYDoc = (args: {
  doc: Y.Doc
  documentKind: KnowgrphCollaborationDocumentKind
}): string => {
  if (args.documentKind === 'markdown') {
    return args.doc.getText(KNOWGRPH_YJS_MARKDOWN_TEXT_NAME).toString()
  }
  return formatKnowgrphCollaborationJson(readJsonRoot(args.doc.getMap<unknown>(KNOWGRPH_YJS_JSON_MAP_NAME)))
}

export const applySourceTextToKnowgrphCollaborationYDoc = (args: {
  doc: Y.Doc
  documentKind: KnowgrphCollaborationDocumentKind
  text: string
  origin?: unknown
}): boolean => {
  const nextText = String(args.text || '')
  const currentText = serializeKnowgrphCollaborationYDoc({ doc: args.doc, documentKind: args.documentKind })
  if (args.documentKind === 'markdown') {
    if (currentText === nextText) return false
    args.doc.transact(() => {
      const yText = args.doc.getText(KNOWGRPH_YJS_MARKDOWN_TEXT_NAME)
      const prefixLength = readCommonPrefixLength(currentText, nextText)
      const suffixLength = readCommonSuffixLength(currentText, nextText, prefixLength)
      const deleteLength = currentText.length - prefixLength - suffixLength
      const insertText = nextText.slice(prefixLength, nextText.length - suffixLength)
      if (deleteLength > 0) yText.delete(prefixLength, deleteLength)
      if (insertText) yText.insert(prefixLength, insertText)
    }, args.origin)
    return true
  }
  const nextJson = parseKnowgrphCollaborationJsonText(nextText)
  const nextCanonical = formatKnowgrphCollaborationJson(nextJson)
  if (currentText === nextCanonical) return false
  args.doc.transact(() => {
    setJsonRoot(args.doc.getMap<unknown>(KNOWGRPH_YJS_JSON_MAP_NAME), nextJson)
  }, args.origin)
  return true
}

export const setKnowgrphCollaborationJsonObjectField = (args: {
  doc: Y.Doc
  key: string
  value: unknown
  origin?: unknown
}): void => {
  const key = normalizeString(args.key)
  if (!key) return
  args.doc.transact(() => {
    const root = args.doc.getMap<unknown>(KNOWGRPH_YJS_JSON_MAP_NAME)
    let objectRoot = readObjectRootMap(root)
    if (!objectRoot) {
      clearYMap(root)
      objectRoot = root
    }
    objectRoot.set(key, toYValue(normalizeJsonValue(args.value)))
  }, args.origin)
}

export const encodeKnowgrphYjsUpdateBase64 = (update: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') return Buffer.from(update).toString('base64')
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < update.length; i += chunkSize) {
    const chunk = update.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export const decodeKnowgrphYjsUpdateBase64 = (value: string): Uint8Array => {
  const raw = normalizeString(value)
  if (!raw) return new Uint8Array()
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(raw, 'base64'))
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const encodeKnowgrphCollaborationYDocStateBase64 = (doc: Y.Doc): string =>
  encodeKnowgrphYjsUpdateBase64(Y.encodeStateAsUpdate(doc))

export const applyKnowgrphYjsUpdateBase64 = (args: {
  doc: Y.Doc
  updateBase64: string
  origin?: unknown
}): boolean => {
  const update = decodeKnowgrphYjsUpdateBase64(args.updateBase64)
  if (update.length === 0) return false
  Y.applyUpdate(args.doc, update, args.origin)
  return true
}

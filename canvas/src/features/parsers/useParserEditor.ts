import { useCallback, useEffect, useState } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useParserUIState } from '@/features/parsers/uiState'
import { validateTransforms } from '@/features/parsers/schema'
import { pickTextFileWithExtensions } from '@/lib/graph/file'
import { readCustomParsers, upsertCustomParser } from '@/features/parsers/persistence'
import { toParserSpec } from '@/features/parsers/custom'
import { registerParser } from '@/features/parsers/registry'
import { invalidateParserCache, getCachedParse, setCachedParse, applyParserAsync, bestMatch, toParserId } from '@/features/parsers'
import yaml from 'js-yaml'
import { UI_COPY } from '@/lib/config'
import { hashText } from './hash'

export function useParserEditor() {
  const setGraphData = useGraphStore(s => s.setGraphData)
  const parserSelectedId = useParserUIState(s => s.selectedId)
  const parserInputName = useParserUIState(s => s.inputName)
  const parserInputText = useParserUIState(s => s.inputText)
  const parserScriptText = useParserUIState(s => s.scriptText)
  const preferredLanguage = useParserUIState(s => s.preferredLanguage)
  const [parserLanguage, setParserLanguage] = useState<'json'|'text'|'yaml'>('text')
  const [parserError, setParserError] = useState('')

  const onLoadParserFile = useCallback(async (): Promise<{ ok: boolean; reason?: string; name?: string } | null> => {
    const f = await pickTextFileWithExtensions(['.py', '.yaml', '.yml', '.json'])
    if (!f) return null
    const name = f.name || ''
    const lower = name.toLowerCase()
    try { useParserUIState.getState().setScriptText(f.text) } catch { void 0 }
    if (lower.endsWith('.py')) {
      setParserLanguage('text')
      try { useParserUIState.getState().setPreferredLanguage('text') } catch { void 0 }
      setParserError('')
      return { ok: true, name }
    }
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
      setParserLanguage('yaml')
      try { useParserUIState.getState().setPreferredLanguage('yaml') } catch { void 0 }
      setParserError('')
      return { ok: true, name }
    }
    if (lower.endsWith('.json')) {
      setParserLanguage('json')
      try { useParserUIState.getState().setPreferredLanguage('json') } catch { void 0 }
      setParserError('')
      return { ok: true, name }
    }
    setParserLanguage('json')
    try { useParserUIState.getState().setPreferredLanguage('json') } catch { void 0 }
    const reason = 'Unsupported file type. Expected .py, .yaml, .yml or .json'
    setParserError(reason)
    return { ok: false, reason, name }
  }, [])

  useEffect(() => {
    try {
      const s = useParserUIState.getState()
      const pref = s.preferredLanguage
      if (pref === 'json' || pref === 'text' || pref === 'yaml') {
        setParserLanguage(pref)
      }
    } catch { void 0 }
  }, [])

  useEffect(() => {
    try {
      if (preferredLanguage === 'json' || preferredLanguage === 'text' || preferredLanguage === 'yaml') {
        setParserLanguage(preferredLanguage)
      }
    } catch { void 0 }
  }, [preferredLanguage])

  const onApplyParser = useCallback(async () => {
    const script = parserScriptText || ''
    if (parserLanguage !== 'text' && script.trim()) {
      try {
        const obj = parserLanguage === 'yaml' ? yaml.load(script) : JSON.parse(script)
        const v = validateTransforms(obj)
        if (!v.ok) {
          setParserError(v.errors?.[0] || '')
          return
        }
        const list = readCustomParsers()
        const idx = list.findIndex(x => x.id === parserSelectedId)
        if (idx >= 0) {
          const cfg = { ...list[idx] }
          cfg.transforms = { ...(cfg.transforms || {}), ...(obj || {}) }
          upsertCustomParser(cfg)
          const spec = toParserSpec(cfg)
          if (spec) registerParser(spec)
          invalidateParserCache(toParserId(cfg.id))
        }
      } catch {
        setParserError(parserLanguage === 'yaml' ? UI_COPY.invalidYamlLabel : UI_COPY.invalidJsonLabel)
      }
    }
    const name = parserInputName
    const text = parserInputText
    let id = parserSelectedId
    if (!id && text) {
      const bm = bestMatch({ name, text })
      id = bm ? bm.id : ''
    }
    if (!id || !text) return
    const parserId = toParserId(id)
    const cfgKey = parserLanguage === 'text' ? 'text' : `${parserLanguage}:${hashText(parserScriptText || '')}`
    const cached = getCachedParse(parserId, name, text, cfgKey)
    const res = cached || await applyParserAsync(parserId, { name, text })
    if (!res) return
    if (!cached) setCachedParse(parserId, name, text, res, cfgKey)
    try {
      useParserUIState.getState().setWarnings(res.warnings || [])
      useParserUIState.getState().setCounts({ n: res.graphData.nodes.length, e: res.graphData.edges.length })
    } catch { void 0 }
    setGraphData(res.graphData)
  }, [parserInputName, parserInputText, parserSelectedId, parserScriptText, parserLanguage, setGraphData])

  return { parserLanguage, setParserLanguage, parserError, setParserError, onLoadParserFile, onApplyParser }
}

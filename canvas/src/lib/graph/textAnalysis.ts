import { NLTK_STOPWORDS_EN_SET } from '@/features/semantic-mode/keywordStopwords'
import { tokenizeForStats } from '@/components/BottomPanel/BottomPanelStatsUtils'

export type TextEntity = {
  text: string
  label: string
  start: number
  end: number
}

export type TextTriple = {
  subject: string
  predicate: string
  object: string
  confidence: number
}

const VERB_HINTS = new Set<string>([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
  'use', 'uses', 'used', 'using', 'make', 'makes', 'made', 'making',
  'build', 'builds', 'built', 'building', 'create', 'creates', 'created', 'creating',
  'parse', 'parses', 'parsed', 'parsing', 'derive', 'derives', 'derived', 'deriving',
  'render', 'renders', 'rendered', 'rendering', 'layout', 'layouts', 'laid', 'laying',
  'link', 'links', 'linked', 'linking', 'connect', 'connects', 'connected', 'connecting',
  'enable', 'enables', 'enabled', 'enabling', 'disable', 'disables', 'disabled', 'disabling',
  'support', 'supports', 'supported', 'supporting', 'cause', 'causes', 'caused', 'causing',
  'lead', 'leads', 'led', 'leading'
])

export const isVerbLike = (token: string): boolean => {
  const t = String(token || '').toLowerCase()
  if (!t) return false
  if (VERB_HINTS.has(t)) return true
  if (t.length <= 2) return false
  if (NLTK_STOPWORDS_EN_SET.has(t)) return false
  if (t.endsWith('ed') || t.endsWith('ing')) return true
  if (t.endsWith('ize') || t.endsWith('ise')) return true
  if (t.endsWith('ify')) return true
  return false
}

export const normalizeWhitespace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim()

export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const normalizeNounPhrase = (s: string): string => {
  const t = normalizeWhitespace(s)
  if (!t) return ''
  return t
    .replace(/^(?:its|the|a|an)\s+/i, '')
    .replace(/^(?:and|or)\s+/i, '')
    .replace(/^about\s+/i, '')
    .replace(/^future\s+/i, '')
    .replace(/\s+(?:and|or)\s+$/i, '')
    .replace(/[.]+$/g, '')
    .trim()
}

export const splitSentences = (text: string): string[] => {
  const raw = String(text || '').trim()
  if (!raw) return []
  return raw
    .split(/(?<=[.!?])\s+|\n+/g)
    .map(s => s.trim())
    .filter(Boolean)
}

export const splitSentencesWithOffsets = (text: string): Array<{ start: number; end: number }> => {
  const s = String(text || '')
  const out: Array<{ start: number; end: number }> = []
  let start = 0
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    const isEnd = ch === '.' || ch === '!' || ch === '?' || ch === '\n'
    if (!isEnd) continue
    const end = i + 1
    if (end > start) out.push({ start, end })
    start = end
  }
  if (start < s.length) out.push({ start, end: s.length })
  return out.filter(r => r.end > r.start)
}

export const inferEntityLabel = (phrase: string): string => {
  const t = normalizeWhitespace(phrase)
  if (!t) return 'ENTITY'
  const lower = t.toLowerCase()
  if (/^[A-Z0-9]{2,8}$/.test(t)) return 'PRODUCT'
  if (/^[A-Z]{2,6}\d{1,4}$/.test(t)) return 'PRODUCT'
  if (/^[A-Za-z]+-\w+/.test(t) && /[A-Z]/.test(t[0] || '')) return 'PRODUCT'
  if (/(?:\b\d{4}\b)|(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b)/i.test(t)) {
    return 'DATE'
  }
  if (/(?:\binc\b|\bcorp\b|\bltd\b|\bllc\b|\buniversity\b|\bcommittee\b|\bcompany\b|\bgroup\b)/i.test(t)) {
    return 'ORG'
  }
  if (/(?:\bairport\b|\bbridge\b|\bhospital\b|\bstation\b|\bterminal\b|\bport\b|\bplant\b)/i.test(t)) {
    return 'FAC'
  }
  if (/(?:\bcity\b|\bstate\b|\bprovince\b|\bcountry\b|\bregion\b)/i.test(t)) {
    return 'GPE'
  }
  if (
    /(?:\b(?:north|south|east|west|southeast|southwest|northeast|northwest)\b)/i.test(t) ||
    /(?:\b(?:asia|europe|africa|america|oceania)\b)/i.test(t)
  ) {
    return 'LOC'
  }
  if (t.split(' ').length === 2 && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(t)) {
    return 'PERSON'
  }
  if (/^[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}$/.test(t)) {
    return 'GPE'
  }
  return 'ENTITY'
}

export const extractEntitiesHeuristic = (text: string): TextEntity[] => {
  const raw = String(text || '')
  const out: TextEntity[] = []
  const seen = new Set<string>()

  const push = (entityText: string, start: number, end: number, forcedLabel?: string) => {
    const phrase = normalizeWhitespace(entityText)
    if (!phrase) return
    const key = phrase.toLowerCase()
    if (seen.has(`${key}@${start}`)) return
    if (NLTK_STOPWORDS_EN_SET.has(key)) return
    const label = forcedLabel || inferEntityLabel(phrase)
    out.push({ text: phrase, label, start, end })
    seen.add(`${key}@${start}`)
  }

  const quantityRe = /\b(\d+(?:\.\d+)?)\s*(million|billion|thousand|%|percent|km|kg|m|cm|mm)\b/gi
  for (const m of raw.matchAll(quantityRe)) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    push(m[0] || '', idx, idx + String(m[0] || '').length, 'QUANTITY')
  }

  const dateRe = /\b(?:\d{4}-\d{2}-\d{2}|\d{4})\b/g
  for (const m of raw.matchAll(dateRe)) {
    const idx = m.index ?? -1
    if (idx < 0) continue
    push(m[0] || '', idx, idx + String(m[0] || '').length, 'DATE')
  }

  const capPhrase = /\b(?:[A-Z][a-z0-9]+)(?:\s+[A-Z][a-z0-9]+){0,5}\b/g
  for (const m of raw.matchAll(capPhrase)) {
    const idx = m.index ?? -1
    const v = String(m[0] || '').trim()
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  return out
}

const normalizeEntityKey = (raw: string): string => {
  const t = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  const stripped = t.replace(/^[\s"'“”‘’()[\]{}]+|[\s"'“”‘’()[\]{}]+$/g, '').trim()
  if (!stripped) return ''
  return stripped.toLowerCase()
}

export const extractMentionsRobust = (text: string): TextEntity[] => {
  const raw = String(text || '')
  if (!raw.trim()) return []
  const out: TextEntity[] = []
  const seen = new Set<string>()

  const push = (label: string, start: number, end: number) => {
    const key = normalizeEntityKey(label)
    if (!key) return
    if (seen.has(`${key}@${start}`)) return
    if (NLTK_STOPWORDS_EN_SET.has(key)) return
    if (key.length < 3) return
    if (/^\d+$/.test(key)) return
    
    out.push({ text: label.trim(), label: inferEntityLabel(label), start, end })
    seen.add(`${key}@${start}`)
  }

  const codeRe = /`([^`\n]+)`/g
  for (const m of raw.matchAll(codeRe)) {
    const v = String(m[1] || '').trim()
    if (!v) continue
    const idx = m.index ?? -1
    if (idx < 0) continue
    push(v, idx, idx + m[0].length)
  }

  const capPhrase = /\b(?:[A-Z][a-z0-9]+)(?:\s+[A-Z][a-z0-9]+){0,5}\b/g
  for (const m of raw.matchAll(capPhrase)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  const identifier = /\b[a-zA-Z][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*\b/g
  for (const m of raw.matchAll(identifier)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  const snakeOrKebab = /\b[a-zA-Z][a-zA-Z0-9_]*_[a-zA-Z0-9_]+\b/g
  for (const m of raw.matchAll(snakeOrKebab)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    push(v, idx, idx + v.length)
  }

  const word = /\b[a-zA-Z][a-zA-Z0-9_'-]{1,}\b/g
  for (const m of raw.matchAll(word)) {
    const v = String(m[0] || '').trim()
    const idx = m.index ?? -1
    if (!v || idx < 0) continue
    const key = normalizeEntityKey(v)
    if (!key) continue
    if (NLTK_STOPWORDS_EN_SET.has(key)) continue
    if (key.length < 3) continue
    if (/^\d+$/.test(key)) continue
    if (isVerbLike(key)) continue
    push(v, idx, idx + v.length)
  }

  return out
}

export const listEntitiesInSentence = (sentence: string, entities: TextEntity[]): TextEntity[] => {
  const lower = sentence.toLowerCase()
  const matches = entities
    .filter(e => {
      const t = e.text.toLowerCase()
      return t && lower.includes(t)
    })
    .slice()
    .sort((a, b) => a.start - b.start)
  const uniq: TextEntity[] = []
  const seen = new Set<string>()
  for (const e of matches) {
    const k = e.text.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(e)
  }
  return uniq
}

export const splitCommaAndAndList = (value: string): string[] => {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned) return []
  const parts = cleaned
    .split(/\s*,\s*|\s+(?:and|or)\s+/i)
    .map(x => normalizeNounPhrase(x))
    .filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const k = p.toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

export const findFirstEntityMention = (sentence: string, entities: TextEntity[]): TextEntity | null => {
  const list = listEntitiesInSentence(sentence, entities)
  return list[0] || null
}

export const extractTriplesHeuristic = (text: string, entities: TextEntity[]): TextTriple[] => {
  const sentences = splitSentences(text)
  const triples: TextTriple[] = []
  const seen = new Set<string>()

  const push = (s: string, p: string, o: string, confidence: number) => {
    const subject = normalizeWhitespace(s)
    const predicate = normalizeWhitespace(p).replace(/\s+/g, '-').toLowerCase()
    const object = normalizeWhitespace(o)
    if (!subject || !predicate || !object) return
    const key = `${subject.toLowerCase()}|${predicate}|${object.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    triples.push({ subject, predicate, object, confidence })
  }

  const stableSubject = (() => {
    const ordered = [...entities].sort((a, b) => a.start - b.start)
    const preferredLabels = new Set<string>(['PERSON', 'ORG', 'PRODUCT', 'GPE', 'LOC', 'FAC', 'ENTITY'])
    const preferred = ordered.find(e => preferredLabels.has(String(e.label || '')) && e.label !== 'DATE' && e.label !== 'QUANTITY')
    return preferred?.text || ordered.find(e => e.label !== 'DATE' && e.label !== 'QUANTITY')?.text || ordered[0]?.text || ''
  })()

  let lastSubject = stableSubject

  for (const sent of sentences) {
    const ents = listEntitiesInSentence(sent, entities)
    const lower = sent.trim().toLowerCase()
    const startsWithPronoun = /^(it|this|that|they|he|she|these|those)\b/.test(lower)
    const firstNonQuantity =
      ents.find(e => e.label !== 'QUANTITY' && e.label !== 'DATE')?.text ||
      ents[0]?.text ||
      ''
    const subj = (startsWithPronoun && stableSubject) ? stableSubject : firstNonQuantity || lastSubject
    if (!subj) continue
    if (!startsWithPronoun && firstNonQuantity) lastSubject = firstNonQuantity

    const subjInSentence = sent.toLowerCase().includes(subj.toLowerCase())
    const localSubjectMatch = sent.match(
      /^([A-Z][a-z]+(?:\s+[a-z]+){1,4})\s+(?:is|are|can|must|should|may|will|has|have)\b/,
    )
    const localSubject = normalizeWhitespace(localSubjectMatch?.[1] || '')
    const subjForSentence = startsWithPronoun ? subj : localSubject || subj
    const subjRe = escapeRe(subjForSentence)
    const before = triples.length

    const applyVerbObject = (verb: string, object: string, confidence: number) => {
      const v = normalizeWhitespace(verb)
      const o = normalizeNounPhrase(object)
      if (!v || !o) return
      push(subjForSentence, v, o, confidence)
    }

    const applyVerbObjectFromSentence = (pattern: RegExp, predicate: string, confidence: number) => {
      const m = sent.match(pattern)
      if (!m || !m[1]) return
      applyVerbObject(predicate, m[1], confidence)
    }

    const mIsCalled = sent.match(/(.+?)\s+is\s+called\s+([^,.]+)[,.]?/i)
    if (mIsCalled && mIsCalled[1] && mIsCalled[2]) {
      push(normalizeNounPhrase(mIsCalled[1]), 'is-called', normalizeNounPhrase(mIsCalled[2]), 0.75)
    }

    const mYield = sent.match(/\byield(?:s)?\b\s+([^,.]+)[,.]?/i)
    if (mYield && mYield[1] && subjForSentence) {
      applyVerbObject('yields', mYield[1], 0.6)
    }

    const mEasyTo = sent.match(new RegExp(`\\b${subjRe}\\b[^.]{0,80}\\bis\\s+easy\\s+to\\s+([^,.]+)`, 'i'))
    if (mEasyTo && mEasyTo[1] && subjForSentence) {
      applyVerbObject('is-easy-to', mEasyTo[1], 0.6)
    }

    if (subjInSentence || (subjForSentence && sent.toLowerCase().includes(subjForSentence.toLowerCase()))) {
      const mIsAIn = sent.match(new RegExp(`\\b${subjRe}\\b\\s+is\\s+(?:a|an|the)\\s+([^,.]+?)\\s+in\\s+([^,.]+)`, 'i'))
      if (mIsAIn && mIsAIn[1] && mIsAIn[2]) {
        push(subjForSentence, 'is-a', normalizeNounPhrase(mIsAIn[1]), 0.9)
        push(subjForSentence, 'located-in', normalizeNounPhrase(mIsAIn[2]), 0.9)
      } else {
        const mIsA = sent.match(new RegExp(`\\b${subjRe}\\b\\s+is\\s+(?:a|an|the)\\s+([^,.]+)`, 'i'))
        if (mIsA && mIsA[1]) push(subjForSentence, 'is-a', normalizeNounPhrase(mIsA[1]), 0.85)
        const mIn = sent.match(new RegExp(`\\b${subjRe}\\b[^.]{0,80}\\s+in\\s+([^,.]+)`, 'i'))
        if (mIn && mIn[1]) push(subjForSentence, 'located-in', normalizeNounPhrase(mIn[1]), 0.8)
      }

      const mLocated = sent.match(new RegExp(`\\b${subjRe}\\b[^.]{0,120}\\blocated\\s+in\\s+([^,.]+)`, 'i'))
      if (mLocated && mLocated[1]) push(subjForSentence, 'located-in', normalizeNounPhrase(mLocated[1]), 0.85)

      applyVerbObjectFromSentence(new RegExp(`\\b${subjRe}\\b[^.]{0,80}\\bemploys\\b\\s+(?:a|an|the)?\\s*([^,.]+)`, 'i'), 'employs', 0.75)
      applyVerbObjectFromSentence(new RegExp(`\\b${subjRe}\\b[^.]{0,120}\\bretrieves\\b\\s+([^,.]+?)(?:\\s+from\\s+[^,.]+)?[,.]`, 'i'), 'retrieves', 0.7)
      applyVerbObjectFromSentence(new RegExp(`\\b${subjRe}\\b[^.]{0,120}\\buses\\b\\s+([^,.]+?)(?:\\s+to\\s+(?:generate|produce)\\s+[^,.]+)?[,.]`, 'i'), 'uses', 0.7)
      applyVerbObjectFromSentence(new RegExp(`\\b${subjRe}\\b[^.]{0,200}\\bgenerate(?:s)?\\b\\s+([^,.]+)`, 'i'), 'generates', 0.65)
      applyVerbObjectFromSentence(new RegExp(`\\b${subjRe}\\b[^.]{0,200}\\bdepends\\s+on\\s+(?:the\\s+)?([^,.]+)`, 'i'), 'depends-on', 0.7)
      applyVerbObjectFromSentence(new RegExp(`\\b${subjRe}\\b[^.]{0,240}\\breduces\\b\\s+([^,.]+)`, 'i'), 'reduces', 0.7)
    }

    if (startsWithPronoun) {
      const shouldSkipPronounVerbs = /\bpopulation\s+of\b/i.test(sent) || /\bknown\s+for\b/i.test(sent)
      if (!shouldSkipPronounVerbs) {
        applyVerbObjectFromSentence(/\bemploys\b\s+(?:a|an|the)?\s*([^,.]+)[,.]/i, 'employs', 0.65)
        applyVerbObjectFromSentence(/\bretrieves\b\s+([^,.]+?)(?:\s+from\s+[^,.]+)?[,.]/i, 'retrieves', 0.65)
        applyVerbObjectFromSentence(/\buses\b\s+([^,.]+?)(?:\s+to\s+(?:generate|produce)\s+[^,.]+)?[,.]/i, 'uses', 0.65)
        applyVerbObjectFromSentence(/\bgenerate(?:s)?\b\s+([^,.]+)[,.]/i, 'generates', 0.6)
        applyVerbObjectFromSentence(/\bdepends\s+on\s+(?:the\s+)?([^,.]+)[,.]/i, 'depends-on', 0.6)
        applyVerbObjectFromSentence(/\breduces\b\s+([^,.]+)[,.]/i, 'reduces', 0.6)
      }
    }

    if (/\boutperform\b/i.test(sent)) {
      const mOut = sent.match(/\boutperform\b\s+([^,.]+?)[,.]/i)
      if (mOut && mOut[1]) applyVerbObject('outperforms', mOut[1], 0.6)
    }

    const quantityUnit = '(?:million|billion|thousand|%|percent|km|kg|m|cm|mm)'
    const mPopulation = subjInSentence
      ? sent.match(new RegExp(`\\b${subjRe}\\b[^.]{0,240}\\bpopulation\\s+of\\s+(?:about\\s+)?(\\d+(?:\\.\\d+)?\\s*${quantityUnit})`, 'i'))
      : sent.match(new RegExp(`\\bpopulation\\s+of\\s+(?:about\\s+)?(\\d+(?:\\.\\d+)?\\s*${quantityUnit})`, 'i'))
    if (mPopulation && mPopulation[1]) push(subjForSentence, 'has-population', normalizeNounPhrase(mPopulation[1]), 0.85)

    const mKnown = subjInSentence
      ? sent.match(new RegExp(`\\b${subjRe}\\b[^.]{0,200}\\bknown\\s+for\\s+([^.]*)`, 'i'))
      : sent.match(/\bknown\s+for\s+([^.]*)/i)
    if (mKnown && mKnown[1]) {
      const list = splitCommaAndAndList(mKnown[1])
      list.forEach(item => {
        if (/\bproject\b|\bprojects\b/i.test(item)) push(subjForSentence, 'has', item, 0.75)
        else push(subjForSentence, 'known-for', item, 0.75)
      })
    }

    const shouldSkipHas = /\bpopulation\s+of\b/i.test(sent) && !subjInSentence
    const mHas = shouldSkipHas
      ? null
      : subjInSentence
        ? sent.match(new RegExp(`\\b${subjRe}\\b[^.]{0,160}\\bhas\\s+([^.]*)`, 'i'))
        : sent.match(/\bhas\s+([^.]*)/i)
    if (mHas && mHas[1]) {
      const rhs = normalizeWhitespace(mHas[1]).replace(/\b(?:a|an|the)\b/gi, ' ').trim()
      const list = splitCommaAndAndList(rhs)
      list.forEach(item => push(subjForSentence, 'has', item, 0.7))
    }

    if (triples.length === before && ents.length >= 2 && (subjInSentence || (subjForSentence && sent.toLowerCase().includes(subjForSentence.toLowerCase())))) {
      const obj = ents[1]!.text
      const between = (() => {
        const lowerSent = sent.toLowerCase()
        const a = lowerSent.indexOf(subjForSentence.toLowerCase())
        const b = lowerSent.indexOf(obj.toLowerCase())
        if (a < 0 || b < 0) return ''
        const start = Math.min(a + subjForSentence.length, b + obj.length)
        const end = Math.max(a, b)
        if (start >= end) return ''
        return sent.slice(start, end)
      })()
      const verbTokens = tokenizeForStats(between, 2, new Set())
      const verb = verbTokens.find(t => t.length >= 2) || 'relates_to'
      push(subjForSentence, verb, obj, 0.55)
    }
  }

  return triples
}

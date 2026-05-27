export const KGC_TIER_B_KEYS = [
  'product',
  'domain',
  'subject',
  'objective',
  'artifact',
  'owner',
  'version',
  'status',
] as const

export type KgcTierBKey = (typeof KGC_TIER_B_KEYS)[number]

export type KgcRequestedSections = {
  useCase: boolean
  problem: boolean
  solution: boolean
  userFlow: boolean
  workflow: boolean
  dataFlow: boolean
  goals: boolean
  userStories: boolean
  monetization: boolean
  integrations: boolean
}

export type KgcRequestProfile = {
  intent: string
  product: string
  domain: string
  subject: string
  objective: string
  artifact: string
  owner: string
  version: string
  status: string
  topics: string[]
  namedTerms: string[]
  outputFile: string
  signals: KgcRequestSignals
  requestedSections: KgcRequestedSections
}

export type KgcRequestSignals = {
  recommendation: boolean
  creativeScript: boolean
  trademarkAvoidance: boolean
  zeroBudget: boolean
  bootstrap: boolean
  organicGrowth: boolean
  mcp: boolean
  externalUsers: boolean
  marketplace: boolean
  openClaw: boolean
  b2c: boolean
  subscriptions: boolean
  payPerUse: boolean
  conversion: boolean
  payments: boolean
  swipe: boolean
  foss: boolean
  rxdb: boolean
  maplibre: boolean
}

const SUBJECT_CANDIDATES = [
  'solo founder',
  'founder',
  'product manager',
  'project manager',
  'researcher',
  'analyst',
  'developer',
  'designer',
  'operator',
  'planner',
  'student',
  'teacher',
  'marketer',
  'architect',
] as const

const ARTIFACT_PATTERNS: Array<{ rx: RegExp; label: string }> = [
  { rx: /\bpitch deck\b/i, label: 'Pitch Deck' },
  { rx: /\bprd\b/i, label: 'PRD' },
  { rx: /\btad\b/i, label: 'TAD' },
  { rx: /\btco\b/i, label: 'TCO' },
  { rx: /\brfc\b/i, label: 'RFC' },
  { rx: /\bbrief\b/i, label: 'brief' },
  { rx: /\bplan\b/i, label: 'plan' },
  { rx: /\broadmap\b/i, label: 'roadmap' },
  { rx: /\bworkflow\b/i, label: 'workflow' },
  { rx: /\bspec(?:ification)?\b/i, label: 'specification' },
  { rx: /\bproposal\b/i, label: 'proposal' },
  { rx: /\breport\b/i, label: 'report' },
  { rx: /\banalysis\b/i, label: 'analysis' },
  { rx: /\bresponse\b/i, label: 'response' },
  { rx: /\barchitecture\b/i, label: 'architecture' },
  { rx: /\bvideo script\b/i, label: 'video script' },
  { rx: /\bscript\b/i, label: 'script' },
  { rx: /\bstoryboard\b/i, label: 'storyboard' },
]

const TOPIC_PATTERNS: Array<{ rx: RegExp; label: string }> = [
  { rx: /\bmcp\b/i, label: 'MCP distribution' },
  { rx: /\bmarketplace\b/i, label: 'marketplace delivery' },
  { rx: /\bsubscription\b|\bpricing\b|\bmonetization\b|\bmoneti[sz]e\b|\bmake money\b|\bpay[- ]?per[- ]?use\b|\busage\b/i, label: 'usage monetization' },
  { rx: /\bconversion\b|\bcheckout\b|\bpayment\b|\bpayments\b|\bcommerce\b/i, label: 'conversion workflow' },
  { rx: /\blocal-first\b|\boffline\b|\bsync\b|\brxdb\b|\bstorage\b/i, label: 'local-first state' },
  { rx: /\bmaplibre\b|\bgeospatial\b|\bspatial\b|\bmap\b/i, label: 'spatial workflows' },
  { rx: /\bapi\b|\bintegration\b|\bintegrations\b|\btool\b|\btools\b/i, label: 'tool integration' },
  { rx: /\bvideo\b|\bscript\b|\bscene\b|\bstory\b|\bnarrative\b|\btrailer\b/i, label: 'narrative scripting' },
]

export const sanitizeRequestIntent = (raw: string, maxChars = 240): string => {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

export const sanitizeScalar = (raw: string, maxChars = 120): string => {
  return String(raw || '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, maxChars)
}

const unique = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)))

const inferSubject = (lowered: string): string => {
  return SUBJECT_CANDIDATES.find(role => lowered.includes(role)) || ''
}

const inferProduct = (intent: string): string => {
  const boldMatch = /\*\*([^*]{2,80})\*\*/.exec(intent)
  if (boldMatch?.[1]) return sanitizeScalar(boldMatch[1], 80)
  const quotedMatch = /"([^"\n]{2,80})"/.exec(intent)
  if (quotedMatch?.[1]) return sanitizeScalar(quotedMatch[1], 80)
  return ''
}

const inferArtifact = (lowered: string): string => {
  const matches = unique(ARTIFACT_PATTERNS
    .filter(entry => entry.rx.test(lowered))
    .map(entry => entry.label))
    .sort((a, b) => b.length - a.length)
  const reduced = matches.filter((label, index) => {
    return !matches.some((other, otherIndex) => otherIndex < index && other.includes(label))
  })
  return sanitizeScalar(reduced.join(' + '), 120)
}

const inferTopics = (lowered: string): string[] => {
  return unique(
    TOPIC_PATTERNS
      .filter(entry => entry.rx.test(lowered))
      .map(entry => entry.label),
  )
}

const inferSignals = (lowered: string): KgcRequestSignals => ({
  recommendation: /\brecommend(?:ed|ation)?\b/.test(lowered),
  creativeScript: /\bvideo script\b|\bscript\b|\bstoryboard\b|\bscene\b|\bnarrative\b/.test(lowered),
  trademarkAvoidance: /\bforbid mention\b|\bforbid.*trademark\b|\bavoid.*trademark\b|\bno trademark\b|\bnon[- ]infring/i.test(lowered),
  zeroBudget: /\bzero budget\b|\bno budget\b/.test(lowered),
  bootstrap: /\bbootstrap\b/.test(lowered),
  organicGrowth: /\borganic growth\b/.test(lowered),
  mcp: /\bmcp\b/.test(lowered),
  externalUsers: /\bexternal users?\b/.test(lowered),
  marketplace: /\bmarketplace\b/.test(lowered),
  openClaw: /\bopenclaw\b/.test(lowered),
  b2c: /\bb2c\b/.test(lowered),
  subscriptions: /\bsubscription(s)?\b/.test(lowered),
  payPerUse: /\bpay[- ]?per[- ]?use\b/.test(lowered),
  conversion: /\bconversion\b|\bcommerce\b/.test(lowered),
  payments: /\bpayments?\b|\bcheckout\b/.test(lowered),
  swipe: /\bswipe\b/.test(lowered),
  foss: /\bfoss\b|\bopen source\b/.test(lowered),
  rxdb: /\brxdb\b/.test(lowered),
  maplibre: /\bmaplibre\b/.test(lowered),
})

const inferNamedTerms = (signals: KgcRequestSignals, intent: string): string[] => {
  const acronymTerms = String(intent || '').match(/\b[A-Z]{2,6}\b/g) || []
  return unique([
    signals.openClaw ? 'OpenClaw' : '',
    signals.swipe ? 'Swipe payment flow' : '',
    signals.rxdb ? 'RxDB' : '',
    signals.maplibre ? 'MapLibre' : '',
    ...acronymTerms.map(term => sanitizeScalar(term, 24)),
  ])
}

const inferOutputFile = (intent: string): string => {
  const match = /`([^`\n]+?\.[a-z0-9]+)`/i.exec(intent)
  return match?.[1] ? sanitizeScalar(match[1], 120) : ''
}

const inferDomain = (topics: string[], signals: KgcRequestSignals): string => {
  const parts = [
    signals.creativeScript ? 'narrative scripting' : '',
    signals.mcp ? 'MCP distribution' : '',
    signals.marketplace ? 'skills marketplace delivery' : '',
    signals.subscriptions || signals.payPerUse || signals.conversion || signals.payments || signals.b2c
      ? 'user-action monetization'
      : '',
    signals.rxdb || signals.maplibre ? 'local-first spatial workflows' : '',
    !signals.marketplace && topics.includes('tool integration') ? 'tool integration' : '',
  ]
  return sanitizeScalar(unique(parts).join(' + '), 220)
}

const inferObjective = (intent: string, signals: KgcRequestSignals, artifact: string, product: string): string => {
  if (signals.creativeScript) {
    const parts = [
      artifact ? `develop ${artifact}` : 'develop a script deliverable',
      'keep the output original and production-ready',
      signals.trademarkAvoidance ? 'avoid direct trademark or franchise references' : '',
      /inspired by/i.test(intent) ? 'translate inspiration into high-level tone, pacing, and atmosphere only' : '',
    ].filter(Boolean)
    return sanitizeScalar(parts.join('; '), 520)
  }
  const parts = [
    signals.zeroBudget ? 'support zero-budget execution' : '',
    signals.bootstrap ? 'prioritize bootstrap execution' : '',
    signals.organicGrowth ? 'favor organic growth' : '',
    product && signals.mcp ? `package ${product} as an MCP offer` : '',
    signals.externalUsers ? 'serve external users' : '',
    signals.openClaw ? 'support OpenClaw marketplace packaging' : (signals.marketplace ? 'support marketplace packaging' : ''),
    artifact ? `deliver ${artifact}` : '',
    signals.b2c ? 'evaluate B2C monetization' : '',
    signals.subscriptions || signals.payPerUse || signals.conversion
      ? 'compare subscription, pay-per-use, and conversion monetization'
      : '',
    signals.swipe ? 'expose Swipe payment and checkout integration' : (signals.payments ? 'expose payment and checkout integration' : ''),
    signals.foss && (signals.rxdb || signals.maplibre) ? 'stay compatible with FOSS local-first and spatial components' : '',
  ].filter(Boolean)
  if (parts.length > 0) return sanitizeScalar(parts.join('; '), 520)
  const cleaned = sanitizeRequestIntent(intent, 320)
    .replace(/^#?\s*adhere to\b[^-]*-\s*/i, '')
    .replace(/^\s*(enhance|finetune|refine|improve|fix|generate|create|draft|write)\b[:\s-]*/i, '')
    .trim()
  return sanitizeScalar(cleaned, 520)
}

const inferStatus = (lowered: string): string => {
  if (!lowered) return ''
  if (/\brecommend(?:ed|ation)?\b/.test(lowered)) return 'recommended'
  if (/\bplan(?:ned)?\b/.test(lowered)) return 'planned'
  if (/\bdraft\b/.test(lowered)) return 'draft'
  return ''
}

const inferRequestedSections = (lowered: string): KgcRequestedSections => ({
  useCase: /\buse case\b/.test(lowered),
  problem: /\bproblem\b/.test(lowered),
  solution: /\bsolution\b/.test(lowered),
  userFlow: /\buser flow\b/.test(lowered),
  workflow: /\bwork flow\b/.test(lowered),
  dataFlow: /\bdata flow\b/.test(lowered),
  goals: /\bgoals?\b/.test(lowered),
  userStories: /\buser stories\b|\bstories\b/.test(lowered),
  monetization: /\bmonetization\b|\bmoneti[sz]e\b|\bmake money\b|\bpricing\b|\bsubscription\b|\bpayment\b|\bcheckout\b|\bconversion\b/.test(lowered),
  integrations: /\bintegration\b|\bintegrations\b|\brxdb\b|\bmaplibre\b|\bmcp\b|\bapi\b/.test(lowered),
})

export const analyzeKgcRequest = (requestText: string): KgcRequestProfile => {
  const intent = sanitizeRequestIntent(requestText, 900)
  const lowered = intent.toLowerCase()
  const signals = inferSignals(lowered)
  const topics = inferTopics(lowered)
  const namedTerms = inferNamedTerms(signals, intent)
  const subject = sanitizeScalar(inferSubject(lowered), 60)
  const product = inferProduct(intent)
  const artifact = inferArtifact(lowered)
  return {
    intent,
    product,
    domain: inferDomain(topics, signals),
    subject,
    objective: inferObjective(intent, signals, artifact, product),
    artifact,
    owner: subject,
    version: '',
    status: inferStatus(lowered),
    topics,
    namedTerms,
    outputFile: inferOutputFile(intent),
    signals,
    requestedSections: inferRequestedSections(lowered),
  }
}

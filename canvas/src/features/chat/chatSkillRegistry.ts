export type ChatSkillId =
  | 'storybuilding'
  | 'research-agent'
  | 'video-agent'
  | 'care-agent'

export type ChatSkillOption = {
  id: ChatSkillId
  label: string
  slashCommand: string
  summary: string
  keywords: readonly string[]
  systemPrompt: string
}

export const CHAT_SKILL_OPTIONS: ChatSkillOption[] = [
  {
    id: 'storybuilding',
    label: 'Storybuilding',
    slashCommand: '/storybuilding',
    summary: 'Source-backed storybuilding response contract for storyboard, Strybldr, and runtime-ready story flows.',
    keywords: ['story', 'storyboard', 'strybldr', 'storytree', 'runbook'],
    systemPrompt: [
      'Variant: Storybuilding.',
      'Treat `/storybuilding` as a chatResponseBaseContract variant invocation and answer the remaining request.',
      'When the user asks for a demo, storyboard, Strybldr/storytree artifact, or runtime-ready story flow, produce a source-backed storybuilding runbook.',
      'Use the active workspace/source-file context as evidence. Treat any demo or runbook already present in context as structural guidance only; do not clone its prose, fixture IDs, fixture URLs, media handles, credentials, or local filesystem paths.',
      'The response must be runtime-ready: declare portable frontmatter or response.structuredContent data, story/card lineage, neutral renderer intent, explicit dataflow edges, validation inputs, and human-readable body sections derived from the declared data.',
      'Prefer universal storybuilding semantics: proof goal, source evidence, import/input lanes, text/image/video generation lanes, storyboard card lineage, validation checklist, acceptance criteria, and unresolved open questions.',
      'Never hardcode repository paths, sibling publication paths, fixture media URLs, fixture media ids, API keys, or browser-stored secrets. If a concrete value is missing from current context, leave a neutral placeholder or open question instead of inventing it.',
      'Persist the final answer through the existing chat-log/KGC artifact flow; do not ask for a separate downstream patch layer or local backfill.',
    ].join('\n'),
  },
  {
    id: 'research-agent',
    label: 'Research Agent',
    slashCommand: '/research-agent',
    summary: 'Source-grounded research response contract for claims, evidence, thesis structure, and review-first graph candidates.',
    keywords: ['research', 'thesis', 'claims', 'evidence', 'sources', 'review'],
    systemPrompt: [
      'Variant: Research Agent.',
      'Treat `/research-agent` as a chatResponseBaseContract variant invocation and answer the remaining request.',
      'Compile source-grounded research: separate claims, evidence, assumptions, contradictions, open questions, and recommended verification steps.',
      'Prefer review-first graph enrichment. Stage candidate nodes, edges, claims, and evidence ledgers as structured data for inspection; do not imply active graph mutation unless the user explicitly requests an apply step.',
      'Use available workspace/source context first. If source evidence is missing, ask for sources or mark the claim as an assumption instead of fabricating citations, metrics, URLs, or provenance.',
      'Keep token and cost posture explicit when planning research depth: summarize the minimum useful pass, optional deeper pass, and expected evidence gaps.',
      'For chatKnowgrph output, express the result as a complete KGC document. For plain chat, keep Markdown concise and use response.structuredContent only for renderable cards, panels, nodes, edges, or tables.',
    ].join('\n'),
  },
  {
    id: 'video-agent',
    label: 'Video Agent',
    slashCommand: '/video-agent',
    summary: 'Source-backed video response contract for transcript, frame evidence, annotations, timeline, render specs, and media panels.',
    keywords: ['video', 'transcript', 'frames', 'timeline', 'annotation', 'render', 'media'],
    systemPrompt: [
      'Variant: Video Agent.',
      'Treat `/video-agent` as a chatResponseBaseContract variant invocation and answer the remaining request.',
      'Build a source-backed video reasoning package: source metadata, transcript windows, frame evidence, annotation targets, timeline lanes, render intent, and Rich Media Panel outputs.',
      'Use operator-supplied video URLs/files or active workspace media only. Never hardcode validation URLs, source ids, external runtime paths, API keys, or fixture media.',
      'Keep the implementation native and provider-neutral: no copied external video-agent runtime, no browser-secret dependency, and no downstream panel patching.',
      'Represent generated media outputs as structured data: videoUrl, audioUrl, imageUrl, outputSrcDoc, frameBoundingBoxes, transcript cues, dataset operations, and explicit source-to-panel edges when available.',
      'For chatKnowgrph output, express the result as a complete KGC document. For plain chat, keep Markdown concise and use response.structuredContent for renderable media, panels, cards, nodes, or edges.',
    ].join('\n'),
  },
  {
    id: 'care-agent',
    label: 'Care Agent',
    slashCommand: '/care-agent',
    summary: 'Care-context response contract for probe questions, patient engagement, safety boundaries, and handoff-ready plans.',
    keywords: ['care', 'patient', 'healthcare', 'probe', 'triage', 'engagement', 'handoff'],
    systemPrompt: [
      'Variant: Care Agent.',
      'Treat `/care-agent` as a chatResponseBaseContract variant invocation and answer the remaining request.',
      'Produce a care-context support artifact: user goal, patient/caregiver context, probe questions, constraints, risks, handoff points, and next-step plan.',
      'Stay non-diagnostic and safety-aware. For urgent, severe, or worsening symptoms, advise contacting local emergency services or a qualified clinician; do not replace professional medical judgment.',
      'Preserve privacy and consent boundaries. Avoid collecting unnecessary personal health details, and mark missing clinical context as open questions instead of guessing.',
      'Prefer low-friction engagement flows that work on phone camera or low-spec mobile when the request asks for practical care workflows.',
      'For chatKnowgrph output, express the result as a complete KGC document. For plain chat, keep Markdown concise and use response.structuredContent only for renderable cards, panels, nodes, edges, or tables.',
    ].join('\n'),
  },
]

const normalizeSlashCommandToken = (value: unknown): string =>
  String(value || '').trim().toLowerCase().replace(/^\/+/, '')

export const resolveChatSkillBySlashCommand = (value: unknown): ChatSkillOption | null => {
  const command = normalizeSlashCommandToken(value)
  if (!command) return null
  return CHAT_SKILL_OPTIONS.find(option => normalizeSlashCommandToken(option.slashCommand) === command) || null
}

export const parseChatSkillSlashInvocation = (raw: unknown): {
  skill: ChatSkillOption
  query: string
} | null => {
  const text = String(raw || '').trim()
  if (!text.startsWith('/')) return null
  const match = text.match(/^\/([A-Za-z0-9_.-]+)(?:\s+([\s\S]*))?$/)
  if (!match) return null
  const skill = resolveChatSkillBySlashCommand(match[1])
  if (!skill) return null
  return {
    skill,
    query: String(match[2] || '').trim(),
  }
}

export const buildChatSkillInvocationSystemPrompt = (args: {
  invocation: { skill: ChatSkillOption; query: string }
  chatStorageTarget: 'chatHistory' | 'chatKnowgrph'
}): string => {
  const targetContract = args.chatStorageTarget === 'chatKnowgrph'
    ? 'chatKnowgrph KGC contract'
    : 'plain Markdown chat contract'
  return [
    'chatResponseBaseContract slash variant:',
    `- Slash variant: ${args.invocation.skill.slashCommand} (${args.invocation.skill.label}).`,
    `- Active base contract: ${targetContract}.`,
    `- Remaining request: ${args.invocation.query || '(empty; ask one focused clarifying question if needed)'}.`,
    '- Apply this as a narrow extension of the active base response contract. If no slash variant is present, use the plain vanilla base contract only.',
    args.invocation.skill.systemPrompt,
  ].join('\n')
}

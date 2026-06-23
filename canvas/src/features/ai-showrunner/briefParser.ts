import {
  SHOWRUNNER_BRIEF_SCHEMA,
  SHOWRUNNER_DEFAULT_MAX_MEMORY_TOKENS,
  SHOWRUNNER_DEFAULT_MAX_RETRIES,
  type AgentRoleEntry,
  type IBriefParser,
  type NarratorVoiceMapEntry,
  type ShowrunnerBriefSpec,
  type ShowrunnerError,
  type ShowrunnerRunType,
} from './showrunnerTypes'
import {
  buildShowrunnerSemanticKey,
  isShowrunnerRecord,
  normalizeShowrunnerString,
  normalizeShowrunnerStringArray,
  readShowrunnerFrontmatter,
  readShowrunnerNumber,
  readShowrunnerPositiveInteger,
  yamlFlow,
  yamlScalar,
} from './showrunnerShared'

const RUN_TYPES: ShowrunnerRunType[] = ['podcast', 'narrative_game', 'writers_room']

const validationError = (message: string, field?: string): ShowrunnerError => ({
  code: 'BRIEF_VALIDATION_ERROR',
  message,
  field,
})

const readRoleEntries = (value: unknown): AgentRoleEntry[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter(isShowrunnerRecord)
    .map((entry) => {
      const role = normalizeShowrunnerString(entry.role)
      return {
        role,
        ...(normalizeShowrunnerString(entry.model_hint) ? { model_hint: normalizeShowrunnerString(entry.model_hint) } : {}),
        ...(Number.isFinite(Number(entry.max_retries)) ? { max_retries: readShowrunnerPositiveInteger(entry.max_retries, SHOWRUNNER_DEFAULT_MAX_RETRIES) } : {}),
        ...(normalizeShowrunnerString(entry.system_prompt_path) ? { system_prompt_path: normalizeShowrunnerString(entry.system_prompt_path) } : {}),
      }
    })
    .filter(entry => Boolean(entry.role))
}

const readVoiceMap = (value: unknown): NarratorVoiceMapEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const entries = value
    .filter(isShowrunnerRecord)
    .map(entry => ({
      speaker: normalizeShowrunnerString(entry.speaker),
      voice_endpoint_env_key: normalizeShowrunnerString(entry.voice_endpoint_env_key),
    }))
    .filter(entry => entry.speaker && entry.voice_endpoint_env_key)
  return entries.length ? entries : undefined
}

const readRunType = (value: unknown): ShowrunnerRunType | null => {
  const raw = normalizeShowrunnerString(value) as ShowrunnerRunType
  return RUN_TYPES.includes(raw) ? raw : null
}

export class ShowrunnerBriefParser implements IBriefParser {
  parse(markdownText: string): { ok: true; spec: ShowrunnerBriefSpec } | { ok: false; errors: ShowrunnerError[] } {
    const { meta, warnings } = readShowrunnerFrontmatter(markdownText)
    const errors: ShowrunnerError[] = warnings.map(warning => validationError(warning, 'frontmatter'))
    const schema = normalizeShowrunnerString(meta.schema)
    if (schema !== SHOWRUNNER_BRIEF_SCHEMA) {
      errors.push(validationError(`schema must be ${SHOWRUNNER_BRIEF_SCHEMA}`, 'schema'))
    }

    const runType = readRunType(meta.run_type)
    if (!runType) errors.push(validationError('run_type must be podcast, narrative_game, or writers_room.', 'run_type'))

    const title = normalizeShowrunnerString(meta.title)
    if (!title) errors.push(validationError('title is required.', 'title'))

    const rawRunId = normalizeShowrunnerString(meta.run_id) || buildShowrunnerSemanticKey('showrunner-run-title', `${runType || ''}:${title}`)
    if (!rawRunId) errors.push(validationError('run_id is required when title cannot derive one.', 'run_id'))

    const tokenBudget = readShowrunnerNumber(meta.token_budget, 0)
    if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
      errors.push(validationError('token_budget must be a positive number.', 'token_budget'))
    }

    const agentRoles = readRoleEntries(meta.agent_roles)
    if (agentRoles.length === 0) errors.push(validationError('agent_roles must include at least one role.', 'agent_roles'))

    const agentPipeline = normalizeShowrunnerStringArray(meta.agent_pipeline)
    const roleNames = new Set(agentRoles.map(role => role.role))
    const pipeline = agentPipeline.length ? agentPipeline.filter(role => roleNames.has(role)) : agentRoles.map(role => role.role)
    if (pipeline.length === 0) errors.push(validationError('agent_pipeline must reference registered agent_roles.', 'agent_pipeline'))

    if (errors.length > 0) return { ok: false, errors }

    return {
      ok: true,
      spec: {
        schema: SHOWRUNNER_BRIEF_SCHEMA,
        run_type: runType as ShowrunnerRunType,
        title,
        run_id: rawRunId,
        token_budget: tokenBudget,
        max_retries: readShowrunnerPositiveInteger(meta.max_retries, SHOWRUNNER_DEFAULT_MAX_RETRIES),
        ...(Number.isFinite(Number(meta.max_revision_cycles)) ? { max_revision_cycles: readShowrunnerPositiveInteger(meta.max_revision_cycles, 1) } : {}),
        ...(Number.isFinite(Number(meta.max_context_tokens)) ? { max_context_tokens: readShowrunnerPositiveInteger(meta.max_context_tokens, 1) } : {}),
        max_memory_tokens: readShowrunnerPositiveInteger(meta.max_memory_tokens, SHOWRUNNER_DEFAULT_MAX_MEMORY_TOKENS),
        agent_pipeline: pipeline,
        agent_roles: agentRoles,
        ...(readVoiceMap(meta.narrator_voice_map) ? { narrator_voice_map: readVoiceMap(meta.narrator_voice_map) } : {}),
        ...(normalizeShowrunnerStringArray(meta.acceptance_criteria).length ? { acceptance_criteria: normalizeShowrunnerStringArray(meta.acceptance_criteria) } : {}),
        ...(normalizeShowrunnerString(meta.notes) ? { notes: normalizeShowrunnerString(meta.notes) } : {}),
        ...(meta.dry_run === true ? { dry_run: true } : {}),
      },
    }
  }

  print(spec: ShowrunnerBriefSpec): string {
    const lines = [
      '---',
      `schema: ${yamlScalar(SHOWRUNNER_BRIEF_SCHEMA)}`,
      `run_type: ${yamlScalar(spec.run_type)}`,
      `title: ${yamlScalar(spec.title)}`,
      `run_id: ${yamlScalar(spec.run_id)}`,
      `token_budget: ${Number(spec.token_budget) || 0}`,
      `max_retries: ${readShowrunnerPositiveInteger(spec.max_retries, SHOWRUNNER_DEFAULT_MAX_RETRIES)}`,
      `max_memory_tokens: ${readShowrunnerPositiveInteger(spec.max_memory_tokens, SHOWRUNNER_DEFAULT_MAX_MEMORY_TOKENS)}`,
      `agent_pipeline: ${yamlFlow(spec.agent_pipeline || [])}`,
      `agent_roles: ${yamlFlow(spec.agent_roles || [])}`,
    ]
    if (Number.isFinite(Number(spec.max_revision_cycles))) lines.push(`max_revision_cycles: ${Number(spec.max_revision_cycles)}`)
    if (Number.isFinite(Number(spec.max_context_tokens))) lines.push(`max_context_tokens: ${Number(spec.max_context_tokens)}`)
    if (Array.isArray(spec.narrator_voice_map)) lines.push(`narrator_voice_map: ${yamlFlow(spec.narrator_voice_map)}`)
    if (Array.isArray(spec.acceptance_criteria)) lines.push(`acceptance_criteria: ${yamlFlow(spec.acceptance_criteria)}`)
    if (normalizeShowrunnerString(spec.notes)) lines.push(`notes: ${yamlScalar(spec.notes)}`)
    if (spec.dry_run === true) lines.push('dry_run: true')
    lines.push('---', '', `# ${spec.title}`, '')
    return lines.join('\n')
  }
}

export const showrunnerBriefParser = new ShowrunnerBriefParser()

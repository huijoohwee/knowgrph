import {
  SHOWRUNNER_SCRIPT_SCHEMA,
  type IScriptSchema,
  type Script,
  type ScriptSegment,
  type ShowrunnerError,
} from './showrunnerTypes'
import {
  isShowrunnerRecord,
  normalizeShowrunnerString,
  readShowrunnerFrontmatter,
  readShowrunnerNumber,
  yamlFlow,
  yamlScalar,
} from './showrunnerShared'

const scriptError = (message: string, field?: string): ShowrunnerError => ({
  code: 'SCRIPT_VALIDATION_ERROR',
  message,
  field,
})

const readSegments = (value: unknown): ScriptSegment[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter(isShowrunnerRecord)
    .map((entry) => {
      const speaker = normalizeShowrunnerString(entry.speaker)
      const text = normalizeShowrunnerString(entry.text)
      return {
        speaker,
        text,
        ...(normalizeShowrunnerString(entry.stage_direction) ? { stage_direction: normalizeShowrunnerString(entry.stage_direction) } : {}),
        ...(Number.isFinite(Number(entry.duration_estimate_s)) ? { duration_estimate_s: Math.max(0, readShowrunnerNumber(entry.duration_estimate_s)) } : {}),
      }
    })
    .filter(segment => segment.speaker && segment.text)
}

export class ShowrunnerScriptSchema implements IScriptSchema {
  parse(markdownText: string): { ok: true; script: Script } | { ok: false; errors: ShowrunnerError[] } {
    const { meta, warnings } = readShowrunnerFrontmatter(markdownText)
    const errors: ShowrunnerError[] = warnings.map(warning => scriptError(warning, 'frontmatter'))
    if (normalizeShowrunnerString(meta.schema) !== SHOWRUNNER_SCRIPT_SCHEMA) {
      errors.push(scriptError(`schema must be ${SHOWRUNNER_SCRIPT_SCHEMA}`, 'schema'))
    }
    const title = normalizeShowrunnerString(meta.title)
    const runId = normalizeShowrunnerString(meta.run_id)
    const segments = readSegments(meta.segments)
    if (!title) errors.push(scriptError('title is required.', 'title'))
    if (!runId) errors.push(scriptError('run_id is required.', 'run_id'))
    if (segments.length === 0) errors.push(scriptError('segments must include speaker and text.', 'segments'))
    if (errors.length > 0) return { ok: false, errors }
    return { ok: true, script: { schema: SHOWRUNNER_SCRIPT_SCHEMA, title, run_id: runId, segments } }
  }

  print(script: Script): string {
    return [
      '---',
      `schema: ${yamlScalar(SHOWRUNNER_SCRIPT_SCHEMA)}`,
      `title: ${yamlScalar(script.title)}`,
      `run_id: ${yamlScalar(script.run_id)}`,
      `segments: ${yamlFlow(script.segments || [])}`,
      '---',
      '',
      `# ${script.title}`,
      '',
    ].join('\n')
  }
}

export const showrunnerScriptSchema = new ShowrunnerScriptSchema()

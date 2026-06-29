import type { AnnotationSpec, AnnotationTaskId } from './annotationEngineSsot'
import { ANNOTATION_TASK_IDS } from './annotationEngineSsot'

export type AnnotationSpecValidationOk = { ok: true; spec: Readonly<AnnotationSpec> }
export type AnnotationSpecValidationError = {
  ok: false
  errorCode: 'invalid_spec'
  field: string
  reason: string
}
export type AnnotationSpecValidationResult = AnnotationSpecValidationOk | AnnotationSpecValidationError

const invalidSpec = (field: string, reason: string): AnnotationSpecValidationError => ({
  ok: false,
  errorCode: 'invalid_spec',
  field,
  reason,
})

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const isAnnotationTaskId = (value: unknown): value is AnnotationTaskId => {
  return Object.values(ANNOTATION_TASK_IDS).includes(value as AnnotationTaskId)
}

export function validateAnnotationSpec(candidate: unknown): AnnotationSpecValidationResult {
  if (!isPlainRecord(candidate)) return invalidSpec('annotationSpec', 'must be an object')

  const assetUrl = typeof candidate.assetUrl === 'string' ? candidate.assetUrl : ''
  if (!assetUrl.trim()) return invalidSpec('assetUrl', 'required')
  if (assetUrl.length > 2048) return invalidSpec('assetUrl', 'must be at most 2048 characters')

  if (candidate.assetType !== 'image' && candidate.assetType !== 'video_frame') {
    return invalidSpec('assetType', 'must be image or video_frame')
  }
  const assetType = candidate.assetType

  if (!Array.isArray(candidate.tasks)) return invalidSpec('tasks', 'must be a non-empty array')
  if (candidate.tasks.length < 1) return invalidSpec('tasks', 'must include at least one task')
  if (candidate.tasks.length > 6) return invalidSpec('tasks', 'must include at most 6 tasks')
  for (const task of candidate.tasks) {
    if (!isAnnotationTaskId(task)) return invalidSpec('tasks', `unrecognised task: ${String(task)}`)
  }

  const modelHint = typeof candidate.modelHint === 'string' ? candidate.modelHint : undefined
  if (typeof candidate.modelHint !== 'undefined' && typeof candidate.modelHint !== 'string') {
    return invalidSpec('modelHint', 'must be a string when provided')
  }
  if (typeof modelHint === 'string' && modelHint.length > 255) {
    return invalidSpec('modelHint', 'must be at most 255 characters')
  }

  const frameTimestampMs = candidate.frameTimestampMs
  if (assetType === 'video_frame') {
    if (typeof frameTimestampMs !== 'number' || !Number.isInteger(frameTimestampMs)) {
      return invalidSpec('frameTimestampMs', 'required for video_frame')
    }
    if (frameTimestampMs < 0) return invalidSpec('frameTimestampMs', 'must be >= 0')
  } else if (typeof frameTimestampMs !== 'undefined') {
    if (typeof frameTimestampMs !== 'number' || !Number.isInteger(frameTimestampMs) || frameTimestampMs < 0) {
      return invalidSpec('frameTimestampMs', 'must be an integer >= 0 when provided')
    }
  }

  return {
    ok: true,
    spec: {
      assetUrl,
      assetType,
      tasks: [...candidate.tasks],
      ...(typeof modelHint === 'string' ? { modelHint } : {}),
      ...(typeof frameTimestampMs === 'number' ? { frameTimestampMs } : {}),
    },
  }
}

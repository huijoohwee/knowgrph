import type { AnnotationResult, AnnotationTaskOutput } from './annotationEngineSsot'
import { ANNOTATION_TASK_IDS } from './annotationEngineSsot'

export type LlmReadyPayload = {
  assetUrl: string
  modelId: string
  schemaVersion: string
  tasks: Record<string, AnnotationTaskOutput>
}

const hasText = (value: AnnotationTaskOutput | undefined): value is { text: string } => {
  return Boolean(value && 'text' in value && typeof value.text === 'string' && value.text.trim())
}

const hasObjects = (
  value: AnnotationTaskOutput | undefined,
): value is { objects: Array<{ label: string; bbox: [number, number, number, number]; confidence?: number }> } => {
  return Boolean(value && 'objects' in value && Array.isArray(value.objects))
}

const hasError = (value: AnnotationTaskOutput | undefined): value is { error: string } => {
  return Boolean(value && 'error' in value && typeof value.error === 'string')
}

export function toLlmReadyPayload(result: AnnotationResult): LlmReadyPayload {
  if (!result || result.ok !== true) {
    throw new TypeError('toLlmReadyPayload requires ok:true result')
  }
  return {
    assetUrl: result.assetUrl,
    modelId: result.modelId,
    schemaVersion: result.schemaVersion,
    tasks: result.tasks,
  }
}

export function toMarkdownSummary(result: AnnotationResult): string {
  if (!result || result.ok !== true) return 'No annotation data is available.'

  const sections: string[] = []
  const caption =
    result.tasks[ANNOTATION_TASK_IDS.caption]
    || result.tasks[ANNOTATION_TASK_IDS.detailedCaption]
    || result.tasks[ANNOTATION_TASK_IDS.moreDetailedCaption]
  if (hasText(caption)) {
    sections.push(['## Caption', caption.text.trim()].join('\n\n'))
  }

  const detection = result.tasks[ANNOTATION_TASK_IDS.objectDetection]
  if (hasObjects(detection) && detection.objects.length > 0) {
    sections.push([
      '## Detected Objects',
      ...detection.objects.map(object => `- ${String(object.label || '').trim() || 'unlabelled'}`),
    ].join('\n'))
  }

  const failedTasks = Object.keys(result.tasks)
    .filter(task => hasError(result.tasks[task]))
    .sort((left, right) => left.localeCompare(right))
  if (failedTasks.length > 0) {
    sections.push(['## Failed Tasks', ...failedTasks.map(task => `- ${task} (failed)`)].join('\n'))
  }

  return sections.length > 0 ? sections.join('\n\n') : 'No annotation data is available.'
}

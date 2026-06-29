import type { WorkspaceFs } from '@/features/workspace-fs/types'
import type { GraphNode } from '@/lib/graph/types'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import type { GeneratedBinaryAsset } from '@/features/chat/byteplusRunGeneration'
import { writeRichMediaWidgetRunOutputArtifact } from '@/features/chat/richMediaRun'
import {
  ANNOTATION_SCHEMA_VERSION,
  type AnnotationError,
  type AnnotationResult,
  type AnnotationRunResult,
  type AnnotationSpec,
  type WorkerRequest,
} from './annotationEngineSsot'
import { resolveAnnotationModel } from './annotationModelRegistry'
import { validateAnnotationSpec } from './annotationSpec'

export type AnnotationWorkerResult = Omit<AnnotationResult, 'annotationId' | 'ok'>

export type AnnotationWorkerHandle = {
  dispatch(request: WorkerRequest, onProgress?: (loaded: number, total: number) => void): Promise<AnnotationWorkerResult>
}

export type AnnotationArtifactWriter = typeof writeRichMediaWidgetRunOutputArtifact

const readErrorReason = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error || 'unknown error')
}

const nextRequestId = (() => {
  let value = 0
  return () => {
    value += 1
    return `annotation-${value}`
  }
})()

const buildAnnotationJsonAsset = (result: AnnotationResult): GeneratedBinaryAsset => {
  const text = JSON.stringify(result, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  return {
    blob,
    renderUrl: `data:application/json;charset=utf-8,${encodeURIComponent(text)}`,
    sourceUrl: result.assetUrl,
    model: result.modelId,
  }
}

export function buildAnnotationId(assetUrl: string, tasks: readonly string[], modelId: string): string {
  const sortedTasks = [...tasks].sort((left, right) => left.localeCompare(right))
  return buildScopedGraphSemanticKey('annotation', {
    graphSemanticKey: JSON.stringify({ assetUrl, tasks: sortedTasks, modelId }),
  })
}

export function createAnnotationWorkerHandle(): AnnotationWorkerHandle {
  let worker: Worker | null = null
  let queue = Promise.resolve()
  const pending = new Map<string, {
    resolve: (result: AnnotationWorkerResult) => void
    reject: (error: Error) => void
    onProgress?: (loaded: number, total: number) => void
  }>()

  const ensureWorker = (): Worker => {
    if (typeof Worker === 'undefined') throw new Error('Web Workers unavailable')
    if (!worker) {
      worker = new Worker(new URL('./annotationWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; requestId?: string; loaded?: number; total?: number; result?: AnnotationWorkerResult; reason?: string }
        const requestId = String(data.requestId || '')
        const entry = pending.get(requestId)
        if (!entry) return
        if (data.type === 'progress') {
          entry.onProgress?.(Number(data.loaded || 0), Number(data.total || 0))
          return
        }
        pending.delete(requestId)
        if (data.type === 'result' && data.result) {
          entry.resolve(data.result)
          return
        }
        entry.reject(new Error(String(data.reason || 'inference_failed')))
      }
      worker.onerror = (event) => {
        const error = new Error(event.message || 'worker error')
        for (const [requestId, entry] of pending) {
          pending.delete(requestId)
          entry.reject(error)
        }
      }
    }
    return worker
  }

  return {
    dispatch(request, onProgress) {
      const run = () => new Promise<AnnotationWorkerResult>((resolve, reject) => {
        const activeWorker = ensureWorker()
        pending.set(request.requestId, { resolve, reject, onProgress })
        activeWorker.postMessage(request)
      })
      const next = queue.then(run, run)
      queue = next.then(() => undefined, () => undefined)
      return next
    },
  }
}

const buildWorkerUnsupportedError = (): AnnotationError => ({
  ok: false,
  errorCode: 'worker_not_supported',
  reason: 'Web Workers unavailable',
})

export async function runAnnotationJob(args: {
  spec: unknown
  node: GraphNode
  worker?: AnnotationWorkerHandle | null
  workspacePath?: string | null
  fs?: WorkspaceFs | null
  onProgress?: (loaded: number, total: number) => void
  artifactWriter?: AnnotationArtifactWriter
}): Promise<AnnotationRunResult> {
  const validation = validateAnnotationSpec(args.spec)
  if (validation.ok === false) {
    return {
      ok: false,
      errorCode: validation.errorCode,
      field: validation.field,
      reason: validation.reason,
    }
  }

  const modelResolution = resolveAnnotationModel(validation.spec.modelHint)
  if (modelResolution.ok === false) {
    return {
      ok: false,
      errorCode: modelResolution.errorCode,
      modelId: modelResolution.modelId,
      reason: modelResolution.modelId,
    }
  }

  const worker = args.worker || createAnnotationWorkerHandle()
  const request: WorkerRequest = {
    type: 'annotate',
    requestId: nextRequestId(),
    spec: validation.spec as AnnotationSpec,
    modelId: modelResolution.modelId,
  }

  let workerResult: AnnotationWorkerResult
  try {
    workerResult = await worker.dispatch(request, args.onProgress)
  } catch (error) {
    const reason = readErrorReason(error)
    if (reason === 'Web Workers unavailable') return buildWorkerUnsupportedError()
    return {
      ok: false,
      errorCode: 'inference_failed',
      modelId: modelResolution.modelId,
      reason,
    }
  }

  const annotationId = buildAnnotationId(validation.spec.assetUrl, validation.spec.tasks, modelResolution.modelId)
  if (!annotationId) {
    return { ok: false, errorCode: 'invalid_spec', field: 'assetUrl', reason: 'required' }
  }

  const result: AnnotationResult = {
    ok: true,
    annotationId,
    assetUrl: workerResult.assetUrl,
    assetType: workerResult.assetType,
    modelId: modelResolution.modelId,
    tasks: workerResult.tasks,
    processedAt: workerResult.processedAt,
    durationMs: Math.max(1, Math.floor(workerResult.durationMs || 1)),
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
    ...(typeof workerResult.frameTimestampMs === 'number' ? { frameTimestampMs: workerResult.frameTimestampMs } : {}),
  }

  try {
    const artifactWriter = args.artifactWriter || writeRichMediaWidgetRunOutputArtifact
    const output = await artifactWriter({
      workspacePath: args.workspacePath,
      node: args.node,
      kind: 'annotation',
      extension: 'json',
      asset: buildAnnotationJsonAsset(result),
      fs: args.fs,
      manifestMetadata: [
        ['annotationId', annotationId],
        ['assetUrl', result.assetUrl],
        ['modelId', result.modelId],
        ['sortedTasks', [...validation.spec.tasks].sort((left, right) => left.localeCompare(right)).join(',')],
      ],
    })
    return {
      ...result,
      outputPath: output.outputPath,
      outputManifestPath: output.outputPath ? output.outputManifestPath : null,
      outputStorageUrl: output.outputStorageUrl || null,
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: 'artifact_write_failed',
      modelId: modelResolution.modelId,
      reason: readErrorReason(error),
    }
  }
}

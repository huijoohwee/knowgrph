import { parsePlyPointCloud, type PlyPointCloud } from './plyPointCloud'

type PlyParseWorkerRequest = {
  requestId: number
  buffer: ArrayBuffer
  maxPoints: number
}

type PlyParseWorkerResponse = {
  requestId: number
  ok: true
  pointCloud: PlyPointCloud
} | {
  requestId: number
  ok: false
  error: string
}

type PlyPointCloudWorkerScope = {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<PlyParseWorkerRequest>) => void,
  ) => void
  postMessage: (message: PlyParseWorkerResponse, transfers?: Transferable[]) => void
}

const workerScope = globalThis as unknown as PlyPointCloudWorkerScope

function pushTransferableBuffer(transfers: Transferable[], value: ArrayBufferLike | null | undefined): void {
  if (value instanceof ArrayBuffer) transfers.push(value)
}

function collectPointCloudTransfers(pointCloud: PlyPointCloud): Transferable[] {
  const transfers: Transferable[] = []
  pushTransferableBuffer(transfers, pointCloud.positions.buffer)
  pushTransferableBuffer(transfers, pointCloud.colors?.buffer)
  pushTransferableBuffer(transfers, pointCloud.opacities?.buffer)
  pushTransferableBuffer(transfers, pointCloud.splatScales?.buffer)
  pushTransferableBuffer(transfers, pointCloud.splatRotations?.buffer)
  return transfers
}

function postPlyParseWorkerResponse(message: PlyParseWorkerResponse, transfers: Transferable[] = []): void {
  workerScope.postMessage(message, transfers)
}

workerScope.addEventListener('message', (event: MessageEvent<PlyParseWorkerRequest>) => {
  const { requestId, buffer, maxPoints } = event.data
  try {
    const pointCloud = parsePlyPointCloud(buffer, maxPoints)
    postPlyParseWorkerResponse({ requestId, ok: true, pointCloud }, collectPointCloudTransfers(pointCloud))
  } catch (error) {
    postPlyParseWorkerResponse({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : 'PLY parse worker failed',
    })
  }
})

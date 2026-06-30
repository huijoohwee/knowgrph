import type { WorkspacePath } from '@/features/workspace-fs/types'

export type SpatialCaptureFilesetRole = 'point-cloud-ply' | 'gaussian-splat-spz' | 'panorama-image' | 'collider-glb'

export type SpatialCaptureFilesetFile = {
  file: File
  originalName: string
  relativePath: string
  folderPath: string
  role: SpatialCaptureFilesetRole
  byteSize: number
}

export type SpatialCaptureFileset = {
  key: string
  baseName: string
  folderPath: string
  files: SpatialCaptureFilesetFile[]
  pointCloud: SpatialCaptureFilesetFile
  gaussianSplat: SpatialCaptureFilesetFile
  panorama: SpatialCaptureFilesetFile
  collider: SpatialCaptureFilesetFile
}

const SPATIAL_CAPTURE_PANORAMA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function readFileExtension(value: string): string {
  const base = String(value || '').split('/').filter(Boolean).pop() || ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

function readBasename(value: string): string {
  return String(value || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''
}

function readFolderPath(value: string): string {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  const slash = normalized.lastIndexOf('/')
  return slash > 0 ? normalized.slice(0, slash) : ''
}

function stripExtension(value: string): string {
  const base = readBasename(value)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

function normalizeGroupStem(value: string, role: SpatialCaptureFilesetRole): string {
  let stem = String(value || '').trim()
  if (role === 'collider-glb') stem = stem.replace(/(?:[-_. ]?collider)$/i, '')
  if (role === 'panorama-image') stem = stem.replace(/(?:[-_. ]?(panorama|pano|equirect|equirectangular|360))$/i, '')
  return stem.trim() || value
}

function sanitizeManifestStem(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'spatial-capture'
}

function readFileRelativePath(file: File): string {
  const anyFile = file as unknown as { webkitRelativePath?: unknown }
  const rel = typeof anyFile.webkitRelativePath === 'string' ? anyFile.webkitRelativePath : ''
  return String(rel || file.name || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

export function classifySpatialCaptureFilesetRole(name: string, mimeHint?: string | null): SpatialCaptureFilesetRole | null {
  const base = readBasename(name).toLowerCase()
  const ext = readFileExtension(base)
  if (ext === '.ply') return 'point-cloud-ply'
  if (ext === '.spz') return 'gaussian-splat-spz'
  if (ext === '.glb' && /(?:^|[-_. ])collider(?:[-_. ]|$)/i.test(base)) return 'collider-glb'
  const mime = String(mimeHint || '').toLowerCase().split(';')[0]
  if (SPATIAL_CAPTURE_PANORAMA_EXTENSIONS.has(ext) && (/(?:^|[-_. ])(panorama|pano|equirect|equirectangular|360)(?:[-_. ]|$)/i.test(base) || mime.startsWith('image/'))) {
    return 'panorama-image'
  }
  return null
}

export function isSpatialCaptureImportName(name: string, mimeHint?: string | null): boolean {
  return classifySpatialCaptureFilesetRole(name, mimeHint) !== null
}

export function resolveSpatialCaptureFilesets(files: ReadonlyArray<File>): SpatialCaptureFileset[] {
  const groups = new Map<string, SpatialCaptureFilesetFile[]>()
  for (const file of files) {
    const originalName = String(file?.name || '').trim()
    if (!originalName) continue
    const relativePath = readFileRelativePath(file)
    const role = classifySpatialCaptureFilesetRole(originalName, file.type)
    if (!role) continue
    const folderPath = readFolderPath(relativePath)
    const baseName = normalizeGroupStem(stripExtension(originalName), role)
    const key = `${folderPath}\n${baseName.toLowerCase()}`
    const item: SpatialCaptureFilesetFile = {
      file,
      originalName,
      relativePath,
      folderPath,
      role,
      byteSize: Math.max(0, Number(file.size || 0)),
    }
    const existing = groups.get(key) || []
    existing.push(item)
    groups.set(key, existing)
  }

  const out: SpatialCaptureFileset[] = []
  for (const [key, groupFiles] of groups) {
    const pointCloud = groupFiles.find(file => file.role === 'point-cloud-ply')
    const gaussianSplat = groupFiles.find(file => file.role === 'gaussian-splat-spz')
    const panorama = groupFiles.find(file => file.role === 'panorama-image')
    const collider = groupFiles.find(file => file.role === 'collider-glb')
    if (!pointCloud || !gaussianSplat || !panorama || !collider) continue
    const baseName = sanitizeManifestStem(normalizeGroupStem(stripExtension(pointCloud.originalName), 'point-cloud-ply'))
    out.push({
      key,
      baseName,
      folderPath: pointCloud.folderPath,
      files: groupFiles,
      pointCloud,
      gaussianSplat,
      panorama,
      collider,
    })
  }
  return out
}

export function deriveSpatialCaptureManifestName(fileset: Pick<SpatialCaptureFileset, 'baseName'>): string {
  return `${sanitizeManifestStem(fileset.baseName)}.spatial-capture.md`
}

function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function formatRoleLine(file: SpatialCaptureFilesetFile): string {
  return `- ${file.role}: ${file.originalName} (${file.byteSize} bytes)`
}

export function buildSpatialCaptureFilesetManifestMarkdown(args: {
  fileset: SpatialCaptureFileset
  colliderWorkspacePath: WorkspacePath
  colliderDocumentName: string
}): string {
  const totalBytes = args.fileset.files.reduce((sum, file) => sum + file.byteSize, 0)
  return [
    '---',
    'kgAssetType: "model"',
    'kgAssetFormat: "glb"',
    `kgAssetName: ${yamlQuote(args.colliderDocumentName)}`,
    'kgAssetSource: "local"',
    'kgAssetMimeType: "model/gltf-binary"',
    'kgAssetPendingLocalImport: true',
    `kgAssetPendingLocalPath: ${yamlQuote(args.colliderWorkspacePath)}`,
    `kgAssetBytes: ${args.fileset.collider.byteSize}`,
    'kgSpatialCaptureFileset: true',
    'kgSpatialCaptureFormat: "ply+spz+panorama+glb-collider"',
    'kgSpatialCaptureCoordinateSystem: "right-handed-y-up"',
    'kgSpatialCaptureMovementPlane: "x/z"',
    `kgSpatialCaptureSourceCount: ${args.fileset.files.length}`,
    `kgSpatialCaptureTotalBytes: ${totalBytes}`,
    `kgSpatialCapturePointCloudBytes: ${args.fileset.pointCloud.byteSize}`,
    `kgSpatialCaptureGaussianSplatBytes: ${args.fileset.gaussianSplat.byteSize}`,
    `kgSpatialCapturePanoramaBytes: ${args.fileset.panorama.byteSize}`,
    `kgSpatialCaptureColliderBytes: ${args.fileset.collider.byteSize}`,
    'kgCanvasSurfaceMode: "xr"',
    'kgCanvasRenderMode: "3d"',
    'kgCanvas3dMode: "xr"',
    '---',
    '',
    `# ${args.fileset.baseName} spatial capture`,
    '',
    'Imported spatial capture fileset.',
    '',
    '## Runtime roles',
    '',
    ...args.fileset.files.map(formatRoleLine),
    '',
    '## Render contract',
    '',
    '- Collider GLB is the XR renderable payload.',
    '- PLY point cloud, SPZ gaussian splat, and panorama image remain source-owned fileset members.',
    '- Coordinates are interpreted as right-handed Y-up with X/Z as the ground plane.',
    '',
  ].join('\n')
}

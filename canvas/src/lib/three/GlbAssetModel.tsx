import React from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Canvas3dModeId } from '@/lib/config'
import type { GlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { readPendingGlbAssetPayload } from '@/lib/assets/glbAssetRuntime'

type GlbFit = {
  position: [number, number, number]
  scale: number
  floorY: number
  stageSpan: number
}

type StageBlock = {
  key: string
  position: [number, number, number]
  size: [number, number, number]
  color: string
}

type StageTrafficParticle = {
  key: string
  axis: 'x' | 'z'
  lane: number
  offset: number
  color: string
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function decodeBase64DataUrl(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const encoded = dataUrl.slice(comma + 1)
  if (!encoded) return null
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(out).set(bytes)
  return out
}

function deriveGltfBasePath(sourceUrl: string | undefined): string {
  const raw = String(sourceUrl || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw, window.location.href)
    u.hash = ''
    u.search = ''
    const pathname = String(u.pathname || '')
    u.pathname = pathname.includes('/') ? pathname.slice(0, pathname.lastIndexOf('/') + 1) : '/'
    return u.toString()
  } catch {
    const normalized = raw.replace(/\\/g, '/')
    const slash = normalized.lastIndexOf('/')
    return slash >= 0 ? normalized.slice(0, slash + 1) : ''
  }
}

function disposeObject3d(object: THREE.Object3D): void {
  object.traverse(child => {
    const mesh = child as THREE.Mesh
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined
    if (geometry && typeof geometry.dispose === 'function') {
      try {
        geometry.dispose()
      } catch {
        void 0
      }
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    const materials = Array.isArray(material) ? material : material ? [material] : []
    for (const mat of materials) {
      try {
        mat.dispose()
      } catch {
        void 0
      }
    }
  })
}

function prepareModelObject(object: THREE.Object3D, name: string): void {
  object.name = name || object.name || 'Model asset'
  object.traverse(child => {
    const mesh = child as THREE.Mesh
    if (!mesh || !(mesh as unknown as { isMesh?: boolean }).isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

function computeGlbFit(object: THREE.Object3D | null): GlbFit {
  if (!object) {
    return { position: [0, 0, 0], scale: 1, floorY: -48, stageSpan: 180 }
  }
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) {
    return { position: [0, 0, 0], scale: 1, floorY: -48, stageSpan: 180 }
  }
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = maxDim > 0 && Number.isFinite(maxDim) ? clamp(118 / maxDim, 0.0001, 10000) : 1
  const floorY = (box.min.y - center.y) * scale
  const stageSpan = clamp(Math.max(size.x, size.z, maxDim) * scale * 2.8, 120, 520)
  return {
    position: [-center.x * scale, -center.y * scale, -center.z * scale],
    scale,
    floorY,
    stageSpan,
  }
}

function buildStageBlocks(fit: GlbFit): StageBlock[] {
  const span = fit.stageSpan
  const cell = span / 8
  const floorY = fit.floorY
  const colors = ['#0f766e', '#2563eb', '#9333ea', '#f97316', '#0891b2', '#7c3aed']
  const blocks: StageBlock[] = []
  for (let gx = -3; gx <= 3; gx += 1) {
    for (let gz = -3; gz <= 3; gz += 1) {
      if (gx === 0 || gz === 0) continue
      const seed = Math.abs(gx * 17 + gz * 31)
      const width = cell * (0.72 + (seed % 3) * 0.12)
      const depth = cell * (0.66 + (seed % 4) * 0.09)
      const height = cell * (0.22 + (seed % 5) * 0.12)
      blocks.push({
        key: `${gx}:${gz}`,
        position: [gx * cell, floorY + height * 0.5, gz * cell],
        size: [width, height, depth],
        color: colors[seed % colors.length] || '#2563eb',
      })
    }
  }
  return blocks
}

function buildStageTrafficParticles(): StageTrafficParticle[] {
  const colors = ['#22c55e', '#38bdf8', '#f59e0b', '#f472b6']
  const particles: StageTrafficParticle[] = []
  for (let i = 0; i < 16; i += 1) {
    particles.push({
      key: `traffic:${i}`,
      axis: i % 2 === 0 ? 'x' : 'z',
      lane: i % 4 < 2 ? -1 : 1,
      offset: i / 16,
      color: colors[i % colors.length] || '#38bdf8',
    })
  }
  return particles
}

function ModelAssetXrTraffic({ fit, visible }: { fit: GlbFit; visible: boolean }) {
  const meshRefs = React.useRef<Record<string, THREE.Mesh | null>>({})
  const particles = React.useMemo(() => buildStageTrafficParticles(), [])
  useFrame(({ clock }) => {
    if (!visible) return
    const span = Math.max(1, fit.stageSpan)
    const roadHalf = span * 0.5
    const laneOffset = span * 0.018
    const t = clock.getElapsedTime() * 0.055
    for (const particle of particles) {
      const mesh = meshRefs.current[particle.key]
      if (!mesh) continue
      const p = ((t + particle.offset) % 1) * 2 - 1
      const travel = p * roadHalf
      const lane = particle.lane * laneOffset
      if (particle.axis === 'x') {
        mesh.position.set(travel, fit.floorY + 1.05, lane)
        mesh.scale.set(span * 0.012, span * 0.004, span * 0.006)
      } else {
        mesh.position.set(lane, fit.floorY + 1.05, travel)
        mesh.scale.set(span * 0.006, span * 0.004, span * 0.012)
      }
    }
  })
  if (!visible) return null
  return (
    <group name="kg_model_xr_traffic_loop">
      {particles.map(particle => (
        <mesh
          key={particle.key}
          ref={el => {
            meshRefs.current[particle.key] = el
          }}
          name={`kg_model_xr_traffic_${particle.key.replace(':', '_')}`}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={particle.color} emissive={particle.color} emissiveIntensity={0.62} roughness={0.36} metalness={0.12} />
        </mesh>
      ))}
    </group>
  )
}

function ModelAssetXrStage({ fit, visible }: { fit: GlbFit; visible: boolean }) {
  if (!visible) return null
  const markerOffset = fit.stageSpan * 0.28
  const roadWidth = fit.stageSpan * 0.08
  const stageBlocks = buildStageBlocks(fit)
  return (
    <group name="kg_model_xr_stage">
      <gridHelper
        args={[fit.stageSpan, 24, '#5b8cff', '#334155']}
        position={[0, fit.floorY - 0.02, 0]}
        material-transparent={true}
        material-opacity={0.28}
      />
      <group name="kg_model_xr_city_grid">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, fit.floorY + 0.005, 0]} receiveShadow>
          <planeGeometry args={[fit.stageSpan, roadWidth]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.42} roughness={0.88} metalness={0.04} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, fit.floorY + 0.006, 0]} receiveShadow>
          <planeGeometry args={[fit.stageSpan, roadWidth]} />
          <meshStandardMaterial color="#172554" transparent opacity={0.32} roughness={0.88} metalness={0.04} />
        </mesh>
        {stageBlocks.map(block => (
          <mesh key={block.key} name={`kg_model_xr_city_block_${block.key}`} position={block.position}>
            <boxGeometry args={block.size} />
            <meshStandardMaterial
              color={block.color}
              emissive={block.color}
              emissiveIntensity={0.12}
              transparent
              opacity={0.28}
              roughness={0.7}
              metalness={0.12}
            />
          </mesh>
        ))}
      </group>
      <ModelAssetXrTraffic fit={fit} visible={visible} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, fit.floorY - 0.04, 0]} receiveShadow>
        <planeGeometry args={[fit.stageSpan, fit.stageSpan]} />
        <meshStandardMaterial color="#111827" transparent opacity={0.08} roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh name="kg_model_xr_orientation_ring" rotation={[-Math.PI / 2, 0, 0]} position={[0, fit.floorY + 0.02, 0]}>
        <torusGeometry args={[fit.stageSpan * 0.18, fit.stageSpan * 0.0028, 8, 96]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0e7490" emissiveIntensity={0.3} roughness={0.48} metalness={0.08} />
      </mesh>
      <group name="kg_model_xr_perimeter_markers">
        {[
          [0, markerOffset, '#22c55e'],
          [markerOffset, 0, '#f59e0b'],
          [0, -markerOffset, '#60a5fa'],
          [-markerOffset, 0, '#f472b6'],
        ].map(([x, z, color], index) => (
          <mesh key={index} name={`kg_model_xr_waypoint_${index}`} position={[Number(x), fit.floorY + 0.62, Number(z)]}>
            <octahedronGeometry args={[fit.stageSpan * 0.014, 0]} />
            <meshStandardMaterial color={String(color)} emissive={String(color)} emissiveIntensity={0.42} roughness={0.5} metalness={0.06} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function GlbAssetModel({
  asset,
  mode,
  paused,
  standalone,
}: {
  asset: GlbAssetDocument
  mode?: Canvas3dModeId
  paused?: boolean
  standalone?: boolean
}) {
  const [object, setObject] = React.useState<THREE.Object3D | null>(null)
  const [failed, setFailed] = React.useState(false)
  const groupRef = React.useRef<THREE.Group | null>(null)
  const mixerRef = React.useRef<THREE.AnimationMixer | null>(null)

  React.useEffect(() => {
    let cancelled = false
    let loadedObject: THREE.Object3D | null = null
    let loadedMixer: THREE.AnimationMixer | null = null
    mixerRef.current = null
    setObject(null)
    setFailed(false)

    const load = async () => {
      try {
        if (asset.format === 'glb' && asset.validMagic === false) throw new Error('Invalid GLB magic')
        if (asset.format === 'gltf' && asset.validJson === false) throw new Error('Invalid GLTF JSON')
        const resolved = asset.dataUrl
          ? { dataUrl: asset.dataUrl, validMagic: asset.validMagic, validJson: asset.validJson }
          : asset.pendingLocalImportPath
            ? await readPendingGlbAssetPayload(asset.pendingLocalImportPath)
            : null
        if (!resolved) throw new Error('Missing model asset data')
        if (asset.format === 'glb' && resolved.validMagic === false) throw new Error('Invalid GLB magic')
        if (asset.format === 'gltf' && resolved.validJson === false) throw new Error('Invalid GLTF JSON')
        const bytes = decodeBase64DataUrl(resolved.dataUrl)
        if (!bytes) throw new Error('Invalid model data URL')
        const loaderInput = asset.format === 'gltf'
          ? new TextDecoder().decode(bytes)
          : bytesToArrayBuffer(bytes)
        const basePath = asset.format === 'gltf' ? deriveGltfBasePath(asset.sourceUrl) : ''
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
        const loader = new GLTFLoader()
        loader.parse(
          loaderInput,
          basePath,
          gltf => {
            const scene = gltf.scene || gltf.scenes?.[0] || null
            if (!scene) {
              if (!cancelled) setFailed(true)
              return
            }
            prepareModelObject(scene, asset.name)
            if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
              loadedMixer = new THREE.AnimationMixer(scene)
              for (const clip of gltf.animations) {
                try {
                  loadedMixer.clipAction(clip).play()
                } catch {
                  void 0
                }
              }
            }
            if (cancelled) {
              try {
                loadedMixer?.stopAllAction()
                loadedMixer?.uncacheRoot(scene)
              } catch {
                void 0
              }
              disposeObject3d(scene)
              return
            }
            loadedObject = scene
            mixerRef.current = loadedMixer
            setObject(scene)
          },
          () => {
            if (!cancelled) setFailed(true)
          },
        )
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void load()
    return () => {
      cancelled = true
      mixerRef.current = null
      if (loadedMixer && loadedObject) {
        try {
          loadedMixer.stopAllAction()
          loadedMixer.uncacheRoot(loadedObject)
        } catch {
          void 0
        }
      }
      if (loadedObject) {
        disposeObject3d(loadedObject)
        loadedObject = null
      }
    }
  }, [asset.dataUrl, asset.format, asset.name, asset.pendingLocalImportPath, asset.sourceUrl, asset.validJson, asset.validMagic])

  useFrame((_, delta) => {
    if (paused) return
    try {
      mixerRef.current?.update(delta)
    } catch {
      void 0
    }
    if (mode !== 'xr') return
    const group = groupRef.current
    if (!group) return
    group.rotation.y += delta * 0.08
  })

  const fit = React.useMemo(() => computeGlbFit(object), [object])
  const showStage = mode === 'xr' || standalone

  return (
    <group name="kg_model_asset_scene">
      {standalone ? (
        <>
          <ambientLight intensity={0.82} />
          <hemisphereLight args={['#ffffff', '#94a3b8', 0.55]} />
          <directionalLight castShadow position={[96, 130, 160]} intensity={0.96} color="#ffffff" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
          <pointLight position={[-120, 80, 120]} intensity={0.35} color="#bfdbfe" />
        </>
      ) : null}
      <ModelAssetXrStage fit={fit} visible={showStage} />
      {object ? (
        <group
          ref={groupRef}
          name={`kg_model_asset:${asset.name}`}
          position={fit.position}
          scale={[fit.scale, fit.scale, fit.scale]}
        >
          <primitive object={object} />
        </group>
      ) : failed ? (
        <mesh name="kg_model_asset_load_error" position={[0, 0, 0]}>
          <boxGeometry args={[48, 48, 48]} />
          <meshStandardMaterial color="#ef4444" roughness={0.55} metalness={0.08} wireframe />
        </mesh>
      ) : (
        <mesh name="kg_model_asset_loading" position={[0, 0, 0]}>
          <boxGeometry args={[36, 36, 36]} />
          <meshStandardMaterial color="#60a5fa" roughness={0.65} metalness={0.12} wireframe />
        </mesh>
      )}
    </group>
  )
}

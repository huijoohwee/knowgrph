import React from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Canvas3dModeId } from '@/lib/config'
import type { GlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { loadModelAssetRenderPayload } from '@/lib/assets/modelAssetPayload'

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

type StageHorizonTile = {
  key: string
  angle: number
  radius: number
  height: number
  color: string
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
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
  const cell = span / 10
  const floorY = fit.floorY
  const colors = ['#0f766e', '#1d4ed8', '#7e22ce', '#ea580c', '#0891b2', '#6d28d9']
  const blocks: StageBlock[] = []
  for (let gx = -5; gx <= 5; gx += 1) {
    for (let gz = -5; gz <= 5; gz += 1) {
      if (gx === 0 || gz === 0 || gx % 3 === 0 || gz % 3 === 0) continue
      const seed = Math.abs(gx * 19 + gz * 37)
      const width = cell * (0.58 + (seed % 3) * 0.11)
      const depth = cell * (0.56 + (seed % 4) * 0.08)
      const height = cell * (0.28 + (seed % 8) * 0.09)
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

function buildStageHorizonTiles(fit: GlbFit): StageHorizonTile[] {
  const colors = ['#60a5fa', '#38bdf8', '#a78bfa', '#f59e0b']
  const tiles: StageHorizonTile[] = []
  for (let i = 0; i < 24; i += 1) {
    tiles.push({
      key: `horizon:${i}`,
      angle: (i / 24) * Math.PI * 2,
      radius: fit.stageSpan * (0.55 + (i % 3) * 0.018),
      height: fit.stageSpan * (0.018 + (i % 5) * 0.004),
      color: colors[i % colors.length] || '#60a5fa',
    })
  }
  return tiles
}

function buildStageTrafficParticles(): StageTrafficParticle[] {
  const colors = ['#22c55e', '#38bdf8', '#f59e0b', '#f472b6']
  const particles: StageTrafficParticle[] = []
  for (let i = 0; i < 24; i += 1) {
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

function ModelAssetXrStreamingRing({ fit, visible }: { fit: GlbFit; visible: boolean }) {
  const meshRefs = React.useRef<Record<string, THREE.Mesh | null>>({})
  const tiles = React.useMemo(() => buildStageHorizonTiles(fit), [fit])
  useFrame(({ clock }) => {
    if (!visible) return
    const t = clock.getElapsedTime()
    for (const tile of tiles) {
      const mesh = meshRefs.current[tile.key]
      if (!mesh) continue
      const pulse = 1 + Math.sin(t * 0.9 + tile.angle * 3) * 0.18
      mesh.scale.y = pulse
      const material = mesh.material as THREE.Material | undefined
      if (material) material.opacity = 0.18 + (pulse - 0.82) * 0.18
    }
  })
  if (!visible) return null
  return (
    <group name="kg_model_xr_streaming_ring">
      {tiles.map(tile => (
        <mesh
          key={tile.key}
          ref={el => {
            meshRefs.current[tile.key] = el
          }}
          name={`kg_model_xr_horizon_tile_${tile.key.replace(':', '_')}`}
          position={[Math.cos(tile.angle) * tile.radius, fit.floorY + tile.height * 0.5, Math.sin(tile.angle) * tile.radius]}
          rotation={[0, -tile.angle, 0]}
        >
          <boxGeometry args={[fit.stageSpan * 0.012, tile.height, fit.stageSpan * 0.045]} />
          <meshStandardMaterial color={tile.color} emissive={tile.color} emissiveIntensity={0.16} transparent opacity={0.2} roughness={0.58} metalness={0.08} />
        </mesh>
      ))}
    </group>
  )
}

function ModelAssetXrStage({ fit, visible }: { fit: GlbFit; visible: boolean }) {
  if (!visible) return null
  const markerOffset = fit.stageSpan * 0.28
  const roadWidth = fit.stageSpan * 0.045
  const stageBlocks = buildStageBlocks(fit)
  const avenueOffsets = [-0.36, -0.18, 0, 0.18, 0.36].map(v => v * fit.stageSpan)
  const laneOffsets = [-0.018, 0.018].map(v => v * fit.stageSpan)
  return (
    <group name="kg_model_xr_stage">
      <gridHelper
        args={[fit.stageSpan, 36, '#60a5fa', '#1e293b']}
        position={[0, fit.floorY - 0.02, 0]}
        material-transparent={true}
        material-opacity={0.2}
      />
      <group name="kg_model_xr_city_grid">
        {avenueOffsets.map((offset, index) => (
          <React.Fragment key={`avenue-${index}`}>
            <mesh name={`kg_model_xr_avenue_x_${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, fit.floorY + 0.005, offset]} receiveShadow>
              <planeGeometry args={[fit.stageSpan, roadWidth]} />
              <meshStandardMaterial color="#0f172a" transparent opacity={0.48} roughness={0.88} metalness={0.04} />
            </mesh>
            <mesh name={`kg_model_xr_avenue_z_${index}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[offset, fit.floorY + 0.006, 0]} receiveShadow>
              <planeGeometry args={[fit.stageSpan, roadWidth]} />
              <meshStandardMaterial color="#172554" transparent opacity={0.36} roughness={0.88} metalness={0.04} />
            </mesh>
          </React.Fragment>
        ))}
        {laneOffsets.map((offset, index) => (
          <React.Fragment key={`lane-${index}`}>
            <mesh name={`kg_model_xr_lane_marker_x_${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, fit.floorY + 0.032, offset]}>
              <planeGeometry args={[fit.stageSpan * 0.96, fit.stageSpan * 0.0028]} />
              <meshStandardMaterial color="#f8fafc" emissive="#f59e0b" emissiveIntensity={0.18} transparent opacity={0.36} roughness={0.44} metalness={0.04} />
            </mesh>
            <mesh name={`kg_model_xr_lane_marker_z_${index}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[offset, fit.floorY + 0.034, 0]}>
              <planeGeometry args={[fit.stageSpan * 0.96, fit.stageSpan * 0.0028]} />
              <meshStandardMaterial color="#f8fafc" emissive="#38bdf8" emissiveIntensity={0.18} transparent opacity={0.32} roughness={0.44} metalness={0.04} />
            </mesh>
          </React.Fragment>
        ))}
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
      <ModelAssetXrStreamingRing fit={fit} visible={visible} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, fit.floorY - 0.04, 0]} receiveShadow>
        <planeGeometry args={[fit.stageSpan, fit.stageSpan]} />
        <meshStandardMaterial color="#111827" transparent opacity={0.08} roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh name="kg_model_xr_focus_target" position={[0, fit.floorY + fit.stageSpan * 0.045, 0]}>
        <dodecahedronGeometry args={[fit.stageSpan * 0.025, 0]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.34} transparent opacity={0.78} roughness={0.42} metalness={0.08} />
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
        const payload = await loadModelAssetRenderPayload(asset)
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
        const loader = new GLTFLoader()
        loader.parse(
          payload.loaderInput,
          payload.basePath,
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

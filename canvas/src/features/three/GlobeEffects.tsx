import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { isRadarFlowEdge, isRadarHubNode, isRadarSpokeEdge } from '@/lib/graph/radarForces'
import type { Vec3 } from '@/features/three/layout'
import { THREE_RENDER_ORDER } from '@/features/three/renderOrder'

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function readNum(value: unknown, fallback: number, min: number, max: number): number {
  const v = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return clamp(v, min, max)
}

function hash01(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function normalize(v: Vec3): THREE.Vector3 {
  const out = new THREE.Vector3(v[0], v[1], v[2])
  if (out.lengthSq() < 1e-8) return new THREE.Vector3(0, 1, 0)
  return out.normalize()
}

function slerpOnSphere(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = clamp(a.dot(b), -1, 1)
  const omega = Math.acos(dot)
  if (omega < 1e-4) return a.clone().lerp(b, t).normalize()
  const sinOmega = Math.sin(omega)
  const w0 = Math.sin((1 - t) * omega) / sinOmega
  const w1 = Math.sin(t * omega) / sinOmega
  return a.clone().multiplyScalar(w0).addScaledVector(b, w1).normalize()
}

export function GlobeEffects({
  data,
  schema,
  positions,
  edgeColor,
  nodeAccentColor,
}: {
  data: GraphData
  schema: GraphSchema
  positions: Record<string, Vec3>
  edgeColor: string
  nodeAccentColor: string
}) {
  const { raycaster } = useThree()
  const threeCfg = getThreeConfig(schema)
  const enabled = threeCfg.globeEffectsEnabled !== false
  React.useEffect(() => {
    ;(raycaster as unknown as { firstHitOnly?: boolean }).firstHitOnly = true
    raycaster.params.Line = { threshold: 6 }
    raycaster.params.Points = { threshold: 8 }
  }, [raycaster])
  const sphereRadius = readNum(threeCfg.sphereRadius, 120, 50, 560)
  const particleCount = Math.floor(readNum(threeCfg.globeParticleCount, 720, 0, 4000))
  const particleSize = readNum(threeCfg.globeParticleSize, 1.35, 0.2, 6)
  const particleWaveSpeed = readNum(threeCfg.globeParticleWaveSpeed, 0.85, 0.05, 4)
  const particleWaveAmplitude = readNum(threeCfg.globeParticleWaveAmplitude, 0.65, 0, 2)
  const atmosphereOpacity = readNum(threeCfg.globeAtmosphereOpacity, 0.22, 0, 0.8)
  const gridDensity = Math.floor(readNum(threeCfg.globeGridDensity, 12, 4, 36))
  const orbitRingCount = Math.floor(readNum(threeCfg.globeOrbitRingCount, 4, 0, 10))
  const toolNodeCount = Math.floor(readNum(threeCfg.globeToolNodeCount, 24, 0, 80))
  const arcCount = Math.floor(readNum(threeCfg.globeArcCount, 12, 0, 36))
  const arcTravelerCount = Math.floor(readNum(threeCfg.globeArcTravelerCount, 1, 0, 4))
  const corePulseStrength = readNum(threeCfg.globeCorePulseStrength, 0.38, 0, 1.6)
  const rippleStrength = readNum(threeCfg.globeRippleStrength, 0.32, 0, 1.2)
  const particleGeometry = React.useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const count = Math.max(0, particleCount)
    const positionsArray = new Float32Array(Math.max(3, count * 3))
    const seedArray = new Float32Array(Math.max(1, count))
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / Math.max(1, count - 1)) * 2
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = GOLDEN_ANGLE * i
      const x = Math.cos(theta) * radiusAtY
      const z = Math.sin(theta) * radiusAtY
      const o = i * 3
      positionsArray[o + 0] = x * sphereRadius
      positionsArray[o + 1] = y * sphereRadius
      positionsArray[o + 2] = z * sphereRadius
      seedArray[i] = hash01(String(i))
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seedArray, 1))
    return geometry
  }, [particleCount, sphereRadius])
  React.useEffect(() => () => particleGeometry.dispose(), [particleGeometry])
  const particleMaterialRef = React.useRef<THREE.ShaderMaterial | null>(null)
  const atmosphereMaterialRef = React.useRef<THREE.ShaderMaterial | null>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (particleMaterialRef.current) {
      particleMaterialRef.current.uniforms.uTime.value = t
      particleMaterialRef.current.uniforms.uSize.value = particleSize
      particleMaterialRef.current.uniforms.uWaveSpeed.value = particleWaveSpeed
      particleMaterialRef.current.uniforms.uWaveAmp.value = particleWaveAmplitude
    }
    if (atmosphereMaterialRef.current) {
      atmosphereMaterialRef.current.uniforms.uTime.value = t
      atmosphereMaterialRef.current.uniforms.uOpacity.value = atmosphereOpacity
    }
  })

  const hubPositions = React.useMemo(() => {
    const list: Vec3[] = []
    for (let i = 0; i < data.nodes.length; i += 1) {
      const n = data.nodes[i]
      if (!n || !isRadarHubNode(n)) continue
      const p = positions[String(n.id)]
      if (!p) continue
      list.push(p)
    }
    return list
  }, [data.nodes, positions])

  const spokeSegments = React.useMemo(() => {
    const segments: Array<[Vec3, Vec3]> = []
    for (let i = 0; i < data.edges.length; i += 1) {
      const edge = data.edges[i]
      if (!edge || !isRadarSpokeEdge(edge)) continue
      const a = positions[String(edge.source)]
      const b = positions[String(edge.target)]
      if (!a || !b) continue
      const aHub = data.nodes.find(n => String(n.id) === String(edge.source))
      const bHub = data.nodes.find(n => String(n.id) === String(edge.target))
      if (aHub && isRadarHubNode(aHub)) segments.push([[0, 0, 0], a])
      if (bHub && isRadarHubNode(bHub)) segments.push([[0, 0, 0], b])
      if (segments.length >= 120) break
    }
    return segments
  }, [data.edges, data.nodes, positions])

  const flowArcs = React.useMemo(() => {
    const arcs: Array<{ id: string; points: THREE.Vector3[] }> = []
    for (let i = 0; i < data.edges.length; i += 1) {
      if (arcs.length >= arcCount) break
      const edge = data.edges[i]
      if (!edge || !isRadarFlowEdge(edge)) continue
      const a = positions[String(edge.source)]
      const b = positions[String(edge.target)]
      if (!a || !b) continue
      const an = normalize(a)
      const bn = normalize(b)
      const points: THREE.Vector3[] = []
      const steps = 36
      const lift = sphereRadius * 0.26
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps
        const p = slerpOnSphere(an, bn, t)
        const arcLift = Math.sin(Math.PI * t) * lift
        points.push(p.multiplyScalar(sphereRadius + arcLift))
      }
      arcs.push({ id: String(edge.id), points })
    }
    return arcs
  }, [arcCount, data.edges, positions, sphereRadius])

  const orbitDefs = React.useMemo(() => {
    const defs: Array<{ id: string; points: THREE.Vector3[]; phase: number; speed: number }> = []
    const count = Math.max(0, orbitRingCount)
    for (let i = 0; i < count; i += 1) {
      const ratio = (i + 1) / Math.max(1, count)
      const a = sphereRadius * (1.05 + ratio * 0.34)
      const b = sphereRadius * (0.82 + ratio * 0.26)
      const curve = new THREE.EllipseCurve(0, 0, a, b, 0, Math.PI * 2, false, 0)
      const base = curve.getPoints(96)
      const phase = hash01(`ring:${i}`) * Math.PI * 2
      const tiltX = (hash01(`ring-tilt-x:${i}`) - 0.5) * 1.1
      const tiltY = (hash01(`ring-tilt-y:${i}`) - 0.5) * 1.1
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, tiltY, phase * 0.2))
      defs.push({
        id: `ring:${i}`,
        phase,
        speed: 0.03 + ratio * 0.04,
        points: base.map(p => new THREE.Vector3(p.x, 0, p.y).applyQuaternion(rot)),
      })
    }
    return defs
  }, [orbitRingCount, sphereRadius])
  const latLinePositions = React.useMemo(() => {
    const out: Float32Array[] = []
    for (let i = 0; i < gridDensity; i += 1) {
      const lat = ((i + 1) / (gridDensity + 1) - 0.5) * Math.PI
      const r = Math.cos(lat) * sphereRadius
      const y = Math.sin(lat) * sphereRadius
      const ring = new THREE.EllipseCurve(0, 0, Math.abs(r), Math.abs(r), 0, Math.PI * 2, false, 0).getPoints(72)
      out.push(new Float32Array(ring.flatMap(p => [p.x, y, p.y])))
    }
    return out
  }, [gridDensity, sphereRadius])
  const lonLinePositions = React.useMemo(() => {
    const out: Float32Array[] = []
    for (let i = 0; i < gridDensity; i += 1) {
      const lon = (i / Math.max(1, gridDensity)) * Math.PI * 2
      const pts: number[] = []
      for (let s = 0; s <= 64; s += 1) {
        const lat = (s / 64 - 0.5) * Math.PI
        const x = Math.cos(lat) * Math.cos(lon) * sphereRadius
        const y = Math.sin(lat) * sphereRadius
        const z = Math.cos(lat) * Math.sin(lon) * sphereRadius
        pts.push(x, y, z)
      }
      out.push(new Float32Array(pts))
    }
    return out
  }, [gridDensity, sphereRadius])
  const orbitLinePositions = React.useMemo(
    () => orbitDefs.map(def => ({ id: def.id, positions: new Float32Array(def.points.flatMap(p => [p.x, p.y, p.z])) })),
    [orbitDefs],
  )
  const spokeLinePositions = React.useMemo(
    () => spokeSegments.map(seg => new Float32Array([seg[0][0], seg[0][1], seg[0][2], seg[1][0], seg[1][1], seg[1][2]])),
    [spokeSegments],
  )
  const flowArcLinePositions = React.useMemo(
    () => flowArcs.map(arc => ({ id: arc.id, positions: new Float32Array(arc.points.flatMap(p => [p.x, p.y, p.z])) })),
    [flowArcs],
  )
  const hubLinePositions = React.useMemo(
    () => hubPositions.map(p => new Float32Array([0, 0, 0, p[0], p[1], p[2]])),
    [hubPositions],
  )

  const toolNodeRefs = React.useRef<Array<THREE.Mesh | null>>([])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const refs = toolNodeRefs.current
    for (let i = 0; i < refs.length; i += 1) {
      const mesh = refs[i]
      if (!mesh) continue
      const orbit = orbitDefs[i % Math.max(1, orbitDefs.length)]
      const points = orbit.points
      const phase = hash01(`tool:${i}`) * Math.PI * 2 + orbit.phase
      const speed = orbit.speed * 0.7
      const progress = (phase + t * speed) % (Math.PI * 2)
      const idx = Math.floor((progress / (Math.PI * 2)) * (points.length - 1))
      const p = points[Math.max(0, Math.min(points.length - 1, idx))]
      mesh.position.copy(p)
    }
  })

  const travelerRefs = React.useRef<Array<THREE.Mesh | null>>([])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const refs = travelerRefs.current
    for (let i = 0; i < refs.length; i += 1) {
      const mesh = refs[i]
      if (!mesh || flowArcs.length === 0) continue
      const arc = flowArcs[i % flowArcs.length]
      const points = arc.points
      const speed = 0.22 + hash01(`traveler-speed:${i}`) * 0.45
      const phase = hash01(`traveler-phase:${i}`)
      const progress = (phase + t * speed) % 1
      const idx = Math.floor(progress * (points.length - 1))
      mesh.position.copy(points[Math.max(0, Math.min(points.length - 1, idx))])
    }
  })

  if (!enabled) return null
  return (
    <group renderOrder={THREE_RENDER_ORDER.groups - 1}>
      <points frustumCulled={false}>
        <primitive object={particleGeometry} attach="geometry" />
        <shaderMaterial
          ref={particleMaterialRef}
          transparent
          depthWrite={false}
          uniforms={{
            uTime: { value: 0 },
            uSize: { value: particleSize },
            uWaveSpeed: { value: particleWaveSpeed },
            uWaveAmp: { value: particleWaveAmplitude },
            uColor: { value: new THREE.Color(nodeAccentColor) },
          }}
          vertexShader="attribute float aSeed; uniform float uTime; uniform float uSize; uniform float uWaveSpeed; uniform float uWaveAmp; varying float vAlpha; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float wave = 0.5 + 0.5 * sin(uTime * uWaveSpeed + aSeed * 18.0 + position.y * 0.04); float pulse = mix(1.0 - 0.45 * uWaveAmp, 1.0 + 0.35 * uWaveAmp, wave); gl_PointSize = max(1.0, uSize * pulse); vAlpha = mix(0.25, 0.9, wave); gl_Position = projectionMatrix * mv; }"
          fragmentShader="uniform vec3 uColor; varying float vAlpha; void main(){ vec2 uv = gl_PointCoord * 2.0 - 1.0; float r2 = dot(uv, uv); if (r2 > 1.0) discard; float edge = smoothstep(1.0, 0.2, r2); gl_FragColor = vec4(uColor, edge * vAlpha); }"
        />
      </points>
      <mesh scale={[1.08, 1.08, 1.08]} frustumCulled={false}>
        <sphereGeometry args={[sphereRadius, 48, 48]} />
        <shaderMaterial
          ref={atmosphereMaterialRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          uniforms={{
            uTime: { value: 0 },
            uOpacity: { value: atmosphereOpacity },
            uColor: { value: new THREE.Color(edgeColor) },
          }}
          vertexShader="varying vec3 vNormalW; void main(){ vNormalW = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }"
          fragmentShader="uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying vec3 vNormalW; void main(){ float rim = pow(1.0 - max(0.0, vNormalW.z), 2.6); float pulse = 0.8 + 0.2 * sin(uTime * 0.8); gl_FragColor = vec4(uColor, rim * uOpacity * pulse); }"
        />
      </mesh>
      {latLinePositions.map((positionsArray, i) => (
        <line key={`lat:${i}`}>
          <lineBasicMaterial color={edgeColor} transparent opacity={0.38} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positionsArray, 3]} />
          </bufferGeometry>
        </line>
      ))}
      {lonLinePositions.map((positionsArray, i) => (
        <line key={`lon:${i}`}>
          <lineBasicMaterial color={edgeColor} transparent opacity={0.38} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positionsArray, 3]} />
          </bufferGeometry>
        </line>
      ))}
      {orbitLinePositions.map(def => (
        <line key={def.id}>
          <lineBasicMaterial color={edgeColor} transparent opacity={0.38} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[def.positions, 3]} />
          </bufferGeometry>
        </line>
      ))}
      {Array.from({ length: toolNodeCount }).map((_, i) => (
        <mesh key={`tool-node:${i}`} ref={el => { toolNodeRefs.current[i] = el }} renderOrder={THREE_RENDER_ORDER.nodes - 1}>
          <sphereGeometry args={[2.2, 12, 12]} />
          <meshLambertMaterial color={nodeAccentColor} transparent opacity={0.85} />
        </mesh>
      ))}
      {spokeLinePositions.map((positionsArray, i) => (
        <line key={`spoke:${i}`}>
          <lineBasicMaterial color={edgeColor} transparent opacity={0.38} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positionsArray, 3]} />
          </bufferGeometry>
        </line>
      ))}
      {flowArcLinePositions.map(arc => (
        <line key={`arc:${arc.id}`}>
          <lineBasicMaterial color={nodeAccentColor} transparent opacity={0.5} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[arc.positions, 3]} />
          </bufferGeometry>
        </line>
      ))}
      {Array.from({ length: flowArcs.length * arcTravelerCount }).map((_, i) => (
        <mesh key={`traveler:${i}`} ref={el => { travelerRefs.current[i] = el }}>
          <sphereGeometry args={[1.9, 10, 10]} />
          <meshLambertMaterial color={nodeAccentColor} transparent opacity={0.92} />
        </mesh>
      ))}
      <mesh renderOrder={THREE_RENDER_ORDER.nodes - 2}>
        <sphereGeometry args={[Math.max(3, sphereRadius * 0.06), 18, 18]} />
        <meshLambertMaterial color={nodeAccentColor} emissive={nodeAccentColor} emissiveIntensity={corePulseStrength} />
      </mesh>
      {Array.from({ length: 3 }).map((_, i) => {
        const r = sphereRadius * (0.18 + i * 0.1)
        return (
          <mesh key={`ripple:${i}`} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r, r + Math.max(1, sphereRadius * 0.006), 64]} />
            <meshBasicMaterial color={edgeColor} transparent opacity={clamp(rippleStrength - i * 0.08, 0.06, 0.4)} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
      {hubLinePositions.map((positionsArray, i) => (
        <line key={`hub-spoke:${i}`}>
          <lineBasicMaterial color={edgeColor} transparent opacity={0.38} />
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positionsArray, 3]} />
          </bufferGeometry>
        </line>
      ))}
    </group>
  )
}

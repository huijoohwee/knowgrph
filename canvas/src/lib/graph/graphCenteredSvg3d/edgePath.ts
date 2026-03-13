import { projectPerspective, rotateX, rotateY, type Vec3 } from './utils'

export const computeSvgQuadraticEdgePathD3d = (args: {
  sourceId: string
  targetId: string
  sourceScreen: { x: number; y: number }
  targetScreen: { x: number; y: number }
  posById: Map<string, Vec3>
  curvature: number
  curveRotation: number
  fmt: (n: number) => string
  amp: number
  cx: number
  cy: number
  cz: number
  yaw0: number
  tiltX: number
  cameraZ: number
}): string => {
  const ps = args.sourceScreen
  const pt = args.targetScreen
  if (!(args.curvature > 0.001)) return `M${args.fmt(ps.x)} ${args.fmt(ps.y)} L${args.fmt(pt.x)} ${args.fmt(pt.y)}`

  const pS = args.posById.get(args.sourceId)
  const pT = args.posById.get(args.targetId)
  if (!pS || !pT) return `M${args.fmt(ps.x)} ${args.fmt(ps.y)} L${args.fmt(pt.x)} ${args.fmt(pt.y)}`

  const wobSx = args.amp > 0 ? Math.sin(0 * 0.2 + args.sourceId.length) * args.amp : 0
  const wobSy = args.amp > 0 ? Math.cos(0 * 0.25 + args.sourceId.length) * args.amp : 0
  const wobTx = args.amp > 0 ? Math.sin(0 * 0.2 + args.targetId.length) * args.amp : 0
  const wobTy = args.amp > 0 ? Math.cos(0 * 0.25 + args.targetId.length) * args.amp : 0

  const s0: Vec3 = [pS[0] - args.cx + wobSx, pS[1] - args.cy + wobSy, pS[2] - args.cz]
  const t0: Vec3 = [pT[0] - args.cx + wobTx, pT[1] - args.cy + wobTy, pT[2] - args.cz]
  const sR = rotateX(rotateY(s0, args.yaw0), args.tiltX)
  const tR = rotateX(rotateY(t0, args.yaw0), args.tiltX)

  const dx = tR[0] - sR[0]
  const dy = tR[1] - sR[1]
  const dz = tR[2] - sR[2]
  const len = Math.max(1e-6, Math.hypot(dx, dy, dz))
  const ux = dx / len
  const uy = dy / len
  const uz = dz / len

  const up = Math.abs(uz) < 0.99 ? ([0, 0, 1] as Vec3) : ([0, 1, 0] as Vec3)
  const px = uy * up[2] - uz * up[1]
  const py = uz * up[0] - ux * up[2]
  const pz = ux * up[1] - uy * up[0]
  const plen = Math.max(1e-6, Math.hypot(px, py, pz))
  let vx = px / plen
  let vy = py / plen
  let vz = pz / plen

  const a = args.curveRotation || 0
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dot = vx * ux + vy * uy + vz * uz
  const rx = vx * c + (uy * vz - uz * vy) * s + ux * dot * (1 - c)
  const ry = vy * c + (uz * vx - ux * vz) * s + uy * dot * (1 - c)
  const rz = vz * c + (ux * vy - uy * vx) * s + uz * dot * (1 - c)
  vx = rx
  vy = ry
  vz = rz

  const offsetMag = Math.max(0, args.curvature) * (len * 0.5)
  const ctrl: Vec3 = [
    (sR[0] + tR[0]) * 0.5 + vx * offsetMag,
    (sR[1] + tR[1]) * 0.5 + vy * offsetMag,
    (sR[2] + tR[2]) * 0.5 + vz * offsetMag,
  ]
  const prC = projectPerspective(ctrl, args.cameraZ)
  return `M${args.fmt(ps.x)} ${args.fmt(ps.y)} Q${args.fmt(prC.x)} ${args.fmt(prC.y)} ${args.fmt(pt.x)} ${args.fmt(pt.y)}`
}


import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { GlbFit } from '@/lib/three/GlbAssetModel'
import {
  applyImageToGlbPreviewCameraPlacement,
  computeImageToGlbPreviewCamera,
} from './imageToGlbPreviewCamera'

export function ImageToGlbPreviewCameraControls(props: {
  fit: GlbFit | null
  interactive: boolean
}) {
  const { fit, interactive } = props
  const { camera, gl, size } = useThree()
  const controls = React.useMemo(() => {
    const next = new OrbitControls(camera, gl.domElement)
    next.enabled = interactive
    next.enableDamping = true
    next.dampingFactor = 0.06
    next.enablePan = true
    next.enableRotate = true
    next.enableZoom = true
    next.rotateSpeed = 0.68
    next.zoomSpeed = 0.82
    next.panSpeed = 0.74
    next.screenSpacePanning = true
    next.zoomToCursor = true
    next.minPolarAngle = 0.04
    next.maxPolarAngle = Math.PI - 0.04
    return next
  }, [camera, gl.domElement])

  React.useEffect(() => () => controls.dispose(), [controls])

  React.useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const placement = computeImageToGlbPreviewCamera(fit, size.width / Math.max(1, size.height))
    applyImageToGlbPreviewCameraPlacement({ camera, controls, placement })
  }, [camera, controls, fit, size.height, size.width])

  React.useEffect(() => {
    controls.enabled = interactive
  }, [controls, interactive])

  useFrame((_, delta) => {
    if (!controls.enabled) return
    controls.update(delta)
  })

  return null
}

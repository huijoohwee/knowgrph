export type ThreeOfflineModuleSources = {
  three: string
  orbitControls: string
  gltfLoader: string
  bufferGeometryUtils: string
}

export async function loadThreeOfflineModuleSources(): Promise<ThreeOfflineModuleSources> {
  const [{ default: three }, { default: orbitControls }, { default: gltfLoader }, { default: bufferGeometryUtils }] =
    await Promise.all([
      import('../../../node_modules/three/build/three.module.js?raw'),
      import('../../../node_modules/three/examples/jsm/controls/OrbitControls.js?raw'),
      import('../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js?raw'),
      import('../../../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js?raw'),
    ])
  return { three, orbitControls, gltfLoader, bufferGeometryUtils }
}

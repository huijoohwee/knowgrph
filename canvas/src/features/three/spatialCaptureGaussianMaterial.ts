import * as THREE from 'three'

export function buildGaussianSplatMaterial(args: {
  paused: boolean
  viewportHeight: number
  viewportWidth: number
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    toneMapped: false,
    uniforms: {
      opacityScale: { value: args.paused ? 0.42 : 1.0 },
      splatAlphaPower: { value: 1.08 },
      splatRadiusScale: { value: 2.8284271 },
      viewportSize: { value: new THREE.Vector2(Math.max(1, args.viewportWidth), Math.max(1, args.viewportHeight)) },
      editorVisualization: { value: 0 },
      editorOpacityFloor: { value: 0 },
      editorScaleCeiling: { value: 1e20 },
      editorCropMin: { value: new THREE.Vector3(-1e20, -1e20, -1e20) },
      editorCropMax: { value: new THREE.Vector3(1e20, 1e20, 1e20) },
      editorBrightness: { value: 1 },
      editorSaturation: { value: 1 },
    },
    vertexShader: `
      precision highp float;
      attribute vec3 splatCenter;
      attribute vec3 splatColor;
      attribute float splatOpacity;
      attribute vec3 splatScale;
      attribute vec4 splatRotation;
      attribute float splatEditorVisible;
      uniform float splatRadiusScale;
      uniform vec2 viewportSize;
      uniform float editorVisualization;
      uniform float editorOpacityFloor;
      uniform float editorScaleCeiling;
      uniform vec3 editorCropMin;
      uniform vec3 editorCropMax;
      varying vec3 vSplatColor;
      varying float vSplatAlpha;
      varying vec3 vSplatConic;
      varying vec2 vSplatPixel;
      varying vec2 vSplatCorner;
      varying float vSplatVisible;

      mat3 quatToMatrix(vec4 q) {
        vec4 n = normalize(q);
        float x = n.x;
        float y = n.y;
        float z = n.z;
        float w = n.w;
        float x2 = x + x;
        float y2 = y + y;
        float z2 = z + z;
        float xx = x * x2;
        float xy = x * y2;
        float xz = x * z2;
        float yy = y * y2;
        float yz = y * z2;
        float zz = z * z2;
        float wx = w * x2;
        float wy = w * y2;
        float wz = w * z2;
        return mat3(
          1.0 - (yy + zz), xy + wz, xz - wy,
          xy - wz, 1.0 - (xx + zz), yz + wx,
          xz + wy, yz - wx, 1.0 - (xx + yy)
        );
      }

      vec2 projectAxisPixels(vec3 centerView, vec2 centerNdc, vec3 axisView) {
        vec4 clip = projectionMatrix * vec4(centerView + axisView, 1.0);
        float w = abs(clip.w) > 0.000001 ? clip.w : 0.000001;
        return ((clip.xy / w) - centerNdc) * viewportSize * 0.5;
      }

      void main() {
        vSplatColor = splatColor;
        vSplatAlpha = clamp(splatOpacity, 0.0, 1.0);
        float largestScale = max(splatScale.x, max(splatScale.y, splatScale.z));
        bool insideCrop = all(greaterThanEqual(splatCenter, editorCropMin)) && all(lessThanEqual(splatCenter, editorCropMax));
        vSplatVisible = splatEditorVisible > 0.5 && vSplatAlpha >= editorOpacityFloor && largestScale <= editorScaleCeiling && insideCrop ? 1.0 : 0.0;
        vec4 mvPosition = modelViewMatrix * vec4(splatCenter, 1.0);
        vec4 centerClip = projectionMatrix * mvPosition;
        float centerW = abs(centerClip.w) > 0.000001 ? centerClip.w : 0.000001;
        vec2 centerNdc = centerClip.xy / centerW;
        mat3 rotation = quatToMatrix(splatRotation);
        mat3 viewRotation = mat3(modelViewMatrix) * rotation;
        vec3 safeScale = max(splatScale, vec3(0.0001));
        vec2 axis0 = projectAxisPixels(mvPosition.xyz, centerNdc, viewRotation[0] * safeScale.x);
        vec2 axis1 = projectAxisPixels(mvPosition.xyz, centerNdc, viewRotation[1] * safeScale.y);
        vec2 axis2 = projectAxisPixels(mvPosition.xyz, centerNdc, viewRotation[2] * safeScale.z);
        float covA = dot(vec3(axis0.x, axis1.x, axis2.x), vec3(axis0.x, axis1.x, axis2.x)) + 0.35;
        float covB = axis0.x * axis0.y + axis1.x * axis1.y + axis2.x * axis2.y;
        float covC = dot(vec3(axis0.y, axis1.y, axis2.y), vec3(axis0.y, axis1.y, axis2.y)) + 0.35;
        float det = max(0.0001, covA * covC - covB * covB);
        float trace = covA + covC;
        float lambda = max(0.35, 0.5 * (trace + sqrt(max(0.0, (covA - covC) * (covA - covC) + 4.0 * covB * covB))));
        vSplatConic = vec3(covC / det, -covB / det, covA / det);
        float splatExtent = clamp(sqrt(lambda) * splatRadiusScale, 0.5, 96.0);
        vec2 corner = position.xy;
        vSplatCorner = corner;
        if (editorVisualization > 0.5 && editorVisualization < 1.5) splatExtent = 3.0;
        vSplatPixel = corner * splatExtent;
        vec2 clipOffset = corner * splatExtent * 2.0 / viewportSize * centerW;
        gl_Position = centerClip + vec4(clipOffset, 0.0, 0.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float opacityScale;
      uniform float splatAlphaPower;
      uniform float editorVisualization;
      uniform float editorBrightness;
      uniform float editorSaturation;
      varying vec3 vSplatColor;
      varying float vSplatAlpha;
      varying vec3 vSplatConic;
      varying vec2 vSplatPixel;
      varying vec2 vSplatCorner;
      varying float vSplatVisible;
      const float EXP4 = exp(-4.0);
      const float INV_EXP4 = 1.0 / (1.0 - EXP4);
      void main() {
        if (vSplatVisible < 0.5) discard;
        float power = 0.5 * (vSplatConic.x * vSplatPixel.x * vSplatPixel.x + 2.0 * vSplatConic.y * vSplatPixel.x * vSplatPixel.y + vSplatConic.z * vSplatPixel.y * vSplatPixel.y);
        float radius = length(vSplatCorner);
        float norm;
        if (editorVisualization > 1.5) {
          if (radius < 0.72 || radius > 0.98) discard;
          norm = smoothstep(0.72, 0.8, radius) * (1.0 - smoothstep(0.9, 0.98, radius));
        } else if (editorVisualization > 0.5) {
          if (radius > 0.82) discard;
          norm = 1.0 - smoothstep(0.42, 0.82, radius);
        } else {
          if (power > 4.0) discard;
          norm = pow(max(0.0, (exp(-power) - EXP4) * INV_EXP4), splatAlphaPower);
        }
        float alpha = min(0.96, norm * vSplatAlpha * opacityScale);
        if (alpha < 0.003921569) discard;
        float luminance = dot(vSplatColor, vec3(0.2126, 0.7152, 0.0722));
        vec3 color = clamp(mix(vec3(luminance), vSplatColor, editorSaturation) * editorBrightness, 0.0, 1.0);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
  })
}

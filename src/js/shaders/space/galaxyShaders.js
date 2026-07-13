export const galaxyVertexShader = `
  attribute vec4 aGalaxyData;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vData;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    vData = aGalaxyData;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const galaxyFragmentShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vData;
  uniform float uVisibility;
  uniform float uExposure;

  float hash21(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 point = vUv - 0.5;
    float radius = length(point);
    float angle = atan(point.y, point.x);
    float ellipse = exp(-(point.x * point.x * 34.0 + point.y * point.y * 105.0));
    float roundGalaxy = exp(-radius * radius * 42.0);
    float spiral = roundGalaxy * (0.55 + 0.45 * sin(angle * 2.0 - radius * 33.0 + vData.z * 6.28));
    float edgeOn = ellipse * (0.72 + exp(-abs(point.y) * 90.0) * 0.36);
    float irregular = roundGalaxy * (0.58 + hash21(floor(point * 22.0 + vData.z * 17.0)) * 0.28);
    float typeA = 1.0 - step(0.5, vData.y);
    float typeB = step(0.5, vData.y) * (1.0 - step(1.5, vData.y));
    float typeC = step(1.5, vData.y);
    float shape = spiral * typeA + edgeOn * typeB + irregular * typeC;
    float alpha = shape * vData.x * uVisibility;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(vColor * uExposure * (0.72 + shape * 0.42), alpha);
  }
`;


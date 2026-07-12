/**
 * Central list of image assets used by the 3D materials.
 *
 * A texture is a 2D image wrapped around a 3D surface. Keeping URLs here means
 * rendering modules do not need to know where files are hosted. The object key
 * (for example `earth`) is the stable name used everywhere else in the app.
 */
const LOCAL_TEXTURE_ROOT = `${import.meta.env.BASE_URL}textures`;

export const TEXTURE_URLS = {
  sun: "https://threejs.org/examples/textures/lava/cloud.png",
  mercury: `${LOCAL_TEXTURE_ROOT}/mercury-2k.jpg`,
  venus: `${LOCAL_TEXTURE_ROOT}/venus-surface-2k.jpg`,
  venusAtmosphere: `${LOCAL_TEXTURE_ROOT}/venus-atmosphere-2k.jpg`,
  earth: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  earthNormal: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
  earthClouds: "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
  earthLights: "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
  moon: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
  mars: `${LOCAL_TEXTURE_ROOT}/mars-2k.jpg`,
  jupiter: "https://threejs.org/examples/textures/planets/jupiter2_1024.jpg",
  saturn: "https://threejs.org/examples/textures/planets/saturn.jpg",
  saturnRing: "https://threejs.org/examples/textures/planets/saturnringcolor.jpg",
  uranus: "https://threejs.org/examples/textures/planets/uranus.jpg",
  neptune: "https://threejs.org/examples/textures/planets/neptune.jpg",
};

/**
 * Some keys describe a layer rather than a planet. If loading fails, this map
 * tells the procedural generator which planet palette would be the closest match.
 */
export const TEXTURE_FALLBACKS = {
  venusAtmosphere: "venus",
  earthNormal: "earth",
  earthClouds: "earth",
  earthLights: "earth",
  saturnRing: "saturn",
};

// Optional maps improve detail but are not required to construct a visible planet.
// A Set is used because `.has(name)` is a clear and fast membership check.
export const OPTIONAL_TEXTURES = new Set([
  "earthLights",
  "earthClouds",
  "earthNormal",
  "saturnRing",
]);

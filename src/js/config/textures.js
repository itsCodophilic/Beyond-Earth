/**
 * Central list of image assets used by the 3D materials.
 *
 * A texture is a 2D image wrapped around a 3D surface. Keeping URLs here means
 * rendering modules do not need to know where files are hosted. The object key
 * (for example `earth`) is the stable name used everywhere else in the app.
 */
const LOCAL_TEXTURE_ROOT = `${import.meta.env.BASE_URL}textures`;
const DWARF_TEXTURE_ROOT = `${import.meta.env.BASE_URL}assets/textures/dwarf`;

export const TEXTURE_URLS = {
  sun: "https://threejs.org/examples/textures/lava/cloud.png",
  mercury: `${LOCAL_TEXTURE_ROOT}/mercury-2k.jpg`,
  venus: `${LOCAL_TEXTURE_ROOT}/venus-surface-2k.jpg`,
  venusAtmosphere: `${LOCAL_TEXTURE_ROOT}/venus-atmosphere-2k.jpg`,
  // NASA Blue Marble Next Generation surface with clouds removed.
  earth: `${LOCAL_TEXTURE_ROOT}/earth-no-clouds.jpg`,
  earthNormal: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
  // NASA GEOS-5 global cloud field on black. The custom Earth shader turns
  // brightness into soft transparency and prevents a grey veil over the globe.
  earthClouds: `${LOCAL_TEXTURE_ROOT}/earth-clouds.jpg`,
  earthLights: "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
  // NASA CGI Moon Kit: LROC visible-light colour and LOLA topography.
  moon: `${LOCAL_TEXTURE_ROOT}/moon-color-1k.jpg`,
  moonDisplacement: `${LOCAL_TEXTURE_ROOT}/moon-displacement-1k.jpg`,
  mars: `${LOCAL_TEXTURE_ROOT}/mars-2k.jpg`,
  jupiter: `${LOCAL_TEXTURE_ROOT}/jupiter-2k.jpg`,
  saturn: `${LOCAL_TEXTURE_ROOT}/saturn-2k.jpg`,
  saturnRing: `${LOCAL_TEXTURE_ROOT}/saturn-ring-2k.png`,
  uranus: `${LOCAL_TEXTURE_ROOT}/uranus-2k.jpg`,
  // Pluto uses a local New Horizons-inspired equirectangular wrap prepared from
  // the supplied real-image reference so the dwarf planet reads consistently
  // from every camera angle without relying on the procedural fallback.
  pluto: `${import.meta.env.BASE_URL}assets/textures/pluto/pluto-equirectangular.png`,

  /*
   * The seven worlds beyond Neptune.
   *
   * None of them has ever been resolved into more than a handful of pixels by
   * any telescope, so there is no survey map to download -- every image of them
   * in existence is one disc, lit from one side, seen from one angle. These
   * maps were built by unwrapping exactly that: the reference photograph is
   * projected back off the sphere it was taken of, the illumination baked into
   * it is divided out, and the half that was facing away is grown from the half
   * that was not. See tools/dwarf-textures/README.md for the method.
   */
  orcus: `${DWARF_TEXTURE_ROOT}/orcus-equirectangular.jpg`,
  haumea: `${DWARF_TEXTURE_ROOT}/haumea-equirectangular.jpg`,
  quaoar: `${DWARF_TEXTURE_ROOT}/quaoar-equirectangular.jpg`,
  makemake: `${DWARF_TEXTURE_ROOT}/makemake-equirectangular.jpg`,
  gonggong: `${DWARF_TEXTURE_ROOT}/gonggong-equirectangular.jpg`,
  eris: `${DWARF_TEXTURE_ROOT}/eris-equirectangular.jpg`,
  sedna: `${DWARF_TEXTURE_ROOT}/sedna-equirectangular.jpg`,
  // Neptune is drawn by a seamless 3D atmosphere shader in neptuneSurface.js.
  // Avoiding a flat image prevents polar pinching and longitude seams.
};

/**
 * Backup assets are retained only for the few textures that still come from
 * Three.js. Core Earth, Moon, Jupiter, Saturn and Uranus maps are bundled in
 * public/textures so localhost and GitHub Pages do not depend on CORS access.
 */
export const TEXTURE_BACKUP_URLS = {
  earth: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  earthClouds: "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
  moon: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
  moonDisplacement: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
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
  moonDisplacement: "moon",
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

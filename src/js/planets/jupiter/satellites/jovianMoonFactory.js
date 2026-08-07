import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PUBLIC_ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;

/**
 * Evidence-tiered 3D surfaces for Jupiter's complete 115-entry satellite
 * catalogue.
 *
 * Spacecraft-resolved moons receive geology-specific relief and materials.
 * Photometrically constrained outer moons receive family-appropriate colour,
 * albedo, shape and roughness. Unresolved objects receive deterministic,
 * individual asteroid-like shapes generated from their measured orbital family
 * and stable catalogue seed; their exact craters are intentionally not claimed
 * as real.
 */

export const JOVIAN_MOON_INSPECTION_LAYER = 6;

const SURFACE_PALETTES = Object.freeze({
  io: { base: 0xd8a82c, light: 0xffe8a2, dark: 0x3c251b, accent: 0xe85d18 },
  europa: { base: 0xb9ad98, light: 0xf2ead7, dark: 0x4e332e, accent: 0x9b553d },
  ganymede: { base: 0x66615b, light: 0xaaa493, dark: 0x292927, accent: 0x81776b },
  callisto: { base: 0x3b3834, light: 0x8c867c, dark: 0x151515, accent: 0xc0b59d },
  amalthea: { base: 0x774037, light: 0xad7b63, dark: 0x2c211f, accent: 0xd3b792 },
  thebe: { base: 0x5f3932, light: 0x8a6254, dark: 0x241d1c, accent: 0xa98770 },
  "inner-dark": { base: 0x47342f, light: 0x756057, dark: 0x1d1a19, accent: 0x9c7d6d },
  "c-type": { base: 0x5c5e5b, light: 0x858783, dark: 0x242525, accent: 0xa8a69e },
  "p-type": { base: 0x504843, light: 0x74675e, dark: 0x201e1d, accent: 0x8b796a },
  "d-type": { base: 0x664139, light: 0x8f5c4d, dark: 0x271d1a, accent: 0xac7962 },
  "mixed-dark": { base: 0x504a46, light: 0x766c65, dark: 0x201e1c, accent: 0x947665 },
});

/**
 * User-supplied visual references for this group deliberately show much
 * stronger marbling than the moons' unresolved photometry alone can reveal.
 * These palettes and blend strengths reproduce that reference art while the
 * catalogue continues to label the surfaces as reconstructions.
 *
 * The keys use JPL's catalogue spelling; "Magaclite" is displayed as
 * "Megaclite" everywhere in the interface.
 */
const REFERENCE_VISUAL_STYLES = Object.freeze({
  Lysithea: {
    palette: { base: 0x9b3d4c, light: 0xef9ea5, dark: 0x260e17, accent: 0xffc8bc },
    lightPatch: 0.43,
    accentPatch: 0.34,
    darkPatch: 0.58,
    fineSpeckle: 0.19,
  },
  Ananke: {
    palette: { base: 0xb88b80, light: 0xffe0d0, dark: 0x4b3535, accent: 0xfff0df },
    lightPatch: 0.56,
    accentPatch: 0.20,
    darkPatch: 0.27,
    fineSpeckle: 0.18,
  },
  Leda: {
    palette: { base: 0x9b6f40, light: 0xedbd78, dark: 0x302722, accent: 0xffe2a1 },
    lightPatch: 0.56,
    accentPatch: 0.28,
    darkPatch: 0.37,
    fineSpeckle: 0.10,
  },
  Chaldene: {
    palette: { base: 0x69645c, light: 0xa99d8a, dark: 0x24211f, accent: 0xc8b598 },
    lightPatch: 0.32,
    accentPatch: 0.14,
    darkPatch: 0.40,
    fineSpeckle: 0.09,
  },
  Harpalyke: {
    palette: { base: 0x898a86, light: 0xffffff, dark: 0x292832, accent: 0xd6d4c6 },
    lightPatch: 0.78,
    accentPatch: 0.39,
    darkPatch: 0.50,
    fineSpeckle: 0.16,
  },
  Kalyke: {
    palette: { base: 0xc0a099, light: 0xffe0cf, dark: 0x59484a, accent: 0xefd0c5 },
    lightPatch: 0.61,
    accentPatch: 0.24,
    darkPatch: 0.30,
    fineSpeckle: 0.12,
  },
  Iocaste: {
    palette: { base: 0x858078, light: 0xc2b7a5, dark: 0x303039, accent: 0xded0b7 },
    lightPatch: 0.37,
    accentPatch: 0.18,
    darkPatch: 0.57,
    fineSpeckle: 0.08,
  },
  Erinome: {
    palette: { base: 0xc0a09a, light: 0xffe0d2, dark: 0x625153, accent: 0xebc8c0 },
    lightPatch: 0.62,
    accentPatch: 0.28,
    darkPatch: 0.29,
    fineSpeckle: 0.11,
  },
  Isonoe: {
    palette: { base: 0x898a85, light: 0xffffff, dark: 0x302e39, accent: 0xd8d5c7 },
    lightPatch: 0.78,
    accentPatch: 0.38,
    darkPatch: 0.53,
    fineSpeckle: 0.16,
  },
  Praxidike: {
    palette: { base: 0xb38e65, light: 0xffe3a6, dark: 0x514035, accent: 0xfff1c8 },
    lightPatch: 0.68,
    accentPatch: 0.25,
    darkPatch: 0.30,
    fineSpeckle: 0.13,
    rift: 0x73382f,
    riftStrength: 0.72,
  },
  Themisto: {
    palette: { base: 0x38393c, light: 0x737477, dark: 0x111216, accent: 0x96979a },
    lightPatch: 0.29,
    accentPatch: 0.12,
    darkPatch: 0.48,
    fineSpeckle: 0.13,
  },
  Magaclite: {
    palette: { base: 0x85808d, light: 0xc9c3d0, dark: 0x302c39, accent: 0xd7d8c6 },
    lightPatch: 0.48,
    accentPatch: 0.25,
    darkPatch: 0.54,
    fineSpeckle: 0.13,
  },
  Callirrhoe: {
    palette: { base: 0x3d3932, light: 0x706b60, dark: 0x171714, accent: 0x8b806d },
    lightPatch: 0.24,
    accentPatch: 0.12,
    darkPatch: 0.48,
    fineSpeckle: 0.14,
  },
  Thyone: {
    palette: { base: 0xc9a99c, light: 0xffe6d5, dark: 0x76636a, accent: 0xf3c5a9 },
    lightPatch: 0.58,
    accentPatch: 0.26,
    darkPatch: 0.24,
    fineSpeckle: 0.12,
  },
  Pasithee: {
    palette: { base: 0x686763, light: 0xa7a59d, dark: 0x292a28, accent: 0xc0bcae },
    lightPatch: 0.30,
    accentPatch: 0.14,
    darkPatch: 0.46,
    fineSpeckle: 0.18,
  },
  Arche: {
    palette: { base: 0x87383f, light: 0xe56c5c, dark: 0x2c1118, accent: 0xfa7b58 },
    lightPatch: 0.48,
    accentPatch: 0.24,
    darkPatch: 0.52,
    fineSpeckle: 0.20,
  },
  Helike: {
    palette: { base: 0x806454, light: 0xc9a582, dark: 0x30251f, accent: 0xdfbd99 },
    lightPatch: 0.46,
    accentPatch: 0.21,
    darkPatch: 0.39,
    fineSpeckle: 0.13,
  },
  Kore: {
    palette: { base: 0x707781, light: 0xa5acb5, dark: 0x363b43, accent: 0xc0c5cb },
    lightPatch: 0.34,
    accentPatch: 0.18,
    darkPatch: 0.34,
    fineSpeckle: 0.10,
  },
  Herse: {
    palette: { base: 0x70443d, light: 0x995d52, dark: 0x2f201e, accent: 0x854d43 },
    lightPatch: 0.22,
    accentPatch: 0.10,
    darkPatch: 0.31,
    fineSpeckle: 0.12,
  },
  Eirene: {
    palette: { base: 0x673e37, light: 0x975b4c, dark: 0x271c1a, accent: 0x7f4b3e },
    lightPatch: 0.27,
    accentPatch: 0.12,
    darkPatch: 0.39,
    fineSpeckle: 0.18,
  },
  Philophrosyn: {
    palette: { base: 0x584b28, light: 0x9d8752, dark: 0x201c0f, accent: 0xc2a25d },
    lightPatch: 0.37,
    accentPatch: 0.18,
    darkPatch: 0.44,
    fineSpeckle: 0.16,
  },
  Eupheme: {
    palette: { base: 0xb8a47c, light: 0xebdeb1, dark: 0x4b3d2d, accent: 0xd1be8f },
    lightPatch: 0.48,
    accentPatch: 0.22,
    darkPatch: 0.34,
    fineSpeckle: 0.13,
  },
  Pandia: {
    palette: { base: 0xb8b6b0, light: 0xf2f0e7, dark: 0x464442, accent: 0xdad9d3 },
    lightPatch: 0.58,
    accentPatch: 0.27,
    darkPatch: 0.31,
    fineSpeckle: 0.11,
  },
  Ersa: {
    palette: { base: 0x9799a9, light: 0xcfd2de, dark: 0x585a6a, accent: 0xb4b8c9 },
    lightPatch: 0.42,
    accentPatch: 0.18,
    darkPatch: 0.24,
    fineSpeckle: 0.07,
  },
});

const THEMISTO_CHIPPED_AXIS = new THREE.Vector3(-0.84, 0.41, 0.35).normalize();
const THELXINOE_CAVITY_AXIS = new THREE.Vector3(0.86, -0.08, 0.50).normalize();
const HEGEMONE_CHIPPED_AXIS = new THREE.Vector3(-0.78, 0.24, 0.58).normalize();
const AITNE_UPPER_LOBE_AXIS = new THREE.Vector3(0.46, 0.88, 0.10).normalize();
const AITNE_LOWER_LOBE_AXIS = new THREE.Vector3(-0.50, -0.86, 0.12).normalize();
const AITNE_INNER_NOTCH_AXIS = new THREE.Vector3(-0.94, 0.32, 0.10).normalize();
const DIA_BULGE_AXIS = new THREE.Vector3(0.96, -0.23, 0.12).normalize();
const DIA_MAIN_MASS_AXIS = new THREE.Vector3(-0.82, 0.06, 0.56).normalize();
const DIA_SHOULDER_NOTCH_AXIS = new THREE.Vector3(0.36, 0.92, 0.14).normalize();
const CALLIRRHOE_FULL_SHOULDER_AXIS = new THREE.Vector3(0.72, 0.43, 0.54).normalize();
const CALLIRRHOE_CLIPPED_END_AXIS = new THREE.Vector3(-0.92, -0.16, 0.36).normalize();
const THYONE_FLAT_FACE_AXIS = new THREE.Vector3(-0.50, 0.56, 0.66).normalize();
const THYONE_SOFT_BULGE_AXIS = new THREE.Vector3(0.74, -0.28, 0.61).normalize();
const PASITHEE_UPPER_CAP_AXIS = new THREE.Vector3(-0.30, 0.91, 0.29).normalize();
const PASITHEE_REAR_SHOULDER_AXIS = new THREE.Vector3(0.34, 0.44, -0.83).normalize();
const ARCHE_CROWN_AXIS = new THREE.Vector3(0.34, 0.74, 0.58).normalize();
const ARCHE_CLIPPED_FACE_AXIS = new THREE.Vector3(-0.86, -0.12, 0.49).normalize();
const HERSE_FULL_END_AXIS = new THREE.Vector3(0.72, 0.30, 0.62).normalize();
const HERSE_FLAT_END_AXIS = new THREE.Vector3(-0.82, -0.12, 0.56).normalize();
const EIRENE_MAIN_LOBE_AXIS = new THREE.Vector3(-0.62, 0.18, 0.76).normalize();
const EIRENE_SHARD_AXIS = new THREE.Vector3(0.78, 0.48, 0.40).normalize();
const EIRENE_NOTCH_AXIS = new THREE.Vector3(0.28, -0.88, 0.38).normalize();
const EUPHEME_HERO_BASIN_AXIS = new THREE.Vector3(0.832, 0.444, 0.332).normalize();
const PANDIA_FRACTURE_AXIS = new THREE.Vector3(0.489, 0.030, -0.872).normalize();
const PANDIA_CROWN_AXIS = new THREE.Vector3(-0.32, 0.82, -0.47).normalize();
const ERSA_SOFT_BULGE_AXIS = new THREE.Vector3(0.64, 0.18, 0.75).normalize();

/**
 * Converts measured broadband colour indices into a compact material palette.
 *
 * B−V and V−R describe how the body's reflected light slopes away from the
 * colour of the Sun. Comparing the moon with solar indices produces relative
 * blue, green and red reflectance. The final intensity is deliberately lifted
 * above the literal ~4% albedo so these kilometre-scale moons remain readable
 * on a monitor; their hue relationships still come from the observations.
 */
function createMeasuredOpticalPalette(profile) {
  const referenceStyle = REFERENCE_VISUAL_STYLES[profile.catalogueName];
  if (referenceStyle) return referenceStyle.palette;

  const photometry = profile.opticalPhotometry;
  if (!photometry) {
    return SURFACE_PALETTES[profile.appearance] ?? SURFACE_PALETTES["mixed-dark"];
  }

  const solarBV = 0.65;
  const solarVR = 0.36;
  const blueReflectance = Math.pow(10, -0.4 * (photometry.bV - solarBV));
  const greenReflectance = 1;
  const redReflectance = Math.pow(10, 0.4 * (photometry.vR - solarVR));
  const maximumReflectance = Math.max(
    redReflectance,
    greenReflectance,
    blueReflectance,
  );
  const rawMeasured = [
    redReflectance / maximumReflectance,
    greenReflectance / maximumReflectance,
    blueReflectance / maximumReflectance,
  ];
  // Low-albedo rendering and filmic tone mapping visually compress small
  // colour differences. A restrained exponent restores the measured ordering
  // on screen without turning these red-grey bodies into saturated red rocks.
  const measured = rawMeasured.map((channel) => Math.pow(channel, 1.45));

  const packTone = (peak, neutralMix = 0) => {
    const average = (measured[0] + measured[1] + measured[2]) / 3;
    const channels = measured.map((channel) => THREE.MathUtils.lerp(
      channel,
      average,
      neutralMix,
    ));
    const red = Math.round(THREE.MathUtils.clamp(channels[0] * peak, 0, 255));
    const green = Math.round(THREE.MathUtils.clamp(channels[1] * peak, 0, 255));
    const blue = Math.round(THREE.MathUtils.clamp(channels[2] * peak, 0, 255));
    return (red << 16) | (green << 8) | blue;
  };

  return {
    base: packTone(104, 0.08),
    light: packTone(150, 0.20),
    dark: packTone(39, 0.06),
    accent: packTone(176, 0.02),
  };
}

const BASE_SURFACE = Object.freeze({
  broadRelief: 0.06,
  rockRelief: 0.028,
  fineRelief: 0.010,
  craterCount: 8,
  craterDepth: 0.065,
  craterRadiusMin: 0.075,
  craterRadiusMax: 0.21,
  ridgeCount: 0,
  ridgeWidthMin: 0.012,
  ridgeWidthMax: 0.028,
  ridgeRelief: 0,
  mountainCount: 0,
  mountainHeight: 0,
  mountainRadiusMin: 0.05,
  mountainRadiusMax: 0.14,
  chaosCount: 0,
  chaosRelief: 0,
  silhouetteWarp: 0.05,
  asymmetry: 0.035,
  bilobeStrength: 0.0,
  shardStrength: 0.035,
  colourContrast: 0.48,
  craterFloorDarkening: 0.54,
  craterRimBrightening: 0.30,
  flatShading: true,
  roughness: 1.0,
  clearcoat: 0,
  clearcoatRoughness: 1,
  emissiveIntensity: 0.012,
  envMapIntensity: 0.008,
});

const FAMILY_SURFACES = Object.freeze({
  "Galilean moon": {
    broadRelief: 0.005,
    rockRelief: 0.004,
    fineRelief: 0.002,
    craterCount: 10,
    craterDepth: 0.018,
    silhouetteWarp: 0.001,
    asymmetry: 0.0008,
    shardStrength: 0,
    flatShading: false,
    roughness: 0.90,
    emissiveIntensity: 0.010,
    envMapIntensity: 0.025,
  },
  "Inner regular moon": {
    broadRelief: 0.085,
    rockRelief: 0.036,
    fineRelief: 0.014,
    craterCount: 14,
    craterDepth: 0.095,
    craterRadiusMin: 0.08,
    craterRadiusMax: 0.25,
    silhouetteWarp: 0.075,
    asymmetry: 0.055,
    bilobeStrength: 0.015,
    shardStrength: 0.055,
    flatShading: true,
    roughness: 1,
  },
  "Himalia family": {
    broadRelief: 0.075,
    rockRelief: 0.033,
    fineRelief: 0.013,
    craterCount: 12,
    craterDepth: 0.082,
    silhouetteWarp: 0.065,
    asymmetry: 0.050,
    bilobeStrength: 0.018,
    shardStrength: 0.050,
  },
  "Ananke family": {
    broadRelief: 0.092,
    rockRelief: 0.038,
    fineRelief: 0.015,
    craterCount: 9,
    craterDepth: 0.080,
    silhouetteWarp: 0.085,
    asymmetry: 0.060,
    bilobeStrength: 0.030,
    shardStrength: 0.065,
  },
  "Carme family": {
    broadRelief: 0.088,
    rockRelief: 0.037,
    fineRelief: 0.015,
    craterCount: 10,
    craterDepth: 0.078,
    silhouetteWarp: 0.080,
    asymmetry: 0.058,
    bilobeStrength: 0.024,
    shardStrength: 0.060,
  },
  "Pasiphae family": {
    broadRelief: 0.100,
    rockRelief: 0.042,
    fineRelief: 0.016,
    craterCount: 8,
    craterDepth: 0.084,
    silhouetteWarp: 0.092,
    asymmetry: 0.065,
    bilobeStrength: 0.038,
    shardStrength: 0.072,
  },
  "Themisto group": {
    broadRelief: 0.094,
    rockRelief: 0.039,
    fineRelief: 0.015,
    craterCount: 8,
    craterDepth: 0.080,
    silhouetteWarp: 0.082,
    asymmetry: 0.060,
    bilobeStrength: 0.028,
    shardStrength: 0.064,
  },
  "Carpo group": {
    broadRelief: 0.106,
    rockRelief: 0.044,
    fineRelief: 0.017,
    craterCount: 7,
    craterDepth: 0.086,
    silhouetteWarp: 0.100,
    asymmetry: 0.075,
    bilobeStrength: 0.050,
    shardStrength: 0.082,
  },
  "Valetudo group": {
    broadRelief: 0.112,
    rockRelief: 0.046,
    fineRelief: 0.018,
    craterCount: 6,
    craterDepth: 0.088,
    silhouetteWarp: 0.110,
    asymmetry: 0.082,
    bilobeStrength: 0.058,
    shardStrength: 0.092,
  },
});

const NAMED_SURFACES = Object.freeze({
  Io: {
    broadRelief: 0.0032,
    rockRelief: 0.0026,
    fineRelief: 0.0014,
    // Io's continually renewed lava plains erase ordinary impact craters.
    // Its depressions are rendered separately as volcanic calderas/paterae.
    craterCount: 0,
    craterDepth: 0,
    mountainCount: 28,
    mountainHeight: 0.0125,
    mountainRadiusMin: 0.035,
    mountainRadiusMax: 0.105,
    colourContrast: 0.60,
    roughness: 0.83,
    emissiveIntensity: 0.020,
  },
  Europa: {
    broadRelief: 0.0010,
    rockRelief: 0.00085,
    fineRelief: 0.00055,
    craterCount: 3,
    craterDepth: 0.0020,
    craterRadiusMin: 0.035,
    craterRadiusMax: 0.10,
    ridgeCount: 56,
    ridgeWidthMin: 0.005,
    ridgeWidthMax: 0.018,
    ridgeRelief: -0.0025,
    chaosCount: 24,
    chaosRelief: 0.0021,
    colourContrast: 0.36,
    roughness: 0.70,
    clearcoat: 0.20,
    clearcoatRoughness: 0.54,
    envMapIntensity: 0.055,
  },
  Ganymede: {
    broadRelief: 0.0035,
    rockRelief: 0.0031,
    fineRelief: 0.0016,
    craterCount: 24,
    craterDepth: 0.0070,
    craterRadiusMin: 0.035,
    craterRadiusMax: 0.15,
    ridgeCount: 44,
    ridgeWidthMin: 0.008,
    ridgeWidthMax: 0.026,
    ridgeRelief: 0.0038,
    chaosCount: 7,
    chaosRelief: 0.0028,
    colourContrast: 0.50,
    roughness: 0.88,
    clearcoat: 0.045,
    clearcoatRoughness: 0.80,
  },
  Callisto: {
    broadRelief: 0.0040,
    rockRelief: 0.0031,
    fineRelief: 0.0017,
    craterCount: 58,
    craterDepth: 0.0105,
    craterRadiusMin: 0.026,
    craterRadiusMax: 0.14,
    colourContrast: 0.56,
    craterFloorDarkening: 0.62,
    craterRimBrightening: 0.58,
    roughness: 0.96,
  },
  Amalthea: {
    broadRelief: 0.095,
    rockRelief: 0.040,
    fineRelief: 0.016,
    craterCount: 16,
    craterDepth: 0.115,
    mountainCount: 5,
    mountainHeight: 0.040,
    silhouetteWarp: 0.095,
    asymmetry: 0.070,
    shardStrength: 0.065,
    colourContrast: 0.62,
  },
  Thebe: {
    broadRelief: 0.090,
    rockRelief: 0.038,
    fineRelief: 0.015,
    craterCount: 14,
    craterDepth: 0.108,
    silhouetteWarp: 0.090,
    asymmetry: 0.066,
    shardStrength: 0.062,
  },
  Metis: {
    // Galileo resolved the overall collision-shaped body, but not individual
    // craters. Do not invent prominent mapped bowls that the imagery cannot
    // support; its impact history is expressed through its silhouette instead.
    craterCount: 0,
    craterDepth: 0,
    silhouetteWarp: 0.088,
    asymmetry: 0.070,
    bilobeStrength: 0.035,
    shardStrength: 0.072,
  },
  Adrastea: {
    craterCount: 0,
    craterDepth: 0,
    silhouetteWarp: 0.100,
    asymmetry: 0.078,
    bilobeStrength: 0.045,
    shardStrength: 0.082,
  },
  Himalia: {
    craterCount: 18,
    craterDepth: 0.090,
    silhouetteWarp: 0.075,
    asymmetry: 0.055,
    bilobeStrength: 0.015,
    shardStrength: 0.050,
  },
  Elara: { craterCount: 13, craterDepth: 0.086, silhouetteWarp: 0.072 },
  Pasiphae: { craterCount: 13, craterDepth: 0.090, bilobeStrength: 0.040 },
  Sinope: { craterCount: 11, craterDepth: 0.086, colourContrast: 0.58 },
  Carme: { craterCount: 12, craterDepth: 0.086, colourContrast: 0.62 },
  Ananke: { craterCount: 11, craterDepth: 0.088, bilobeStrength: 0.032 },
  Callirrhoe: {
    broadRelief: 0.044,
    rockRelief: 0.028,
    fineRelief: 0.012,
    craterCount: 12,
    inspectionCraterCount: 18,
    craterDepth: 0.058,
    craterRadiusMin: 0.030,
    craterRadiusMax: 0.125,
    silhouetteWarp: 0.030,
    asymmetry: 0.024,
    bilobeStrength: 0,
    shardStrength: 0.018,
    colourContrast: 0.50,
  },
  Thyone: {
    broadRelief: 0.027,
    rockRelief: 0.018,
    fineRelief: 0.008,
    craterCount: 8,
    inspectionCraterCount: 12,
    craterDepth: 0.040,
    craterRadiusMin: 0.030,
    craterRadiusMax: 0.105,
    silhouetteWarp: 0.018,
    asymmetry: 0.014,
    bilobeStrength: 0,
    shardStrength: 0.008,
    colourContrast: 0.44,
    roughness: 0.93,
  },
  Pasithee: {
    broadRelief: 0.058,
    rockRelief: 0.038,
    fineRelief: 0.018,
    craterCount: 16,
    inspectionCraterCount: 25,
    craterDepth: 0.062,
    craterRadiusMin: 0.024,
    craterRadiusMax: 0.115,
    silhouetteWarp: 0.022,
    asymmetry: 0.020,
    bilobeStrength: 0,
    shardStrength: 0.012,
    colourContrast: 0.56,
  },
  Arche: {
    broadRelief: 0.060,
    rockRelief: 0.042,
    fineRelief: 0.020,
    craterCount: 22,
    inspectionCraterCount: 34,
    craterDepth: 0.070,
    craterRadiusMin: 0.024,
    craterRadiusMax: 0.120,
    silhouetteWarp: 0.040,
    asymmetry: 0.032,
    bilobeStrength: 0,
    shardStrength: 0.038,
    colourContrast: 0.62,
    roughness: 0.98,
  },
  Helike: {
    broadRelief: 0.032,
    rockRelief: 0.021,
    fineRelief: 0.010,
    craterCount: 8,
    inspectionCraterCount: 14,
    craterDepth: 0.044,
    craterRadiusMin: 0.028,
    craterRadiusMax: 0.105,
    silhouetteWarp: 0.012,
    asymmetry: 0.010,
    bilobeStrength: 0,
    shardStrength: 0,
    colourContrast: 0.46,
    roughness: 0.93,
    flatShading: false,
  },
  Kore: {
    broadRelief: 0.010,
    rockRelief: 0.006,
    fineRelief: 0.003,
    craterCount: 32,
    inspectionCraterCount: 46,
    craterDepth: 0.043,
    craterRadiusMin: 0.020,
    craterRadiusMax: 0.110,
    silhouetteWarp: 0,
    asymmetry: 0,
    bilobeStrength: 0,
    shardStrength: 0,
    colourContrast: 0.34,
    roughness: 0.91,
    flatShading: false,
  },
  Philophrosyn: {
    broadRelief: 0.019,
    rockRelief: 0.011,
    fineRelief: 0.005,
    craterCount: 24,
    inspectionCraterCount: 34,
    craterDepth: 0.052,
    craterRadiusMin: 0.022,
    craterRadiusMax: 0.128,
    silhouetteWarp: 0.004,
    asymmetry: 0.003,
    bilobeStrength: 0,
    shardStrength: 0,
    colourContrast: 0.44,
    roughness: 0.97,
    flatShading: false,
  },
  Herse: {
    broadRelief: 0.052,
    rockRelief: 0.036,
    fineRelief: 0.017,
    craterCount: 15,
    inspectionCraterCount: 22,
    craterDepth: 0.067,
    craterRadiusMin: 0.025,
    craterRadiusMax: 0.120,
    silhouetteWarp: 0.038,
    asymmetry: 0.030,
    bilobeStrength: 0,
    shardStrength: 0.030,
    colourContrast: 0.30,
    roughness: 0.99,
  },
  Eirene: {
    broadRelief: 0.076,
    rockRelief: 0.052,
    fineRelief: 0.024,
    craterCount: 25,
    inspectionCraterCount: 38,
    craterDepth: 0.082,
    craterRadiusMin: 0.020,
    craterRadiusMax: 0.135,
    silhouetteWarp: 0.090,
    asymmetry: 0.065,
    bilobeStrength: 0.018,
    shardStrength: 0.075,
    colourContrast: 0.38,
    roughness: 1.0,
  },
  Eupheme: {
    broadRelief: 0.016,
    rockRelief: 0.011,
    fineRelief: 0.005,
    craterCount: 54,
    inspectionCraterCount: 78,
    craterDepth: 0.050,
    craterRadiusMin: 0.014,
    craterRadiusMax: 0.095,
    silhouetteWarp: 0.003,
    asymmetry: 0.002,
    bilobeStrength: 0,
    shardStrength: 0,
    colourContrast: 0.40,
    roughness: 0.96,
    flatShading: false,
  },
  Pandia: {
    broadRelief: 0.038,
    rockRelief: 0.027,
    fineRelief: 0.012,
    craterCount: 30,
    inspectionCraterCount: 44,
    craterDepth: 0.055,
    craterRadiusMin: 0.017,
    craterRadiusMax: 0.108,
    silhouetteWarp: 0.025,
    asymmetry: 0.018,
    bilobeStrength: 0,
    shardStrength: 0.032,
    colourContrast: 0.48,
    roughness: 0.93,
    flatShading: false,
  },
  Ersa: {
    broadRelief: 0.010,
    rockRelief: 0.006,
    fineRelief: 0.0025,
    craterCount: 18,
    inspectionCraterCount: 28,
    craterDepth: 0.028,
    craterRadiusMin: 0.016,
    craterRadiusMax: 0.082,
    silhouetteWarp: 0.002,
    asymmetry: 0.001,
    bilobeStrength: 0,
    shardStrength: 0,
    colourContrast: 0.28,
    roughness: 0.87,
    flatShading: false,
  },
  Themisto: {
    broadRelief: 0.064,
    rockRelief: 0.043,
    fineRelief: 0.024,
    craterCount: 22,
    craterDepth: 0.068,
    craterRadiusMin: 0.028,
    craterRadiusMax: 0.115,
    silhouetteWarp: 0.145,
    asymmetry: 0.060,
    bilobeStrength: 0.205,
    shardStrength: 0.055,
    colourContrast: 0.58,
  },
  Magaclite: {
    broadRelief: 0.082,
    rockRelief: 0.049,
    fineRelief: 0.023,
    craterCount: 10,
    craterDepth: 0.078,
    craterRadiusMin: 0.038,
    craterRadiusMax: 0.145,
    silhouetteWarp: 0.096,
    asymmetry: 0.065,
    bilobeStrength: 0.010,
    shardStrength: 0.085,
    colourContrast: 0.64,
  },
  Aitne: {
    broadRelief: 0.030,
    rockRelief: 0.022,
    fineRelief: 0.010,
    craterCount: 7,
    inspectionCraterCount: 11,
    craterDepth: 0.050,
    craterRadiusMin: 0.035,
    craterRadiusMax: 0.13,
    silhouetteWarp: 0.018,
    asymmetry: 0.010,
    bilobeStrength: 0,
    shardStrength: 0,
  },
  Hegemone: {
    broadRelief: 0.052,
    rockRelief: 0.030,
    fineRelief: 0.013,
    craterCount: 10,
    inspectionCraterCount: 14,
    craterDepth: 0.064,
    silhouetteWarp: 0.065,
    asymmetry: 0.050,
    bilobeStrength: 0.012,
    shardStrength: 0.078,
  },
  Thelxinoe: {
    broadRelief: 0.024,
    rockRelief: 0.015,
    fineRelief: 0.007,
    craterCount: 4,
    inspectionCraterCount: 6,
    craterDepth: 0.032,
    craterRadiusMin: 0.036,
    craterRadiusMax: 0.105,
    silhouetteWarp: 0.018,
    asymmetry: 0.014,
    bilobeStrength: 0,
    shardStrength: 0,
  },
  Kallichore: {
    broadRelief: 0.043,
    rockRelief: 0.027,
    fineRelief: 0.012,
    craterCount: 13,
    inspectionCraterCount: 18,
    craterDepth: 0.058,
    craterRadiusMin: 0.032,
    craterRadiusMax: 0.14,
    silhouetteWarp: 0.032,
    asymmetry: 0.024,
    bilobeStrength: 0,
    shardStrength: 0.018,
  },
  Eukelade: {
    broadRelief: 0.040,
    rockRelief: 0.024,
    fineRelief: 0.011,
    craterCount: 9,
    inspectionCraterCount: 13,
    craterDepth: 0.052,
    silhouetteWarp: 0.030,
    asymmetry: 0.022,
    bilobeStrength: 0,
    shardStrength: 0.018,
  },
  Cyllene: {
    broadRelief: 0.010,
    rockRelief: 0.007,
    fineRelief: 0.004,
    craterCount: 5,
    inspectionCraterCount: 8,
    craterDepth: 0.022,
    craterRadiusMin: 0.028,
    craterRadiusMax: 0.085,
    silhouetteWarp: 0.003,
    asymmetry: 0.002,
    bilobeStrength: 0,
    shardStrength: 0,
    flatShading: false,
    roughness: 0.96,
  },
  Dia: {
    broadRelief: 0.032,
    rockRelief: 0.023,
    fineRelief: 0.010,
    craterCount: 8,
    inspectionCraterCount: 12,
    craterDepth: 0.050,
    silhouetteWarp: 0.016,
    asymmetry: 0.010,
    bilobeStrength: 0,
    shardStrength: 0,
  },
  Carpo: { craterCount: 7, craterDepth: 0.090, shardStrength: 0.088 },
  Valetudo: { craterCount: 24, craterDepth: 0.034, craterRadiusMin: 0.025, craterRadiusMax: 0.18, shardStrength: 0, silhouetteWarp: 0, asymmetry: 0, bilobeStrength: 0 },
});

const NAMED_CRATERS = Object.freeze({
  Amalthea: [
    { center: [0.90, 0.18, 0.40], radius: 0.34, depth: 1.30, rim: 1.15 },
    { center: [-0.56, -0.18, 0.81], radius: 0.27, depth: 1.10, rim: 1.00 },
  ],
  Thebe: [
    { center: [0.76, 0.30, -0.57], radius: 0.31, depth: 1.28, rim: 1.12 },
  ],
  Callisto: [
    { center: [-0.42, 0.58, 0.70], radius: 0.24, depth: 0.78, rim: 1.25 },
  ],
});

const CALLOUT_DIRECTIONS = Object.freeze({
  callistoBasin: new THREE.Vector3(0.36, 0.62, -0.70).normalize(),
  amaltheaPatchA: new THREE.Vector3(0.76, 0.36, 0.54).normalize(),
  amaltheaPatchB: new THREE.Vector3(-0.58, -0.20, 0.79).normalize(),
});

function hash3(x, y, z, seed) {
  const value = Math.sin(
    x * 127.1
    + y * 311.7
    + z * 74.7
    + seed * 97.13,
  ) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function smoothNoise3(x, y, z, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const sample = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, seed);
  const x00 = THREE.MathUtils.lerp(sample(0, 0, 0), sample(1, 0, 0), ux);
  const x10 = THREE.MathUtils.lerp(sample(0, 1, 0), sample(1, 1, 0), ux);
  const x01 = THREE.MathUtils.lerp(sample(0, 0, 1), sample(1, 0, 1), ux);
  const x11 = THREE.MathUtils.lerp(sample(0, 1, 1), sample(1, 1, 1), ux);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(x00, x10, uy),
    THREE.MathUtils.lerp(x01, x11, uy),
    uz,
  );
}

function fbm3(direction, frequency, octaves, seed) {
  let value = 0;
  let amplitude = 0.5;
  let normalization = 0;
  let scale = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += smoothNoise3(
      direction.x * scale,
      direction.y * scale,
      direction.z * scale,
      seed + octave * 19.71,
    ) * amplitude;
    normalization += amplitude;
    amplitude *= 0.51;
    scale *= 2.04;
  }
  return value / Math.max(0.0001, normalization);
}

function smoothstep(edge0, edge1, value) {
  if (Math.abs(edge1 - edge0) < 1e-8) return value >= edge1 ? 1 : 0;
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function random01(seed, index, channel = 0) {
  const value = Math.sin(seed * 893.17 + index * 127.63 + channel * 311.91) * 43758.5453;
  return value - Math.floor(value);
}

function randomDirection(seed, index) {
  const z = random01(seed, index, 0) * 2 - 1;
  const angle = random01(seed, index, 1) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

function resolveSurfaceSettings(profile) {
  return {
    ...BASE_SURFACE,
    ...(FAMILY_SURFACES[profile.family] ?? {}),
    ...(NAMED_SURFACES[profile.catalogueName] ?? {}),
    roughness: NAMED_SURFACES[profile.catalogueName]?.roughness
      ?? profile.surfaceRoughness
      ?? FAMILY_SURFACES[profile.family]?.roughness
      ?? BASE_SURFACE.roughness,
  };
}

function detailFor(profile, quality, mode = "preview") {
  const isHero = profile.family === "Galilean moon";
  const isInner = profile.family === "Inner regular moon";
  const inspection = mode === "inspection";

  // Three.js's IcosahedronGeometry `detail` value is a linear subdivision count,
  // not an exponential level: detail 5 is only about 720 triangles. The former
  // values therefore exposed large polygon patches in close-up. These values
  // produce roughly 22k triangles for a high-quality Galilean inspection while
  // keeping all non-selected moons in a much smaller preview budget.
  if (inspection) {
    if (isHero) return quality === "low" ? 18 : quality === "medium" ? 26 : 32;
    if (isInner) return quality === "low" ? 12 : quality === "medium" ? 16 : 22;
    // Irregular moons must retain their battered silhouette in close-up
    // without exposing the triangles of the underlying icosahedron.
    return quality === "low" ? 10 : quality === "medium" ? 14 : 18;
  }

  if (isHero) return quality === "low" ? 4 : quality === "medium" ? 6 : 8;
  if (isInner) return quality === "low" ? 2 : quality === "medium" ? 3 : 4;
  return quality === "low" ? 1 : 2;
}

function resolveModeSettings(profile, mode = "preview") {
  const settings = resolveSurfaceSettings(profile);
  const inspection = mode === "inspection";
  const isHero = profile.family === "Galilean moon";
  const isInner = profile.family === "Inner regular moon";

  // Relief that is physically subtle becomes visually flat at cinematic scale.
  // Close inspection therefore uses the same restrained exaggeration principle
  // as Earth's Moon displacement mesh: enough true geometry to catch light,
  // while retaining each body's characteristic terrain and silhouette.
  const reliefBoost = inspection
    ? (isHero ? 1.52 : isInner ? 1.50 : 1.34)
    : (isHero ? 1.12 : 1.06);

  settings.broadRelief *= reliefBoost;
  settings.rockRelief *= reliefBoost;
  settings.fineRelief *= inspection ? reliefBoost * 1.12 : reliefBoost;
  settings.craterDepth *= inspection ? (isHero ? 1.28 : 1.30) : 1.02;
  settings.ridgeRelief *= inspection ? 1.85 : 1.08;
  settings.mountainHeight *= inspection ? 1.70 : 1.05;
  settings.chaosRelief *= inspection ? 1.85 : 1.05;
  settings.silhouetteWarp *= inspection ? 1.08 : 1.0;
  settings.asymmetry *= inspection ? 1.06 : 1.0;
  settings.shardStrength *= inspection ? 1.07 : 1.0;
  settings.craterRimBrightening *= inspection ? 1.18 : 1.0;
  settings.colourContrast *= inspection ? 1.16 : 1.0;

  // Valetudo follows the supplied planet-like reference. Keep its limb truly
  // spherical and let the crater/height maps provide the visible terrain.
  // The generic irregular-moon warp previously made it look like an asteroid.
  if (profile.catalogueName === "Valetudo") {
    settings.broadRelief = inspection ? 0.010 : 0.0045;
    settings.rockRelief = inspection ? 0.007 : 0.0030;
    settings.fineRelief = inspection ? 0.0035 : 0.0015;
    settings.silhouetteWarp = 0;
    settings.asymmetry = 0;
    settings.shardStrength = 0;
    settings.bilobeStrength = 0;
    settings.craterCount = inspection ? Math.max(settings.craterCount, 34) : Math.max(settings.craterCount, 22);
    settings.craterDepth = inspection ? 0.045 : 0.022;
    settings.flatShading = false;
  }

  if (inspection) {
    // A selected satellite is always smooth-shaded. Its silhouette and relief
    // remain true geometry, but the mesh no longer advertises its triangles as
    // a low-poly game asset. Preview rocks may remain lightly faceted because
    // they occupy only a few pixels and benefit from the cheaper geometry.
    settings.flatShading = false;

    // These counts describe feature density, not claimed crater coordinates.
    // Spacecraft-resolved worlds follow their observed geology; unresolved
    // irregular moons receive restrained, family-appropriate impact relief.
    if (profile.catalogueName === "Callisto") {
      settings.craterCount = Math.max(settings.craterCount, 68);
    } else if (profile.catalogueName === "Ganymede") {
      settings.craterCount = Math.max(settings.craterCount, 34);
    } else if (profile.catalogueName === "Europa") {
      settings.craterCount = Math.min(settings.craterCount, 3);
    } else if (profile.catalogueName === "Io") {
      settings.craterCount = 0;
    } else if (isInner && !["Metis", "Adrastea"].includes(profile.catalogueName)) {
      settings.craterCount = Math.max(settings.craterCount, 18);
    } else if (!isHero && !isInner) {
      settings.craterCount = Number.isFinite(settings.inspectionCraterCount)
        ? settings.inspectionCraterCount
        : Math.max(settings.craterCount, 16);
    }
  }

  settings.renderMode = mode;
  return settings;
}

function makeCraterField(profile, settings) {
  const craters = Array.from({ length: settings.craterCount }, (_, index) => {
    const radius = settings.craterRadiusMin
      + random01(profile.seed, index, 2) * (settings.craterRadiusMax - settings.craterRadiusMin);
    return {
      center: randomDirection(profile.seed + 3.17, index),
      radius,
      cosLimit: Math.cos(radius * 1.30),
      depth: settings.craterDepth * (0.42 + random01(profile.seed, index, 3) * 0.82),
      rim: settings.craterDepth * (0.16 + random01(profile.seed, index, 4) * 0.22),
    };
  });

  (NAMED_CRATERS[profile.catalogueName] ?? []).forEach((crater) => {
    craters.push({
      center: new THREE.Vector3(...crater.center).normalize(),
      radius: crater.radius,
      cosLimit: Math.cos(crater.radius * 1.30),
      depth: settings.craterDepth * crater.depth,
      rim: settings.craterDepth * 0.24 * crater.rim,
    });
  });
  return craters;
}

function sampleCrater(direction, crater) {
  const alignment = THREE.MathUtils.clamp(direction.dot(crater.center), -1, 1);
  // Most vertices are nowhere near a given crater. Reject them with a cheap
  // cosine comparison before paying for acos; this keeps 68-crater Callisto
  // responsive even with a real close-up mesh.
  if (alignment < crater.cosLimit) return { height: 0, floor: 0, rim: 0, ejecta: 0 };
  const angularDistance = Math.acos(alignment);
  const normalized = angularDistance / crater.radius;
  if (normalized > 1.30) return { height: 0, floor: 0, rim: 0, ejecta: 0 };
  const bowl = -crater.depth * Math.pow(Math.max(0, 1 - normalized * normalized), 1.30);
  const rim = crater.rim * Math.exp(-Math.pow((normalized - 0.97) / 0.12, 2));
  const ejecta = Math.exp(-Math.pow((normalized - 1.12) / 0.24, 2));
  return {
    height: bowl + rim,
    floor: 1 - smoothstep(0.08, 0.90, normalized),
    rim: Math.exp(-Math.pow((normalized - 0.98) / 0.13, 2)),
    ejecta,
  };
}

/**
 * Io's dark pits are volcanic paterae rather than impact craters. They use a
 * shallow collapsed floor, a broken rim, and occasional hot inner material so
 * the geometry matches the process instead of borrowing lunar crater logic.
 */
function makeIoVolcanicField(profile, mode = "preview") {
  if (profile.catalogueName !== "Io") return [];
  const count = mode === "inspection" ? 34 : 20;
  return Array.from({ length: count }, (_, index) => {
    const radius = 0.022 + random01(profile.seed, index, 12) * 0.072;
    return {
      center: randomDirection(profile.seed + 467.3, index),
      radius,
      cosLimit: Math.cos(radius * 1.24),
      depth: 0.0035 + random01(profile.seed, index, 14) * 0.0065,
      rim: 0.0012 + random01(profile.seed, index, 15) * 0.0022,
      hot: random01(profile.seed, index, 13) > 0.73,
    };
  });
}

function sampleIoCaldera(direction, caldera) {
  const alignment = THREE.MathUtils.clamp(direction.dot(caldera.center), -1, 1);
  if (alignment < caldera.cosLimit) return { height: 0, mask: 0, rim: 0 };
  const angularDistance = Math.acos(alignment);
  const normalized = angularDistance / caldera.radius;
  if (normalized > 1.24) return { height: 0, mask: 0, rim: 0 };
  const floor = -caldera.depth * (1 - smoothstep(0.34, 0.88, normalized));
  const rimMask = Math.exp(-Math.pow((normalized - 0.92) / 0.13, 2));
  return {
    height: floor + rimMask * caldera.rim,
    mask: 1 - smoothstep(0.16, 1.0, normalized),
    rim: rimMask,
  };
}

function makeGreatCircleFeatures(profile, settings) {
  return Array.from({ length: settings.ridgeCount }, (_, index) => ({
    normal: randomDirection(profile.seed + 31.7, index),
    width: settings.ridgeWidthMin
      + random01(profile.seed, index, 5) * (settings.ridgeWidthMax - settings.ridgeWidthMin),
    phase: random01(profile.seed, index, 6) * Math.PI * 2,
    relief: settings.ridgeRelief * (0.62 + random01(profile.seed, index, 7) * 0.65),
  }));
}

function sampleGreatCircle(direction, feature, seed) {
  const distance = Math.abs(direction.dot(feature.normal));
  const line = 1 - smoothstep(feature.width * 0.18, feature.width, distance);
  const broken = 0.54 + 0.46 * smoothNoise3(
    direction.x * 42,
    direction.y * 42,
    direction.z * 42,
    seed + feature.phase,
  );
  return line * THREE.MathUtils.clamp(broken + 0.20, 0, 1);
}

function makeMountainField(profile, settings) {
  return Array.from({ length: settings.mountainCount }, (_, index) => ({
    center: randomDirection(profile.seed + 67.3, index),
    radius: settings.mountainRadiusMin
      + random01(profile.seed, index, 8) * (settings.mountainRadiusMax - settings.mountainRadiusMin),
    height: settings.mountainHeight * (0.55 + random01(profile.seed, index, 9) * 0.85),
  }));
}

function sampleMountain(direction, mountain) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(mountain.center), -1, 1));
  const normalized = distance / mountain.radius;
  if (normalized > 1) return 0;
  return mountain.height * Math.pow(Math.max(0, 1 - normalized), 1.8);
}

function makePatchField(profile, settings) {
  return Array.from({ length: settings.chaosCount }, (_, index) => ({
    center: randomDirection(profile.seed + 103.9, index),
    radius: 0.07 + random01(profile.seed, index, 10) * 0.18,
    intensity: 0.45 + random01(profile.seed, index, 11) * 0.55,
  }));
}

function sampleSpot(direction, center, radius) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  return 1 - smoothstep(radius * 0.28, radius, distance);
}

function samplePatchField(direction, patches) {
  let mask = 0;
  patches.forEach((patch) => {
    mask = Math.max(mask, sampleSpot(direction, patch.center, patch.radius) * patch.intensity);
  });
  return mask;
}

function sampleCallistoBasin(direction) {
  const angularDistance = Math.acos(
    THREE.MathUtils.clamp(direction.dot(CALLOUT_DIRECTIONS.callistoBasin), -1, 1),
  );
  const basin = 1 - smoothstep(0.16, 0.42, angularDistance);
  let rings = 0;
  [0.18, 0.25, 0.32, 0.39, 0.46].forEach((ringRadius, index) => {
    const width = 0.012 + index * 0.002;
    rings = Math.max(rings, Math.exp(-Math.pow((angularDistance - ringRadius) / width, 2)));
  });
  return { basin, rings };
}

function morphologyWarp(direction, profile, settings) {
  if (profile.family === "Galilean moon") return 0;

  // Callirrhoe's supplied reference is a compact dark potato rather than a
  // generic spiky asteroid. A fuller upper shoulder and softly clipped opposite
  // end reproduce its asymmetric trapezoidal outline while keeping one mesh.
  if (profile.catalogueName === "Callirrhoe") {
    const fullShoulder = Math.pow(
      Math.max(0, direction.dot(CALLIRRHOE_FULL_SHOULDER_AXIS)),
      2.5,
    ) * 0.130;
    const clippedEnd = Math.pow(
      Math.max(0, direction.dot(CALLIRRHOE_CLIPPED_END_AXIS)),
      4.4,
    ) * 0.110;
    const lowBelly = Math.pow(Math.max(0, -direction.y), 2.8) * 0.042;
    return fullShoulder + lowBelly - clippedEnd + direction.x * 0.020;
  }

  // Thyone remains broadly rounded in the reference, with only restrained
  // facet changes. Suppressing the family shard field prevents a tiny moon from
  // becoming an implausibly sharp rock in close inspection.
  if (profile.catalogueName === "Thyone") {
    const softBulge = Math.pow(
      Math.max(0, direction.dot(THYONE_SOFT_BULGE_AXIS)),
      2.8,
    ) * 0.075;
    const flatFace = Math.pow(
      Math.max(0, direction.dot(THYONE_FLAT_FACE_AXIS)),
      4.6,
    ) * 0.062;
    const roundedFacets = (
      Math.pow(Math.abs(direction.x), 4.2)
      + Math.pow(Math.abs(direction.y), 4.2)
      + Math.pow(Math.abs(direction.z), 4.2)
      - 0.72
    ) * 0.028;
    return softBulge + roundedFacets - flatFace;
  }

  // Pasithee's supplied artwork has a distinctive top-heavy pear silhouette:
  // broad through the middle, pinched below an offset cap, then tapering to a
  // lower point. These smooth fields preserve that readable outline from many
  // camera angles without resorting to detached lobes.
  if (profile.catalogueName === "Pasithee") {
    const equatorialBulge = Math.max(0, 1 - direction.y * direction.y) * 0.095;
    const upperCap = Math.pow(
      Math.max(0, direction.dot(PASITHEE_UPPER_CAP_AXIS)),
      2.7,
    ) * 0.165;
    const rearShoulder = Math.pow(
      Math.max(0, direction.dot(PASITHEE_REAR_SHOULDER_AXIS)),
      3.2,
    ) * 0.090;
    const neck = Math.exp(-Math.pow((direction.y - 0.55) / 0.16, 2)) * 0.118;
    const lowerPoint = Math.pow(Math.max(0, -direction.y), 4.0) * 0.145;
    return equatorialBulge + upperCap + rearShoulder + lowerPoint - neck;
  }

  // Arche's reference is a chunky, warm-red impact fragment. Keep the body
  // compact, push one crown outward and softly plane off the opposite side so
  // its readable angular rock silhouette does not collapse into a generic oval.
  if (profile.catalogueName === "Arche") {
    const crown = Math.pow(
      Math.max(0, direction.dot(ARCHE_CROWN_AXIS)),
      2.5,
    ) * 0.135;
    const clippedFace = Math.pow(
      Math.max(0, direction.dot(ARCHE_CLIPPED_FACE_AXIS)),
      4.4,
    ) * 0.105;
    const broadFacet = (
      Math.pow(Math.abs(direction.x), 3.4)
      + Math.pow(Math.abs(direction.y), 3.8)
      + Math.pow(Math.abs(direction.z), 3.2)
      - 0.80
    ) * 0.030;
    return crown + broadFacet - clippedFace + direction.x * 0.018;
  }

  // Helike's supplied artwork reads as a hooked crescent with an enormous
  // concavity. The cut is based on the body's right-side longitude and vertical
  // position, so it actually reaches the visible limb instead of becoming only
  // a shallow front-facing dent. Upper and lower horns remain around the cut.
  if (profile.catalogueName === "Helike") {
    const rightSide = smoothstep(0.05, 0.98, direction.x);
    const middleBand = Math.exp(-Math.pow(direction.y / 0.55, 4));
    const cavity = rightSide * middleBand * 0.90;
    const upperHorn = smoothstep(0.32, 0.95, direction.y)
      * smoothstep(0.10, 0.95, direction.x)
      * 0.24;
    const lowerHook = smoothstep(0.18, 0.95, -direction.y)
      * smoothstep(0.05, 0.95, direction.x)
      * 0.42;
    const rearMass = smoothstep(0.10, 0.95, -direction.x) * 0.08;
    return rearMass + upperHorn + lowerHook - cavity;
  }

  // Kore is intentionally planet-like in the supplied reference: almost round,
  // smoothly lit and defined by craters rather than by an asteroid silhouette.
  if (profile.catalogueName === "Kore") return 0;

  // Philophrosyne is shown as a compact dwarf-moon-like globe. Retain only a
  // tiny natural unevenness so the crater field, not random spikes, defines it.
  if (profile.catalogueName === "Philophrosyn") {
    const lowEquatorialBulge = Math.max(0, 1 - direction.y * direction.y) * 0.012;
    return lowEquatorialBulge + direction.x * 0.004;
  }

  // Herse follows the supplied homogeneous light-red Carme-family guidance. Its
  // muted colour is paired with a simple rounded potato body, one fuller end and
  // one flatter fractured end rather than dramatic lobes or colour provinces.
  if (profile.catalogueName === "Herse") {
    const fullEnd = Math.pow(
      Math.max(0, direction.dot(HERSE_FULL_END_AXIS)),
      2.7,
    ) * 0.090;
    const flatEnd = Math.pow(
      Math.max(0, direction.dot(HERSE_FLAT_END_AXIS)),
      4.0,
    ) * 0.075;
    return fullEnd - flatEnd + direction.y * 0.012;
  }

  // Eirene is deliberately more fragmented and porous: a dominant lobe, raised
  // shard and missing lower notch produce a jagged potato-shaped collision
  // fragment whose heavy crater relief remains visible during inspection.
  if (profile.catalogueName === "Eirene") {
    const mainLobe = Math.pow(
      Math.max(0, direction.dot(EIRENE_MAIN_LOBE_AXIS)),
      2.25,
    ) * 0.125;
    const shard = Math.pow(
      Math.max(0, direction.dot(EIRENE_SHARD_AXIS)),
      3.8,
    ) * 0.115;
    const notch = Math.pow(
      Math.max(0, direction.dot(EIRENE_NOTCH_AXIS)),
      4.0,
    ) * 0.105;
    return mainLobe + shard - notch + direction.x * 0.026;
  }

  // Eupheme is shown as a compact, almost spherical heavily cratered body.
  // Its dominant upper basin is cut into the actual radius and surrounded by a
  // raised broken rim so the feature changes naturally with moving light.
  if (profile.catalogueName === "Eupheme") {
    const alignment = THREE.MathUtils.clamp(
      direction.dot(EUPHEME_HERO_BASIN_AXIS),
      -1,
      1,
    );
    const angularDistance = Math.acos(alignment);
    const bowl = (1 - smoothstep(0.065, 0.285, angularDistance)) * 0.072;
    const rim = Math.exp(-Math.pow((angularDistance - 0.302) / 0.042, 2)) * 0.026;
    const innerFloor = (1 - smoothstep(0.030, 0.118, angularDistance)) * 0.010;
    const subtleEquator = Math.max(0, 1 - direction.y * direction.y) * 0.008;
    return rim + subtleEquator - bowl - innerFloor;
  }

  // Pandia's reference combines a rounded pale hemisphere with a crushed,
  // irregular fracture face. A broad directional cut, rubble relief and a small
  // crown reproduce that contrast without making it two detached meshes.
  if (profile.catalogueName === "Pandia") {
    const alignment = THREE.MathUtils.clamp(
      direction.dot(PANDIA_FRACTURE_AXIS),
      -1,
      1,
    );
    const fractureMask = smoothstep(0.02, 0.94, Math.max(0, alignment));
    const rubbleNoise = fbm3(direction, 7.5, 4, profile.seed + 1901);
    const coarseBreaks = fbm3(direction, 3.4, 3, profile.seed + 1919);
    const fractureFace = fractureMask * 0.185;
    const rubbleRelief = fractureMask
      * (rubbleNoise * 0.040 + Math.abs(coarseBreaks) * 0.030);
    const crown = Math.pow(
      Math.max(0, direction.dot(PANDIA_CROWN_AXIS)),
      3.0,
    ) * 0.052;
    const faceting = (
      Math.pow(Math.abs(direction.x), 4.2)
      + Math.pow(Math.abs(direction.y), 4.0)
      + Math.pow(Math.abs(direction.z), 4.4)
      - 0.72
    ) * 0.014;
    return crown + faceting + rubbleRelief - fractureFace;
  }

  // Ersa remains softly rounded and only slightly uneven, matching the pale
  // lavender-grey reference rather than the generic sharp irregular-moon warp.
  if (profile.catalogueName === "Ersa") {
    const softBulge = Math.pow(
      Math.max(0, direction.dot(ERSA_SOFT_BULGE_AXIS)),
      3.2,
    ) * 0.018;
    const gentleFlattening = -Math.pow(Math.abs(direction.y), 4.0) * 0.008;
    return softBulge + gentleFlattening;
  }

  // Aitne's reference is bent rather than simply vertically stretched. Three
  // directional fields build the narrow upper arm, offset lower mass and inner
  // notch that form its readable L-shaped outline.
  if (profile.catalogueName === "Aitne") {
    const upperLobe = Math.pow(
      Math.max(0, direction.dot(AITNE_UPPER_LOBE_AXIS)),
      2.35,
    ) * 0.195;
    const lowerLobe = Math.pow(
      Math.max(0, direction.dot(AITNE_LOWER_LOBE_AXIS)),
      2.10,
    ) * 0.305;
    const innerNotch = Math.pow(
      Math.max(0, direction.dot(AITNE_INNER_NOTCH_AXIS)),
      4.0,
    ) * 0.125;
    return upperLobe + lowerLobe - innerNotch;
  }

  // Dia's supplied image has a distinct rock-like shoulder protruding from
  // one end. The broad main mass stays rounded while the narrower directional
  // bulge and shallow upper notch keep it from reading as a plain ellipsoid.
  if (profile.catalogueName === "Dia") {
    const endBulge = Math.pow(
      Math.max(0, direction.dot(DIA_BULGE_AXIS)),
      2.15,
    ) * 0.255;
    const mainMass = Math.pow(
      Math.max(0, direction.dot(DIA_MAIN_MASS_AXIS)),
      2.4,
    ) * 0.080;
    const shoulderNotch = Math.pow(
      Math.max(0, direction.dot(DIA_SHOULDER_NOTCH_AXIS)),
      3.8,
    ) * 0.075;
    return endBulge + mainMass - shoulderNotch;
  }

  // The generic irregular warp made Thelxinoe too jagged. Its new reference
  // calls for a soft multi-lobed body with one dominant cavity. Carving that
  // cavity into the radius lets real sunlight describe it without painting a
  // false permanent shadow into the colour map.
  if (profile.catalogueName === "Thelxinoe") {
    const cavityAlignment = Math.max(0, direction.dot(THELXINOE_CAVITY_AXIS));
    const cavity = Math.pow(cavityAlignment, 4.6) * 0.245;
    const roundedLobes = (
      Math.pow(Math.abs(direction.x), 3.0)
      + Math.pow(Math.abs(direction.y), 3.2)
    ) * 0.018;
    const rearBulge = Math.pow(
      Math.max(0, -direction.dot(THELXINOE_CAVITY_AXIS)),
      3.2,
    ) * 0.032;
    return roundedLobes + rearBulge - cavity;
  }

  // Cyllene and Valetudo are explicitly planet-like in their supplied visual
  // references. Suppress the generic shard/bilobe field so the silhouette stays
  // spherical while real crater relief catches the moving sunlight.
  if (["Cyllene", "Valetudo"].includes(profile.catalogueName)) return 0;

  // Hegemone is reconstructed as a compact wedge. A clipped leading face and
  // small longitudinal taper keep that silhouette readable from many angles.
  if (profile.catalogueName === "Hegemone") {
    const chippedFace = Math.pow(
      Math.max(0, direction.dot(HEGEMONE_CHIPPED_AXIS)),
      5.0,
    ) * 0.105;
    return direction.x * 0.040 - chippedFace;
  }

  // The supplied Themisto reference is a contact-binary-like body. Align its
  // two lobes with the mesh's long X axis so the narrow waist remains visible
  // from multiple inspection angles instead of becoming random noise.
  if (profile.catalogueName === "Themisto") {
    const axialPosition = direction.x;
    const lobes = (
      Math.pow(Math.abs(axialPosition), 2.4) - 0.24
    ) * settings.silhouetteWarp;
    const neck = -Math.exp(
      -Math.pow(axialPosition / 0.21, 2),
    ) * settings.bilobeStrength;
    const unevenLobes = Math.max(0, axialPosition) * settings.asymmetry * 0.70;
    const chippedEnd = Math.pow(
      Math.max(0, direction.dot(THEMISTO_CHIPPED_AXIS)),
      4,
    ) * settings.shardStrength;
    return lobes + neck + unevenLobes + chippedEnd;
  }

  const axisA = randomDirection(profile.seed + 211.3, 0);
  const axisB = randomDirection(profile.seed + 277.9, 1);
  const axisC = randomDirection(profile.seed + 331.1, 2);
  const lobe = (Math.pow(Math.abs(direction.dot(axisA)), 3.2) - 0.28) * settings.silhouetteWarp;
  const asymmetry = direction.dot(axisB) * settings.asymmetry;
  const shard = Math.pow(Math.max(0, direction.dot(axisC)), 4.0) * settings.shardStrength;
  const neck = -Math.exp(-Math.pow(direction.dot(axisA) / 0.24, 2)) * settings.bilobeStrength;
  return lobe + asymmetry + shard + neck;
}

function setVertexColour(target, index, colour) {
  target[index * 3] = colour.r;
  target[index * 3 + 1] = colour.g;
  target[index * 3 + 2] = colour.b;
}

function createJovianGeometry(profile, quality, mode = "preview") {
  const settings = resolveModeSettings(profile, mode);
  const sourceGeometry = new THREE.IcosahedronGeometry(1, detailFor(profile, quality, mode));
  const positions = sourceGeometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const palette = createMeasuredOpticalPalette(profile);
  const baseColour = new THREE.Color(palette.base);
  const lightColour = new THREE.Color(palette.light);
  const darkColour = new THREE.Color(palette.dark);
  const accentColour = new THREE.Color(palette.accent);
  const sulfurWhite = new THREE.Color(0xfff2b5);
  const sulfurOrange = new THREE.Color(0xef7a1e);
  const direction = new THREE.Vector3();
  const colour = new THREE.Color();
  const usesSpacecraftMosaic = HERO_GALILEAN_TEXTURES.has(profile.catalogueName);
  const craterField = usesSpacecraftMosaic ? [] : makeCraterField(profile, settings);
  const ridges = usesSpacecraftMosaic ? [] : makeGreatCircleFeatures(profile, settings);
  const mountains = usesSpacecraftMosaic ? [] : makeMountainField(profile, settings);
  const patches = usesSpacecraftMosaic ? [] : makePatchField(profile, settings);

  const ioVolcanoes = usesSpacecraftMosaic ? [] : makeIoVolcanicField(profile, mode);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    const broad = fbm3(direction, 1.45, 4, profile.seed + 7) * settings.broadRelief;
    const rocky = fbm3(direction, 6.2, 4, profile.seed + 47) * settings.rockRelief;
    const fine = fbm3(direction, 22.0, 3, profile.seed + 101) * settings.fineRelief;
    const morphology = morphologyWarp(direction, profile, settings);

    let craterHeight = 0;
    let craterFloor = 0;
    let craterRim = 0;
    let craterEjecta = 0;
    craterField.forEach((crater) => {
      const sample = sampleCrater(direction, crater);
      craterHeight += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rim);
      craterEjecta = Math.max(craterEjecta, sample.ejecta);
    });

    let ridgeMask = 0;
    let ridgeHeight = 0;
    ridges.forEach((ridge) => {
      const sample = sampleGreatCircle(direction, ridge, profile.seed);
      ridgeMask = Math.max(ridgeMask, sample);
      ridgeHeight += sample * ridge.relief;
    });

    let mountainHeight = 0;
    mountains.forEach((mountain) => {
      mountainHeight += sampleMountain(direction, mountain);
    });

    const patchMask = samplePatchField(direction, patches);
    const patchHeight = patchMask
      * settings.chaosRelief
      * (0.45 + 0.55 * fbm3(direction, 18, 3, profile.seed + 509));

    const callistoBasin = profile.catalogueName === "Callisto" && !usesSpacecraftMosaic
      ? sampleCallistoBasin(direction)
      : { basin: 0, rings: 0 };
    const basinHeight = profile.catalogueName === "Callisto" && !usesSpacecraftMosaic
      ? -callistoBasin.basin * 0.0035 + callistoBasin.rings * 0.0022
      : 0;

    let volcanicHeight = 0;
    let volcanicMask = 0;
    let volcanicHotMask = 0;
    let volcanicRim = 0;
    ioVolcanoes.forEach((caldera) => {
      const sample = sampleIoCaldera(direction, caldera);
      volcanicHeight += sample.height;
      volcanicMask = Math.max(volcanicMask, sample.mask);
      if (caldera.hot) volcanicHotMask = Math.max(volcanicHotMask, sample.mask);
      volcanicRim = Math.max(volcanicRim, sample.rim);
    });

    const proceduralReliefScale = usesSpacecraftMosaic
      ? (mode === "inspection" ? 0.12 : 0.035)
      : 1;
    const minimumRadialHeight = profile.catalogueName === "Helike"
      ? 0.08
      : profile.family === "Galilean moon"
        ? 0.97
        : 0.55;
    const radialHeight = Math.max(
      minimumRadialHeight,
      1
        + (broad + rocky + fine) * proceduralReliefScale
        + morphology
        + craterHeight
        + ridgeHeight
        + mountainHeight
        + patchHeight
        + basinHeight
        + volcanicHeight,
    );

    let positionX = direction.x * radialHeight;
    let positionY = direction.y * radialHeight;
    let positionZ = direction.z * radialHeight;

    if (profile.catalogueName === "Callirrhoe") {
      const shoulder = Math.pow(
        Math.max(0, direction.dot(CALLIRRHOE_FULL_SHOULDER_AXIS)),
        2.7,
      );
      positionX += shoulder * 0.060;
      positionY += shoulder * 0.026;
    } else if (profile.catalogueName === "Pasithee") {
      // Shift the cap slightly to one side and pull the bottom downward so the
      // source image's lopsided pear silhouette remains evident after the
      // catalogue's overall Y elongation is applied.
      const upper = smoothstep(0.34, 0.94, direction.y);
      const lower = smoothstep(0.30, 0.96, -direction.y);
      positionX -= upper * 0.125;
      positionZ += upper * 0.060;
      positionY -= lower * 0.095;
    } else if (profile.catalogueName === "Helike") {
      // Pull both horns out past the carved middle band. This keeps the deep
      // crescent opening and the lower inward-curving hook visible in silhouette.
      const rightSide = smoothstep(0.05, 0.98, direction.x);
      const middleBand = Math.exp(-Math.pow(direction.y / 0.55, 4));
      const cavity = rightSide * middleBand;
      const upperHorn = smoothstep(0.32, 0.95, direction.y) * rightSide;
      const lowerHook = smoothstep(0.18, 0.95, -direction.y) * rightSide;
      positionX += upperHorn * 0.15 + lowerHook * 0.28 - cavity * 0.08;
      positionY -= lowerHook * 0.10;
      positionZ += lowerHook * 0.035;
    } else if (profile.catalogueName === "Pandia") {
      const fracture = Math.pow(
        Math.max(0, direction.dot(PANDIA_FRACTURE_AXIS)),
        2.4,
      );
      positionX -= PANDIA_FRACTURE_AXIS.x * fracture * 0.060;
      positionY -= PANDIA_FRACTURE_AXIS.y * fracture * 0.060;
      positionZ -= PANDIA_FRACTURE_AXIS.z * fracture * 0.060;
    } else if (profile.catalogueName === "Aitne") {
      // Radial relief alone can make two lobes, but it cannot convincingly
      // shift one lobe sideways. Smoothly offset the upper and lower portions
      // in opposite directions to form the bent reference silhouette without
      // introducing a seam or a detached second mesh.
      const upperBend = smoothstep(0.02, 0.88, direction.y);
      const lowerBend = smoothstep(0.04, 0.84, -direction.y);
      positionX += upperBend * 0.180 - lowerBend * 0.100;
      positionZ += upperBend * 0.018;
    } else if (profile.catalogueName === "Dia") {
      // Pull the directional shoulder outward and slightly downward so Dia's
      // protruding rock remains visible in silhouette, not merely as coloured
      // or bump-mapped surface detail.
      const shoulder = Math.pow(
        Math.max(0, direction.dot(DIA_BULGE_AXIS)),
        2.5,
      );
      positionX += shoulder * 0.145;
      positionY -= shoulder * 0.048;
    }

    positions.setXYZ(index, positionX, positionY, positionZ);

    const colourNoise = fbm3(direction, 7.8, 4, profile.seed + 163) * 0.5 + 0.5;
    const macroMottle = fbm3(direction, 2.7, 3, profile.seed + 229) * 0.5 + 0.5;
    colour.copy(baseColour)
      .lerp(lightColour, THREE.MathUtils.clamp(colourNoise * settings.colourContrast, 0, 0.70))
      .lerp(darkColour, THREE.MathUtils.clamp((1 - macroMottle) * 0.18, 0, 0.24));

    colour.lerp(
      darkColour,
      THREE.MathUtils.clamp(craterFloor * settings.craterFloorDarkening, 0, 0.72),
    );
    colour.lerp(
      lightColour,
      THREE.MathUtils.clamp(craterRim * settings.craterRimBrightening, 0, 0.72),
    );

    if (profile.catalogueName === "Io") {
      const sulfurField = fbm3(direction, 3.8, 4, profile.seed + 601) * 0.5 + 0.5;
      colour.lerp(sulfurWhite, smoothstep(0.56, 0.88, sulfurField) * 0.52);
      colour.lerp(sulfurOrange, smoothstep(0.18, 0.50, 1 - sulfurField) * 0.30);
      colour.lerp(accentColour, volcanicMask * 0.76);
      colour.lerp(darkColour, volcanicHotMask * 0.96);
      colour.lerp(sulfurWhite, volcanicRim * 0.22);
    } else if (profile.catalogueName === "Europa") {
      colour.lerp(accentColour, THREE.MathUtils.clamp(ridgeMask * 0.88, 0, 0.90));
      colour.lerp(darkColour, THREE.MathUtils.clamp(patchMask * 0.20, 0, 0.25));
      colour.lerp(lightColour, (1 - patchMask) * 0.08);
    } else if (profile.catalogueName === "Ganymede") {
      colour.lerp(lightColour, THREE.MathUtils.clamp(ridgeMask * 0.56, 0, 0.64));
      colour.lerp(darkColour, THREE.MathUtils.clamp(patchMask * 0.40, 0, 0.48));
    } else if (profile.catalogueName === "Callisto") {
      colour.lerp(accentColour, THREE.MathUtils.clamp(craterRim * 0.64 + craterEjecta * 0.16, 0, 0.72));
      colour.lerp(lightColour, THREE.MathUtils.clamp(callistoBasin.rings * 0.50, 0, 0.58));
      colour.lerp(darkColour, THREE.MathUtils.clamp(callistoBasin.basin * 0.14, 0, 0.18));
    }

    if (profile.catalogueName === "Amalthea") {
      const patchA = sampleSpot(direction, CALLOUT_DIRECTIONS.amaltheaPatchA, 0.22);
      const patchB = sampleSpot(direction, CALLOUT_DIRECTIONS.amaltheaPatchB, 0.16);
      colour.lerp(accentColour, Math.max(patchA, patchB) * 0.68);
    }

    // Distant irregulars are family-coloured, but each receives unique impact
    // mottling and facet contrast from its stable seed.
    if (profile.surfaceEvidence !== "spacecraft-resolved") {
      const facetMottle = fbm3(direction, 13.0, 2, profile.seed + 733) * 0.5 + 0.5;
      colour.lerp(lightColour, smoothstep(0.72, 0.96, facetMottle) * 0.16);
      colour.lerp(darkColour, smoothstep(0.76, 0.98, 1 - facetMottle) * 0.18);
    }

    setVertexColour(colours, index, colour);
  }

  sourceGeometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  sourceGeometry.deleteAttribute("normal");

  let finalGeometry;
  if (settings.flatShading) {
    finalGeometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
    if (finalGeometry !== sourceGeometry) sourceGeometry.dispose();
    finalGeometry.computeVertexNormals();
  } else {
    finalGeometry = mergeVertices(sourceGeometry, 1e-5);
    sourceGeometry.dispose();
    finalGeometry.computeVertexNormals();
  }

  finalGeometry.computeBoundingSphere();
  finalGeometry.computeBoundingBox();
  finalGeometry.userData = {
    surfaceEvidence: profile.surfaceEvidence,
    surfaceStructure: profile.surfaceStructure,
    surfaceFamily: profile.family,
    flatShading: settings.flatShading,
  };
  return { geometry: finalGeometry, settings, palette };
}

function inspectionTextureWidth(profile, quality) {
  if (profile.family === "Galilean moon") {
    return quality === "low" ? 256 : quality === "medium" ? 320 : 384;
  }
  return quality === "low" ? 128 : quality === "medium" ? 192 : 256;
}

function createInspectionBumpTexture(profile, settings, quality = "high") {
  // The old 128×64 map spread each bump across a visibly broad patch. This
  // higher-resolution, lazily-created map keeps close-up pits, grooves and
  // regolith granular while allocating it only to the selected moon.
  const width = inspectionTextureWidth(profile, quality);
  const height = width * 0.5;
  const pixels = new Uint8Array(width * height * 4);
  const direction = new THREE.Vector3();
  const craters = makeCraterField(profile, {
    ...settings,
    craterCount: Math.min(settings.craterCount, profile.catalogueName === "Callisto" ? 68 : 34),
  });
  const ridges = makeGreatCircleFeatures(profile, settings);
  const mountains = makeMountainField(profile, settings);
  const patches = makePatchField(profile, settings);
  const ioVolcanoes = makeIoVolcanicField(profile, "inspection");

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const phi = u * Math.PI * 2 - Math.PI;
      direction.set(
        Math.cos(phi) * sinTheta,
        cosTheta,
        Math.sin(phi) * sinTheta,
      );

      let relief = 0.50
        + fbm3(direction, 2.2, 4, profile.seed + 907) * 0.14
        + fbm3(direction, 13.5, 3, profile.seed + 977) * 0.055;

      craters.forEach((crater) => {
        const sample = sampleCrater(direction, crater);
        relief += sample.height * 2.15 + sample.rim * 0.20;
      });

      ridges.forEach((ridge) => {
        // Preserve the geological sign: Europa's reddish lineae cut subtly
        // into the ice while Ganymede's grooved terrain rises into ridges.
        relief += sampleGreatCircle(direction, ridge, profile.seed + 19)
          * ridge.relief
          * 9.0;
      });

      mountains.forEach((mountain) => {
        relief += sampleMountain(direction, mountain) * 2.4;
      });

      ioVolcanoes.forEach((caldera) => {
        relief += sampleIoCaldera(direction, caldera).height * 5.2;
      });

      const patch = samplePatchField(direction, patches);
      relief += patch * 0.045;

      if (profile.catalogueName === "Callisto") {
        const basin = sampleCallistoBasin(direction);
        relief += basin.rings * 0.10 - basin.basin * 0.045;
      }

      const value = Math.round(THREE.MathUtils.clamp(relief, 0, 1) * 255);
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.name = `${profile.name} procedural inspection relief`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}


const HERO_GALILEAN_TEXTURES = new Set(["Io", "Europa", "Ganymede", "Callisto"]);

const HERO_GALILEAN_ASSET_URLS = Object.freeze({
  Io: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/io-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/io-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/io-roughness.jpg`,
  },
  Europa: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/europa-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/europa-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/europa-roughness.jpg`,
  },
  Ganymede: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/ganymede-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/ganymede-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/ganymede-roughness.jpg`,
  },
  Callisto: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/callisto-reference-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/callisto-reference-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/callisto-reference-roughness.jpg`,
  },
});

/**
 * Dedicated image- and description-directed surface sets for the supplied
 * irregular-moon references. The screenshots were not pasted directly onto the meshes: their
 * black space, labels, fixed lighting and silhouette were removed first. Their
 * colour/mineral character and local terrain were then rebuilt as clean,
 * seamless 2:1 albedo, height and roughness maps so sunlight can move naturally
 * across the final 3D bodies. Herse and Eirene use the same clean-map pipeline
 * from the user-provided colour, composition and terrain guidance. Eupheme,
 * Pandia and Ersa continue this reference-directed surface workflow.
 */
const REFERENCE_IRREGULAR_SURFACE_URLS = Object.freeze({
  Callirrhoe: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/callirrhoe-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/callirrhoe-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/callirrhoe-roughness.jpg`,
  },
  Thyone: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/thyone-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/thyone-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/thyone-roughness.jpg`,
  },
  Pasithee: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pasithee-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pasithee-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pasithee-roughness.jpg`,
  },
  Arche: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/arche-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/arche-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/arche-roughness.jpg`,
  },
  Helike: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/helike-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/helike-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/helike-roughness.jpg`,
  },
  Kore: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/kore-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/kore-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/kore-roughness.jpg`,
  },
  Herse: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/herse-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/herse-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/herse-roughness.jpg`,
  },
  Eirene: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/eirene-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/eirene-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/eirene-roughness.jpg`,
  },
  Philophrosyn: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/philophrosyne-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/philophrosyne-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/philophrosyne-roughness.jpg`,
  },
  Eupheme: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/eupheme-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/eupheme-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/eupheme-roughness.jpg`,
  },
  Pandia: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pandia-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pandia-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pandia-roughness.jpg`,
  },
  Pasiphae: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pasiphae-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pasiphae-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/pasiphae-roughness.jpg`,
  },
  Sinope: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/sinope-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/sinope-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/sinope-roughness.jpg`,
  },
  Carme: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/carme-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/carme-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/carme-roughness.jpg`,
  },
  Valetudo: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/valetudo-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/valetudo-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/valetudo-roughness.jpg`,
  },
  Ersa: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/ersa-albedo.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/ersa-height.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/ersa-roughness.jpg`,
  },
});

/**
 * Original, seamless 2:1 colour maps created from the user's visual direction.
 *
 * We intentionally do not wrap the supplied reference screenshots themselves:
 * their black backgrounds, baked-in shadows, fixed viewpoints and occasional
 * watermarks would be stretched around the mesh. These clean albedo maps carry
 * only surface colour and markings. The procedural height/roughness maps below
 * still provide the actual crater relief, rocky silhouette and response to the
 * Sun's light.
 */
const REFERENCE_IRREGULAR_ALBEDO_URLS = Object.freeze({
  Lysithea: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/lysithea-albedo.jpg`,
  Ananke: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/ananke-albedo.jpg`,
  Leda: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/leda-albedo.jpg`,
  Chaldene: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/chaldene-albedo.jpg`,
  Harpalyke: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/harpalyke-albedo.jpg`,
  Kalyke: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/kalyke-albedo.jpg`,
  Iocaste: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/iocaste-albedo.jpg`,
  Erinome: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/erinome-albedo.jpg`,
  Isonoe: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/isonoe-albedo.jpg`,
  Praxidike: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/praxidike-albedo.jpg`,
  Themisto: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/themisto-albedo.jpg`,
  // JPL's catalogue spelling is Magaclite; the interface displays Megaclite.
  Magaclite: `${PUBLIC_ASSET_ROOT}/textures/jovian/irregular-reference/megaclite-albedo.jpg`,
});

/**
 * Clear post-Praxidike bodies selected from the supplied moon collage.
 *
 * Blurry references deliberately remain on their existing evidence-tiered
 * procedural surfaces. Keeping this group separate also makes it explicit that
 * the previously completed twelve-moon pass above is unchanged.
 */
const COLLAGE_REFERENCE_ALBEDO_URLS = Object.freeze({
  Autonoe: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/autonoe-albedo.jpg`,
  Hermippe: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/hermippe-albedo.jpg`,
  Aitne: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/aitne-albedo.jpg`,
  Eurydome: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/eurydome-albedo.jpg`,
  Euanthe: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/euanthe-albedo.jpg`,
  Euporie: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/euporie-albedo.jpg`,
  Orthosie: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/orthosie-albedo.jpg`,
  Sponde: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/sponde-albedo.jpg`,
  Kale: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/kale-albedo.jpg`,
  Mneme: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/mneme-albedo.jpg`,
  Aoede: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/aoede-albedo.jpg`,
  Thelxinoe: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/thelxinoe-albedo.jpg`,
  Carpo: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/carpo-albedo.jpg`,
  Eukelade: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/eukelade-albedo.jpg`,
  Hegemone: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/hegemone-albedo.jpg`,
  Dia: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/dia-albedo.jpg`,
  Cyllene: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/cyllene-albedo.jpg`,
  Kallichore: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/kallichore-albedo.jpg`,
  S2010_J_2: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/s2010-j2-albedo.jpg`,
  S2010_J_1: `${PUBLIC_ASSET_ROOT}/textures/jovian/collage-reference/s2010-j1-albedo.jpg`,
});

const HERO_GALILEAN_MATERIAL = Object.freeze({
  Io: {
    roughness: 0.84,
    previewBumpScale: 0.018,
    inspectionBumpScale: 0.038,
    displacementScale: 0.0060,
    displacementBias: -0.0030,
    envMapIntensity: 0.018,
  },
  Europa: {
    roughness: 0.68,
    previewBumpScale: 0.007,
    inspectionBumpScale: 0.018,
    displacementScale: 0.0026,
    displacementBias: -0.0013,
    envMapIntensity: 0.040,
  },
  Ganymede: {
    roughness: 0.90,
    previewBumpScale: 0.014,
    inspectionBumpScale: 0.032,
    displacementScale: 0.0055,
    displacementBias: -0.00275,
    envMapIntensity: 0.020,
  },
  Callisto: {
    roughness: 0.97,
    previewBumpScale: 0.020,
    inspectionBumpScale: 0.046,
    displacementScale: 0.0074,
    displacementBias: -0.0037,
    envMapIntensity: 0.012,
  },
});

const REFERENCE_IRREGULAR_MATERIAL = Object.freeze({
  Callirrhoe: {
    roughness: 0.99,
    previewBumpScale: 0.014,
    inspectionBumpScale: 0.050,
    displacementScale: 0.013,
    displacementBias: -0.0065,
    envMapIntensity: 0.009,
  },
  Thyone: {
    roughness: 0.92,
    previewBumpScale: 0.011,
    inspectionBumpScale: 0.038,
    displacementScale: 0.010,
    displacementBias: -0.0050,
    envMapIntensity: 0.012,
  },
  Pasithee: {
    roughness: 0.99,
    previewBumpScale: 0.020,
    inspectionBumpScale: 0.064,
    displacementScale: 0.018,
    displacementBias: -0.0090,
    envMapIntensity: 0.008,
  },
  Arche: {
    roughness: 0.98,
    previewBumpScale: 0.018,
    inspectionBumpScale: 0.060,
    displacementScale: 0.016,
    displacementBias: -0.0080,
    envMapIntensity: 0.008,
  },
  Helike: {
    roughness: 0.93,
    previewBumpScale: 0.012,
    inspectionBumpScale: 0.042,
    displacementScale: 0.012,
    displacementBias: -0.0060,
    envMapIntensity: 0.011,
  },
  Kore: {
    roughness: 0.91,
    previewBumpScale: 0.014,
    inspectionBumpScale: 0.052,
    displacementScale: 0.014,
    displacementBias: -0.0070,
    envMapIntensity: 0.012,
  },
  Herse: {
    roughness: 0.99,
    previewBumpScale: 0.016,
    inspectionBumpScale: 0.055,
    displacementScale: 0.015,
    displacementBias: -0.0075,
    envMapIntensity: 0.008,
  },
  Eirene: {
    roughness: 1.0,
    previewBumpScale: 0.022,
    inspectionBumpScale: 0.070,
    displacementScale: 0.020,
    displacementBias: -0.0100,
    envMapIntensity: 0.006,
  },
  Philophrosyn: {
    roughness: 0.97,
    previewBumpScale: 0.018,
    inspectionBumpScale: 0.060,
    displacementScale: 0.016,
    displacementBias: -0.0080,
    envMapIntensity: 0.009,
  },
  Eupheme: {
    roughness: 0.96,
    previewBumpScale: 0.020,
    inspectionBumpScale: 0.068,
    displacementScale: 0.018,
    displacementBias: -0.0090,
    envMapIntensity: 0.010,
  },
  Pandia: {
    roughness: 0.93,
    previewBumpScale: 0.018,
    inspectionBumpScale: 0.060,
    displacementScale: 0.016,
    displacementBias: -0.0080,
    envMapIntensity: 0.012,
  },
  Pasiphae: { roughness: 0.99, previewBumpScale: 0.019, inspectionBumpScale: 0.064, displacementScale: 0.018, displacementBias: -0.009, envMapIntensity: 0.012 },
  Sinope: { roughness: 0.99, previewBumpScale: 0.017, inspectionBumpScale: 0.058, displacementScale: 0.016, displacementBias: -0.008, envMapIntensity: 0.011 },
  Carme: { roughness: 0.98, previewBumpScale: 0.016, inspectionBumpScale: 0.055, displacementScale: 0.015, displacementBias: -0.0075, envMapIntensity: 0.012 },
  Valetudo: { roughness: 0.92, previewBumpScale: 0.026, inspectionBumpScale: 0.078, displacementScale: 0.012, displacementBias: -0.006, envMapIntensity: 0.030 },
  Ersa: {
    roughness: 0.87,
    previewBumpScale: 0.009,
    inspectionBumpScale: 0.030,
    displacementScale: 0.008,
    displacementBias: -0.0040,
    envMapIntensity: 0.018,
  },
});

const heroTextureLoader = new THREE.TextureLoader();
const heroTextureCache = new Map();

function loadPersistentHeroTexture(url, { color = false } = {}) {
  if (!url) return null;
  if (heroTextureCache.has(url)) return heroTextureCache.get(url);

  const texture = heroTextureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.userData.persistentJovianTexture = true;
  heroTextureCache.set(url, texture);
  return texture;
}

function getHeroGalileanSurfaceMaps(profile) {
  const urls = HERO_GALILEAN_ASSET_URLS[profile.catalogueName];
  if (!urls) return null;
  return {
    albedoMap: loadPersistentHeroTexture(urls.albedo, { color: true }),
    heightMap: loadPersistentHeroTexture(urls.height),
    roughnessMap: loadPersistentHeroTexture(urls.roughness),
  };
}

function getReferenceIrregularSurfaceMaps(profile) {
  const urls = REFERENCE_IRREGULAR_SURFACE_URLS[profile.catalogueName];
  if (!urls) return null;
  return {
    albedoMap: loadPersistentHeroTexture(urls.albedo, { color: true }),
    heightMap: loadPersistentHeroTexture(urls.height),
    roughnessMap: loadPersistentHeroTexture(urls.roughness),
  };
}

/**
 * Returns a photograph-like colour wrap for the selected irregular moon.
 * Height and roughness deliberately remain separate so this texture never
 * behaves like a flat, self-lit picture pasted onto the body.
 */
function getReferenceIrregularAlbedo(profile) {
  const url = REFERENCE_IRREGULAR_ALBEDO_URLS[profile.catalogueName]
    ?? COLLAGE_REFERENCE_ALBEDO_URLS[profile.catalogueName];
  return url ? loadPersistentHeroTexture(url, { color: true }) : null;
}


const PROCEDURAL_REALISM_MOON_TEXTURES = new Set([
  "Metis",
  "Adrastea",
  "Amalthea",
  "Thebe",
  "Himalia",
  "Elara",
  "Pasiphae",
  "Sinope",
  "Lysithea",
  "Carme",
  "Ananke",
  "Leda",
  "Themisto",
  "Magaclite",
  "Chaldene",
  "Harpalyke",
  "Kalyke",
  "Iocaste",
  "Erinome",
  "Isonoe",
  "Praxidike",
  "Autonoe",
  "Hermippe",
  "Aitne",
  "Eurydome",
  "Euanthe",
  "Euporie",
  "Orthosie",
  "Sponde",
  "Kale",
  "Mneme",
  "Aoede",
  "Thelxinoe",
  "Carpo",
  "Eukelade",
  "Hegemone",
  "Dia",
  "Cyllene",
  "Kallichore",
  "S2010_J_2",
  "S2010_J_1",
  "Valetudo",
]);

const proceduralMoonSurfaceCache = new Map();

function createConfiguredDataTexture(pixels, width, height, name, { color = false } = {}) {
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.name = name;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.userData.persistentJovianTexture = true;
  return texture;
}

function nonGalileanTextureWidth(profile, quality = "high") {
  if (profile.family === "Inner regular moon") {
    return quality === "low" ? 160 : quality === "medium" ? 224 : 320;
  }
  if (["Himalia", "Elara", "Pasiphae", "Sinope", "Carme", "Ananke"].includes(profile.catalogueName)) {
    return quality === "low" ? 128 : quality === "medium" ? 192 : 256;
  }
  return quality === "low" ? 96 : quality === "medium" ? 128 : 160;
}

function craterTextureLight(sample) {
  const floor = sample.floor * 0.95;
  const rim = sample.rim * 0.80;
  const ejecta = sample.ejecta * 0.55;
  return { floor, rim, ejecta };
}

function getProceduralRealismSurfaceMaps(profile, settings, quality = "high") {
  if (HERO_GALILEAN_TEXTURES.has(profile.catalogueName)) return null;
  const prioritizeNamedRealism = PROCEDURAL_REALISM_MOON_TEXTURES.has(profile.catalogueName);

  const cacheKey = `${profile.catalogueName}:${quality}`;
  if (proceduralMoonSurfaceCache.has(cacheKey)) return proceduralMoonSurfaceCache.get(cacheKey);

  const width = prioritizeNamedRealism
    ? Math.max(nonGalileanTextureWidth(profile, quality), profile.family === "Inner regular moon" ? 256 : 192)
    : nonGalileanTextureWidth(profile, quality);
  const height = Math.max(32, Math.floor(width / 2));
  const colorPixels = new Uint8Array(width * height * 4);
  const heightPixels = new Uint8Array(width * height * 4);
  const roughPixels = new Uint8Array(width * height * 4);

  const palette = createMeasuredOpticalPalette(profile);
  const baseColour = new THREE.Color(palette.base);
  const lightColour = new THREE.Color(palette.light);
  const darkColour = new THREE.Color(palette.dark);
  const accentColour = new THREE.Color(palette.accent);
  const sulfurDust = new THREE.Color(0xcfb698);
  const ironGrey = new THREE.Color(0x74726f);
  const rustyGrey = new THREE.Color(0x70625a);
  const dustyIvory = new THREE.Color(0xcfc4b4);
  const innerRed = new THREE.Color(0x9f5a47);
  const referenceStyle = REFERENCE_VISUAL_STYLES[profile.catalogueName] ?? null;
  const referenceRift = referenceStyle?.rift
    ? new THREE.Color(referenceStyle.rift)
    : null;
  const colour = new THREE.Color();
  const direction = new THREE.Vector3();

  const craterField = makeCraterField(profile, settings);
  const mountains = makeMountainField(profile, settings);
  const patches = makePatchField(profile, settings);
  const ioLikePatches = profile.catalogueName === "Amalthea" ? [
    CALLOUT_DIRECTIONS.amaltheaPatchA,
    CALLOUT_DIRECTIONS.amaltheaPatchB,
  ] : [];

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const phi = u * Math.PI * 2 - Math.PI;
      direction.set(
        Math.cos(phi) * sinTheta,
        cosTheta,
        Math.sin(phi) * sinTheta,
      );

      const broad = fbm3(direction, 1.7, 4, profile.seed + 11) * settings.broadRelief;
      const rocky = fbm3(direction, 6.9, 4, profile.seed + 59) * settings.rockRelief;
      const fine = fbm3(direction, 23.0, 3, profile.seed + 131) * settings.fineRelief;
      const colourNoise = fbm3(direction, 8.0, 4, profile.seed + 173) * 0.5 + 0.5;
      const macroMottle = fbm3(direction, 2.9, 3, profile.seed + 239) * 0.5 + 0.5;
      const secondaryMottle = fbm3(direction, 12.4, 3, profile.seed + 1309) * 0.5 + 0.5;
      const facetMottle = fbm3(direction, 17.0, 2, profile.seed + 739) * 0.5 + 0.5;
      const morphology = morphologyWarp(direction, profile, settings);

      let craterFloor = 0;
      let craterRim = 0;
      let craterEjecta = 0;
      let craterHeight = 0;
      craterField.forEach((crater) => {
        const sample = sampleCrater(direction, crater);
        const lit = craterTextureLight(sample);
        craterFloor = Math.max(craterFloor, lit.floor);
        craterRim = Math.max(craterRim, lit.rim);
        craterEjecta = Math.max(craterEjecta, lit.ejecta);
        craterHeight += sample.height * 0.82;
      });

      let mountainMask = 0;
      mountains.forEach((mountain) => {
        mountainMask += sampleMountain(direction, mountain) * 0.82;
      });

      const patchMask = samplePatchField(direction, patches);
      let brightPatch = 0;
      ioLikePatches.forEach((patchDirection) => {
        brightPatch = Math.max(brightPatch, sampleSpot(direction, patchDirection, 0.16));
      });

      let relief = 0.50
        + broad * 10.5
        + rocky * 14.0
        + fine * 6.4
        + craterHeight * 10.0
        + mountainMask * 10.0
        + patchMask * 0.055
        + morphology * 0.80;

      colour.copy(baseColour)
        .lerp(lightColour, THREE.MathUtils.clamp(colourNoise * settings.colourContrast * 0.82, 0, 0.72))
        .lerp(darkColour, THREE.MathUtils.clamp((1 - macroMottle) * 0.24 + craterFloor * 0.18, 0, 0.48));
      colour.lerp(lightColour, craterRim * 0.26 + craterEjecta * 0.12);

      if (referenceStyle) {
        // Layer broad mineral provinces, smaller stains and fine speckling to
        // reproduce the supplied visual reference without flattening the mesh
        // into a single painted colour.
        const broadPatch = smoothstep(0.40, 0.82, macroMottle);
        const mineralPatch = smoothstep(0.53, 0.90, secondaryMottle);
        const darkStain = smoothstep(0.56, 0.91, 1 - colourNoise);
        const brightGrain = smoothstep(0.72, 0.975, facetMottle);
        colour.copy(baseColour)
          .lerp(accentColour, broadPatch * referenceStyle.accentPatch)
          .lerp(lightColour, mineralPatch * referenceStyle.lightPatch)
          .lerp(
            darkColour,
            darkStain * referenceStyle.darkPatch + craterFloor * 0.20,
          )
          .lerp(
            lightColour,
            brightGrain * referenceStyle.fineSpeckle
              + craterRim * 0.16
              + craterEjecta * 0.08,
          );

        if (referenceRift) {
          const wanderingRift = direction.y
            + fbm3(direction, 4.8, 3, profile.seed + 1889) * 0.085;
          const riftMask = Math.exp(-Math.pow(wanderingRift / 0.046, 2));
          colour.lerp(referenceRift, riftMask * referenceStyle.riftStrength);
          relief -= riftMask * 0.024;
        }
      } else if (profile.catalogueName === "Amalthea") {
        colour.copy(new THREE.Color(0x7c4639))
          .lerp(innerRed, smoothstep(0.18, 0.72, macroMottle) * 0.34)
          .lerp(sulfurDust, brightPatch * 0.54)
          .lerp(lightColour, craterRim * 0.20)
          .lerp(darkColour, craterFloor * 0.18 + patchMask * 0.08);
        relief += brightPatch * 0.035;
      } else if (profile.catalogueName === "Thebe") {
        colour.copy(new THREE.Color(0x653931))
          .lerp(innerRed, smoothstep(0.24, 0.76, colourNoise) * 0.24)
          .lerp(lightColour, craterRim * 0.18)
          .lerp(darkColour, craterFloor * 0.22 + secondaryMottle * 0.08);
      } else if (["Metis", "Adrastea"].includes(profile.catalogueName)) {
        const shardField = smoothstep(0.54, 0.92, facetMottle);
        colour.copy(new THREE.Color(0x40302b))
          .lerp(rustyGrey, smoothstep(0.28, 0.72, colourNoise) * 0.22)
          .lerp(lightColour, shardField * 0.08)
          .lerp(darkColour, smoothstep(0.62, 0.95, 1 - facetMottle) * 0.18);
        relief += shardField * 0.018;
      } else if (profile.family === "Himalia family") {
        const dustyPatch = smoothstep(0.52, 0.92, secondaryMottle) * 0.18;
        colour.copy(ironGrey)
          .lerp(baseColour, 0.54)
          .lerp(dustyIvory, craterEjecta * 0.14 + dustyPatch)
          .lerp(darkColour, craterFloor * 0.24 + patchMask * 0.10);
      } else if (profile.family === "Carme family") {
        colour.copy(baseColour)
          .lerp(accentColour, smoothstep(0.34, 0.80, colourNoise) * 0.24)
          .lerp(lightColour, craterRim * 0.12)
          .lerp(darkColour, craterFloor * 0.18);
      } else if (profile.family === "Ananke family") {
        colour.copy(rustyGrey)
          .lerp(baseColour, 0.46)
          .lerp(lightColour, craterEjecta * 0.12)
          .lerp(darkColour, craterFloor * 0.20 + smoothstep(0.65, 0.92, 1 - macroMottle) * 0.12);
      } else if (profile.family === "Pasiphae family") {
        colour.copy(baseColour)
          .lerp(ironGrey, smoothstep(0.20, 0.62, colourNoise) * 0.18)
          .lerp(accentColour, smoothstep(0.60, 0.96, secondaryMottle) * 0.10)
          .lerp(darkColour, craterFloor * 0.20);
      } else if (profile.family === "Themisto group" || profile.family === "Carpo group" || profile.family === "Valetudo group") {
        colour.copy(baseColour)
          .lerp(lightColour, smoothstep(0.46, 0.90, colourNoise) * 0.16 + craterEjecta * 0.08)
          .lerp(darkColour, craterFloor * 0.18 + smoothstep(0.72, 0.96, 1 - macroMottle) * 0.14);
      }

      // Preserve a natural small-body look by favouring irregular mottling over
      // clean circular rings. Crater rims remain subtle and ejecta is dusty.
      colour.lerp(lightColour, smoothstep(0.82, 0.98, facetMottle) * 0.08);
      colour.lerp(darkColour, smoothstep(0.84, 0.99, 1 - facetMottle) * 0.10);

      let roughness = THREE.MathUtils.clamp(settings.roughness, 0.70, 1.0);
      roughness += craterFloor * 0.06;
      roughness -= craterEjecta * 0.03;
      roughness -= brightPatch * 0.05;
      if (profile.catalogueName === "Europa") roughness = 0.7; // never reached, just guard
      const rough = Math.round(THREE.MathUtils.clamp(roughness, 0, 1) * 255);
      const h = Math.round(THREE.MathUtils.clamp(relief, 0, 1) * 255);
      const offset = (y * width + x) * 4;

      colorPixels[offset] = Math.round(THREE.MathUtils.clamp(colour.r, 0, 1) * 255);
      colorPixels[offset + 1] = Math.round(THREE.MathUtils.clamp(colour.g, 0, 1) * 255);
      colorPixels[offset + 2] = Math.round(THREE.MathUtils.clamp(colour.b, 0, 1) * 255);
      colorPixels[offset + 3] = 255;
      heightPixels[offset] = h;
      heightPixels[offset + 1] = h;
      heightPixels[offset + 2] = h;
      heightPixels[offset + 3] = 255;
      roughPixels[offset] = rough;
      roughPixels[offset + 1] = rough;
      roughPixels[offset + 2] = rough;
      roughPixels[offset + 3] = 255;
    }
  }

  const maps = {
    albedoMap: createConfiguredDataTexture(
      colorPixels,
      width,
      height,
      `${profile.name} procedural realism albedo`,
      { color: true },
    ),
    heightMap: createConfiguredDataTexture(
      heightPixels,
      width,
      height,
      `${profile.name} procedural realism height`,
    ),
    roughnessMap: createConfiguredDataTexture(
      roughPixels,
      width,
      height,
      `${profile.name} procedural realism roughness`,
    ),
  };
  proceduralMoonSurfaceCache.set(cacheKey, maps);
  return maps;
}

function createJovianMaterial(profile, settings, palette, quality = "high", mode = "preview") {
  const inspection = mode === "inspection";
  const heroMaps = getHeroGalileanSurfaceMaps(profile);
  const referenceSurfaceMaps = heroMaps ? null : getReferenceIrregularSurfaceMaps(profile);
  const proceduralMaps = heroMaps || referenceSurfaceMaps
    ? null
    : getProceduralRealismSurfaceMaps(profile, settings, quality);
  const activeMaps = heroMaps ?? referenceSurfaceMaps ?? proceduralMaps;
  const referenceAlbedoMap = heroMaps || referenceSurfaceMaps
    ? null
    : getReferenceIrregularAlbedo(profile);
  const albedoMap = referenceAlbedoMap ?? activeMaps?.albedoMap ?? null;
  const heroSettings = HERO_GALILEAN_MATERIAL[profile.catalogueName] ?? null;
  const referenceSettings = REFERENCE_IRREGULAR_MATERIAL[profile.catalogueName] ?? null;
  const mappedSurfaceSettings = heroSettings ?? referenceSettings;
  const reliefMap = activeMaps?.heightMap
    ?? (inspection ? createInspectionBumpTexture(profile, settings, quality) : null);

  const usesMappedSurface = Boolean(albedoMap || activeMaps);
  const usesRebuiltIrregularRelief = profile.catalogueName === "Themisto"
    || profile.catalogueName === "Magaclite";
  const common = {
    color: 0xffffff,
    map: albedoMap,
    vertexColors: !usesMappedSurface,
    roughness: mappedSurfaceSettings?.roughness
      ?? THREE.MathUtils.clamp(settings.roughness, 0.45, 1),
    roughnessMap: activeMaps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: mappedSurfaceSettings?.envMapIntensity
      ?? (proceduralMaps ? Math.max(settings.envMapIntensity, 0.022) : settings.envMapIntensity),
    flatShading: usesMappedSurface ? false : settings.flatShading,
    dithering: true,
    emissive: usesMappedSurface
      ? new THREE.Color(0x000000)
      : new THREE.Color(palette.dark).multiplyScalar(0.12),
    emissiveIntensity: usesMappedSurface ? 0 : settings.emissiveIntensity,
    bumpMap: reliefMap,
    bumpScale: mappedSurfaceSettings
      ? (inspection
        ? mappedSurfaceSettings.inspectionBumpScale
        : mappedSurfaceSettings.previewBumpScale)
      : proceduralMaps
        ? (inspection
          ? (profile.family === "Inner regular moon"
            ? 0.060
            : usesRebuiltIrregularRelief
              ? 0.054
              : 0.038)
          : (profile.family === "Inner regular moon"
            ? 0.020
            : usesRebuiltIrregularRelief
              ? 0.018
              : 0.012))
        : inspection
          ? (profile.family === "Galilean moon" ? 0.052 : profile.family === "Inner regular moon" ? 0.095 : 0.120)
          : 0,
    displacementMap: inspection ? reliefMap : null,
    displacementScale: inspection
      ? (mappedSurfaceSettings?.displacementScale
        ?? (proceduralMaps
          ? (profile.family === "Inner regular moon"
            ? 0.020
            : usesRebuiltIrregularRelief
              ? 0.016
              : 0.010)
          : (profile.family === "Galilean moon" ? 0.010 : profile.family === "Inner regular moon" ? 0.045 : 0.056)))
      : 0,
    displacementBias: inspection
      ? (mappedSurfaceSettings?.displacementBias
        ?? (proceduralMaps
          ? (profile.family === "Inner regular moon"
            ? -0.010
            : usesRebuiltIrregularRelief
              ? -0.008
              : -0.005)
          : (profile.family === "Galilean moon" ? -0.005 : profile.family === "Inner regular moon" ? -0.0225 : -0.028)))
      : 0,
  };

  const physicalClearcoat = profile.catalogueName === "Europa"
    ? Math.min(settings.clearcoat, 0.10)
    : 0;
  const material = physicalClearcoat > 0
    ? new THREE.MeshPhysicalMaterial({
      ...common,
      clearcoat: physicalClearcoat,
      clearcoatRoughness: Math.max(0.72, settings.clearcoatRoughness),
      reflectivity: 0.10,
    })
    : new THREE.MeshStandardMaterial(common);

  material.name = heroMaps
    ? `${profile.name} spacecraft mosaic material`
    : referenceSurfaceMaps
      ? `${profile.name} image-derived reference surface material`
      : referenceAlbedoMap
        ? `${profile.name} reference-wrapped 3D material`
        : proceduralMaps
          ? `${profile.name} realism surface material`
          : `${profile.name} evidence-tiered moon material`;
  material.userData = {
    surfaceEvidence: profile.surfaceEvidence,
    albedo: profile.albedo ?? null,
    roughness: common.roughness,
    usesSpacecraftMosaic: Boolean(heroMaps),
    usesReferenceSurfaceSet: Boolean(referenceSurfaceMaps),
    usesReferenceAlbedo: Boolean(referenceAlbedoMap),
    usesProceduralRealismMaps: Boolean(proceduralMaps),
  };
  return material;
}

/**
 * Returns one unique physical 3D moon mesh. Orbit placement, cinematic scale,
 * focus metadata and interaction targets remain in satelliteSystem.js.
 */
export function createJovianMoonSurface(profile, quality = "high") {
  const { geometry, settings, palette } = createJovianGeometry(profile, quality, "preview");
  const material = createJovianMaterial(profile, settings, palette, quality, "preview");
  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = profile.surfaceEvidence;
  moon.userData.surfaceStructure = profile.surfaceStructure;
  moon.userData.surfaceRoughness = settings.roughness;
  moon.userData.surfaceDetailMode = "preview-3d";
  moon.userData.jovianSurfaceState = {
    profile,
    quality,
    mode: "preview",
    previewGeometry: geometry,
    previewMaterial: material,
    inspectionGeometry: null,
    inspectionMaterial: null,
  };
  return moon;
}

function disposeInspectionResources(state) {
  state.inspectionGeometry?.dispose?.();
  if (state.inspectionMaterial) {
    const textures = new Set([
      state.inspectionMaterial.map,
      state.inspectionMaterial.bumpMap,
      state.inspectionMaterial.roughnessMap,
      state.inspectionMaterial.displacementMap,
    ]);
    textures.forEach((texture) => {
      if (!texture?.userData?.persistentJovianTexture) texture?.dispose?.();
    });
    state.inspectionMaterial.dispose?.();
  }
  state.inspectionGeometry = null;
  state.inspectionMaterial = null;
}

/**
 * Promotes only the selected Jovian moon to its dense, Moon-style inspection
 * surface. All other satellites remain lightweight preview meshes, which is
 * the central performance fix for Jupiter's 115-body system.
 */
export function setJovianMoonInspectionDetail(moon, active) {
  const state = moon?.userData?.jovianSurfaceState;
  if (!state) return;

  if (active) {
    if (state.mode === "inspection") return;
    const detailed = createJovianGeometry(state.profile, state.quality, "inspection");
    state.inspectionGeometry = detailed.geometry;
    state.inspectionMaterial = createJovianMaterial(
      state.profile,
      detailed.settings,
      detailed.palette,
      state.quality,
      "inspection",
    );
    moon.geometry = state.inspectionGeometry;
    moon.material = state.inspectionMaterial;
    moon.layers.enable(JOVIAN_MOON_INSPECTION_LAYER);
    moon.userData.surfaceRoughness = detailed.settings.roughness;
    moon.userData.surfaceDetailMode = "inspection-3d";
    state.mode = "inspection";
    return;
  }

  if (state.mode !== "inspection") return;
  moon.geometry = state.previewGeometry;
  moon.material = state.previewMaterial;
  moon.layers.disable(JOVIAN_MOON_INSPECTION_LAYER);
  moon.userData.surfaceDetailMode = "preview-3d";
  state.mode = "preview";
  disposeInspectionResources(state);
}

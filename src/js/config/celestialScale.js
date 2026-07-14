/**
 * Scientific size metadata and the cinematic scale used by Beyond Earth.
 *
 * The real Solar System cannot be rendered at one literal scale while keeping
 * planets clickable and their orbits readable. We therefore preserve the real
 * ordering and ratios, then compress the extremes with category-specific power
 * curves. Scientific diameters/volumes remain available to the UI.
 */

export const EARTH_DIAMETER_KM = 12_756;
export const EARTH_VISUAL_RADIUS = 0.90;
export const SOLAR_ORBIT_SCALE = 10.5;


export const HELIOCENTRIC_ORBIT_AU = Object.freeze({
  Mercury: 0.3871,
  Venus: 0.7233,
  Earth: 1.0,
  Mars: 1.5237,
  Jupiter: 5.2029,
  Saturn: 9.5367,
  Uranus: 19.1892,
  Neptune: 30.0699,
});

export const BODY_SIZE_DATA = Object.freeze({
  Sun: { diameterKm: 1_392_700, diameterEarths: 109.18, volumeEarths: 1_300_000 },
  Mercury: { diameterKm: 4_879, diameterEarths: 0.3825, volumeEarths: 0.056 },
  Venus: { diameterKm: 12_104, diameterEarths: 0.9489, volumeEarths: 0.857 },
  Earth: { diameterKm: EARTH_DIAMETER_KM, diameterEarths: 1, volumeEarths: 1 },
  Mars: { diameterKm: 6_779, diameterEarths: 0.5314, volumeEarths: 0.151 },
  Jupiter: { diameterKm: 139_820, diameterEarths: 10.96, volumeEarths: 1_321 },
  Saturn: { diameterKm: 116_460, diameterEarths: 9.13, volumeEarths: 764 },
  Uranus: { diameterKm: 50_724, diameterEarths: 3.98, volumeEarths: 63.1 },
  Neptune: { diameterKm: 49_244, diameterEarths: 3.86, volumeEarths: 57.7 },
});

function compressedPlanetRadius(diameterEarths) {
  // Preserve a much stronger visible hierarchy than the earlier compressed
  // curve. The scale remains cinematic rather than literal, but Jupiter now
  // reads as roughly eight rendered Earth radii and the ice giants as roughly
  // three, while Mercury and Mars remain visibly smaller than Earth.
  const exponent = diameterEarths <= 1 ? 0.90 : 0.88;
  return EARTH_VISUAL_RADIUS * Math.pow(diameterEarths, exponent);
}

export const PLANET_SCALE_PROFILES = Object.freeze({
  Mercury: {
    ...BODY_SIZE_DATA.Mercury,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Mercury.diameterEarths),
    orbitRadius: 14 * SOLAR_ORBIT_SCALE,
    focusDistance: 1.75,
  },
  Venus: {
    ...BODY_SIZE_DATA.Venus,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Venus.diameterEarths),
    orbitRadius: 21 * SOLAR_ORBIT_SCALE,
    focusDistance: 3.55,
  },
  Earth: {
    ...BODY_SIZE_DATA.Earth,
    visualRadius: EARTH_VISUAL_RADIUS,
    orbitRadius: 29 * SOLAR_ORBIT_SCALE,
    focusDistance: 3.75,
  },
  Mars: {
    ...BODY_SIZE_DATA.Mars,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Mars.diameterEarths),
    orbitRadius: 40 * SOLAR_ORBIT_SCALE,
    focusDistance: 2.20,
  },
  Jupiter: {
    ...BODY_SIZE_DATA.Jupiter,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Jupiter.diameterEarths),
    orbitRadius: 75 * SOLAR_ORBIT_SCALE,
    focusDistance: 27.5,
  },
  Saturn: {
    ...BODY_SIZE_DATA.Saturn,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Saturn.diameterEarths),
    orbitRadius: 108 * SOLAR_ORBIT_SCALE,
    focusDistance: 31.5,
  },
  Uranus: {
    ...BODY_SIZE_DATA.Uranus,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Uranus.diameterEarths),
    orbitRadius: 145 * SOLAR_ORBIT_SCALE,
    focusDistance: 13.4,
  },
  Neptune: {
    ...BODY_SIZE_DATA.Neptune,
    visualRadius: compressedPlanetRadius(BODY_SIZE_DATA.Neptune.diameterEarths),
    orbitRadius: 178 * SOLAR_ORBIT_SCALE,
    focusDistance: 13.0,
  },
  Sun: {
    ...BODY_SIZE_DATA.Sun,
    // The free-flight view uses a deliberately massive cinematic Sun. During
    // focused inspection, main.js reduces its apparent angular size according
    // to the selected body's real heliocentric distance.
    visualRadius: 92,
    focusDistance: 184,
  },
});

function formatRatio(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} million`;
  if (value >= 1_000) return Math.round(value).toLocaleString("en-US");
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  if (value >= 1) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  if (value < 0.00001) return "<0.001%";
  return `${(value * 100).toFixed(value < 0.01 ? 3 : 1).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function getSizeComparisonText({ diameterKm, volumeEarths = null, name = "This body" }) {
  const numericDiameter = Number(diameterKm);
  if (!Number.isFinite(numericDiameter) || numericDiameter <= 0) return "Scale comparison unavailable";

  const diameterEarths = numericDiameter / EARTH_DIAMETER_KM;
  const estimatedVolumeEarths = Number.isFinite(volumeEarths)
    ? Number(volumeEarths)
    : Math.pow(diameterEarths, 3);

  const widthText = diameterEarths >= 1
    ? `${formatRatio(diameterEarths)}× Earth's diameter`
    : `${formatRatio(diameterEarths)} of Earth's diameter`;

  const volumeText = Math.abs(estimatedVolumeEarths - 1) < 0.005
    ? "1 Earth by volume"
    : estimatedVolumeEarths >= 1
      ? `≈ ${formatRatio(estimatedVolumeEarths)} Earths by volume`
      : `≈ ${formatRatio(estimatedVolumeEarths)} of Earth's volume`;

  return `${widthText} · ${volumeText}`;
}

export function getPlanetSizeComparison(name) {
  const data = BODY_SIZE_DATA[name];
  return data ? getSizeComparisonText({ ...data, name }) : "Scale comparison unavailable";
}

/**
 * Major moons remain relative to Earth but use a minimum readable size so tiny
 * moons can still be clicked and inspected.
 */
export function getMoonVisualRadius(diameterKm, { minimum = 0.045, maximum = 0.68 } = {}) {
  const ratio = Math.max(0, Number(diameterKm) / EARTH_DIAMETER_KM);
  return Math.min(maximum, Math.max(minimum, EARTH_VISUAL_RADIUS * Math.pow(ratio, 0.76)));
}

/**
 * Asteroids span metres to hundreds of kilometres. A compressed curve preserves
 * Ceres > Vesta > ordinary rocks while keeping small bodies minimally visible.
 */
export function getAsteroidVisualRadius(diameterKm, { minimum = 0.020, maximum = 0.78 } = {}) {
  const diameter = Math.max(0, Number(diameterKm));
  if (!Number.isFinite(diameter) || diameter <= 0) return minimum;

  // Small rocks use a readable power curve; large named bodies use a near-
  // linear continuation. This preserves Ceres > Vesta/Pallas > Hygiea > Psyche
  // while keeping ordinary kilometre-scale rocks visible and clickable.
  const visualRadius = diameter >= 200
    ? 0.16 + diameter * 0.00060
    : 0.018 + 0.21 * Math.pow(diameter / 200, 0.55);

  return Math.min(maximum, Math.max(minimum, visualRadius));
}

export function parseDiameterKm(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const matches = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  const numbers = matches.slice(0, 2).map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
}

export function scaleSolarOrbit(sceneRadius) {
  return sceneRadius * SOLAR_ORBIT_SCALE;
}

import * as THREE from "three";
import { SOLAR_ORBIT_SCALE } from "../config/celestialScale.js";

/**
 * Earth-referenced distance helpers for the journey HUD and celestial focus.
 *
 * Scientific references used by this module:
 * - The astronomical unit is exactly 149,597,870.7 km.
 * - Planetary semi-major axes use JPL's approximate-position element table.
 * - The Moon uses NASA's average Earth–Moon distance of 384,400 km.
 *
 * The planets in Beyond Earth intentionally use compressed visual orbit radii.
 * Consequently, focused-planet distances are calculated by combining the real
 * semi-major axes below with the angular arrangement currently shown in the
 * Three.js scene. They are scientifically scaled values consistent with this
 * simulation, not a live JPL Horizons ephemeris for today's real sky.
 */

export const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
export const LIGHT_YEAR_KM = 9_460_730_472_580.8;
export const LIGHT_MINUTE_KM = 17_987_547.48;
export const KM_TO_MILES = 0.6213711922;
export const AVERAGE_MOON_DISTANCE_KM = 384_400;

const PLANET_ORBITAL_ELEMENTS = Object.freeze({
  mercury: { semiMajorAxisAU: 0.38709927, eccentricity: 0.20563593 },
  venus: { semiMajorAxisAU: 0.72333566, eccentricity: 0.00677672 },
  earth: { semiMajorAxisAU: 1.00000261, eccentricity: 0.01671123 },
  mars: { semiMajorAxisAU: 1.52371034, eccentricity: 0.09339410 },
  jupiter: { semiMajorAxisAU: 5.202887, eccentricity: 0.04838624 },
  saturn: { semiMajorAxisAU: 9.53667594, eccentricity: 0.05386179 },
  uranus: { semiMajorAxisAU: 19.18916464, eccentricity: 0.04725744 },
  neptune: { semiMajorAxisAU: 30.06992276, eccentricity: 0.00859048 },
  pluto: { semiMajorAxisAU: 39.482, eccentricity: 0.2488 },
});


const NAMED_SMALL_BODY_ELEMENTS = Object.freeze({
  ceres: { semiMajorAxisAU: 2.7675, eccentricity: 0.0758, source: "jpl-small-body" },
  vesta: { semiMajorAxisAU: 2.3613, eccentricity: 0.0887, source: "jpl-small-body" },
  pallas: { semiMajorAxisAU: 2.7700, eccentricity: 0.2300, source: "jpl-small-body" },
  hygiea: { semiMajorAxisAU: 3.1415, eccentricity: 0.1125, source: "jpl-small-body" },
  psyche: { semiMajorAxisAU: 2.9225, eccentricity: 0.1339, source: "jpl-small-body" },
});

const CAMERA_DISTANCE_STOPS = Object.freeze([
  // The opening camera sits about 2.84 Earth radii above the surface in the
  // project's scale, corresponding to roughly 18,100 km of altitude.
  { progress: 0.000, kilometres: 18_100, region: "Earth orbital vicinity" },
  { progress: 0.055, kilometres: AVERAGE_MOON_DISTANCE_KM, region: "Lunar neighbourhood" },
  { progress: 0.150, kilometres: 5_000_000, region: "Near-Earth deep space" },
  { progress: 0.285, kilometres: 40_000_000, region: "Inner Solar System" },
  { progress: 0.430, kilometres: ASTRONOMICAL_UNIT_KM, region: "Interplanetary space" },
  { progress: 0.570, kilometres: ASTRONOMICAL_UNIT_KM * 5.2, region: "Giant-planet region" },
  { progress: 0.700, kilometres: ASTRONOMICAL_UNIT_KM * 20, region: "Outer Solar System" },
  { progress: 0.820, kilometres: ASTRONOMICAL_UNIT_KM * 50, region: "Kuiper frontier" },
  { progress: 0.900, kilometres: ASTRONOMICAL_UNIT_KM * 120, region: "Heliospheric frontier" },
  { progress: 0.955, kilometres: ASTRONOMICAL_UNIT_KM * 1_000, region: "Interstellar approach" },
  { progress: 0.985, kilometres: LIGHT_YEAR_KM * 0.60, region: "Interstellar space" },
  /*
   * Twenty light-years, not six.
   *
   * The far end of the scroll is where the whole Solar System has to fit in
   * one frame, and the system got much bigger when the trans-Neptunian worlds
   * were added -- Sedna's orbit alone is nearly half again the width of
   * Pluto's. Six light-years was framed for a system that stopped at Pluto;
   * ten is framed for one that does not, and still holds Proxima, Alpha
   * Centauri, Barnard's Star and Sirius inside the same shot.
   */
  { progress: 1.000, kilometres: LIGHT_YEAR_KM * 10.0, region: "Local stellar neighbourhood" },
]);

const wholeNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/** Maps the project's main-belt radius back to the approximate 2.2–3.2 au range. */
function asteroidOrbitRadiusToAU(radius) {
  return THREE.MathUtils.mapLinear(
    THREE.MathUtils.clamp(radius, 44 * SOLAR_ORBIT_SCALE, 52 * SOLAR_ORBIT_SCALE),
    44 * SOLAR_ORBIT_SCALE,
    52 * SOLAR_ORBIT_SCALE,
    2.2,
    3.2,
  );
}

function bodyName(body) {
  return String(body?.userData?.name ?? body?.name ?? "").trim();
}

function normalizedBodyName(body) {
  return bodyName(body).toLowerCase();
}

function resolveOrbitalElements(body) {
  const normalizedName = normalizedBodyName(body);
  const parentPlanet = String(body?.userData?.parentPlanet ?? "").toLowerCase();

  if (parentPlanet && PLANET_ORBITAL_ELEMENTS[parentPlanet]) {
    return { ...PLANET_ORBITAL_ELEMENTS[parentPlanet], source: "satellite-parent-orbit" };
  }

  for (const [planetName, elements] of Object.entries(PLANET_ORBITAL_ELEMENTS)) {
    if (normalizedName.includes(planetName)) return { ...elements, source: "jpl-elements" };
  }

  for (const [smallBodyName, elements] of Object.entries(NAMED_SMALL_BODY_ELEMENTS)) {
    if (normalizedName.includes(smallBodyName)) return { ...elements };
  }

  const explicit = Number(body?.userData?.heliocentricAU);
  const explicitEccentricity = Number(body?.userData?.orbitalEccentricity);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return {
      semiMajorAxisAU: explicit,
      eccentricity: Number.isFinite(explicitEccentricity)
        ? THREE.MathUtils.clamp(explicitEccentricity, 0, 0.99)
        : 0,
      source: "explicit",
    };
  }

  if (body?.userData?.isAsteroid || normalizedName.includes("asteroid")) {
    const orbitRadius = Number(body?.userData?.orbitRadius);
    if (Number.isFinite(orbitRadius)) {
      return {
        semiMajorAxisAU: asteroidOrbitRadiusToAU(orbitRadius),
        eccentricity: Number.isFinite(explicitEccentricity)
          ? THREE.MathUtils.clamp(explicitEccentricity, 0, 0.99)
          : 0.10,
        source: "asteroid-estimate",
      };
    }
  }

  return null;
}

/**
 * Computes an approximate closest/farthest Earth-separation envelope from the
 * planets' perihelion and aphelion distances. The two extrema do not normally
 * occur at the same epoch, so the result is labelled as an orbital range rather
 * than as a live ephemeris.
 */
function calculateApproximateEarthRange(elements) {
  if (!elements) return null;

  const earth = PLANET_ORBITAL_ELEMENTS.earth;
  const earthPerihelion = earth.semiMajorAxisAU * (1 - earth.eccentricity);
  const earthAphelion = earth.semiMajorAxisAU * (1 + earth.eccentricity);
  const bodyPerihelion = elements.semiMajorAxisAU * (1 - elements.eccentricity);
  const bodyAphelion = elements.semiMajorAxisAU * (1 + elements.eccentricity);

  const minimumAU = elements.semiMajorAxisAU >= earth.semiMajorAxisAU
    ? Math.max(0, bodyPerihelion - earthAphelion)
    : Math.max(0, earthPerihelion - bodyAphelion);
  const maximumAU = bodyAphelion + earthAphelion;

  return {
    minimumKilometres: minimumAU * ASTRONOMICAL_UNIT_KM,
    maximumKilometres: maximumAU * ASTRONOMICAL_UNIT_KM,
  };
}

/** Returns the scientific journey region nearest to an Earth distance. */
export function getEarthDistanceRegion(kilometres) {
  const safeKilometres = Math.max(0, Number(kilometres) || 0);

  for (let index = 1; index < CAMERA_DISTANCE_STOPS.length; index += 1) {
    const lower = CAMERA_DISTANCE_STOPS[index - 1];
    const upper = CAMERA_DISTANCE_STOPS[index];
    // The scroll interpolation is logarithmic, so the visual halfway point
    // between two stops is their geometric mean rather than an arithmetic mean.
    const midpoint = Math.sqrt(lower.kilometres * upper.kilometres);
    if (safeKilometres <= midpoint) return lower.region;
  }

  return CAMERA_DISTANCE_STOPS[CAMERA_DISTANCE_STOPS.length - 1].region;
}

/** Smoothly converts scroll journey progress into the camera's Earth distance. */
export function interpolateCameraDistanceFromEarth(progress) {
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
  let lower = CAMERA_DISTANCE_STOPS[0];
  let upper = CAMERA_DISTANCE_STOPS[CAMERA_DISTANCE_STOPS.length - 1];

  for (let index = 1; index < CAMERA_DISTANCE_STOPS.length; index += 1) {
    if (clampedProgress <= CAMERA_DISTANCE_STOPS[index].progress) {
      lower = CAMERA_DISTANCE_STOPS[index - 1];
      upper = CAMERA_DISTANCE_STOPS[index];
      break;
    }
  }

  const segmentLength = Math.max(0.000001, upper.progress - lower.progress);
  const segmentProgress = THREE.MathUtils.clamp(
    (clampedProgress - lower.progress) / segmentLength,
    0,
    1,
  );
  const easedProgress = segmentProgress * segmentProgress * (3 - 2 * segmentProgress);
  const kilometres = Math.exp(THREE.MathUtils.lerp(
    Math.log(Math.max(1, lower.kilometres)),
    Math.log(Math.max(1, upper.kilometres)),
    easedProgress,
  ));

  return {
    kilometres,
    region: segmentProgress < 0.5 ? lower.region : upper.region,
  };
}

function formatLightTravel(kilometres) {
  const lightMinutes = kilometres / LIGHT_MINUTE_KM;
  if (lightMinutes < 120) {
    const value = lightMinutes.toFixed(lightMinutes < 10 ? 1 : 0);
    return { text: `${value} light-min`, value, unit: "light-min" };
  }

  const lightHours = lightMinutes / 60;
  if (lightHours < 72) {
    const value = lightHours.toFixed(lightHours < 10 ? 1 : 0);
    return { text: `${value} light-hours`, value, unit: "light-hours" };
  }

  const lightDays = lightHours / 24;
  const value = lightDays.toFixed(lightDays < 10 ? 1 : 0);
  return { text: `${value} light-days`, value, unit: "light-days" };
}

/** Formats one distance using readable km, au, or light-year units. */
export function formatEarthDistance(kilometres) {
  const safeKilometres = Math.max(0, kilometres);
  const astronomicalUnits = safeKilometres / ASTRONOMICAL_UNIT_KM;
  const lightYears = safeKilometres / LIGHT_YEAR_KM;

  if (safeKilometres < 1_000_000) {
    return {
      primary: `${wholeNumberFormatter.format(safeKilometres)} km`,
      secondary: `${wholeNumberFormatter.format(safeKilometres * KM_TO_MILES)} mi`,
      primaryValue: wholeNumberFormatter.format(safeKilometres),
      primaryUnit: "km",
      secondaryValue: wholeNumberFormatter.format(safeKilometres * KM_TO_MILES),
      secondaryUnit: "mi",
    };
  }

  if (astronomicalUnits < 0.10) {
    const millionKm = safeKilometres / 1_000_000;
    const millionMiles = safeKilometres * KM_TO_MILES / 1_000_000;
    return {
      primary: `${millionKm.toFixed(millionKm < 10 ? 2 : 1)} million km`,
      secondary: `${millionMiles.toFixed(millionMiles < 10 ? 2 : 1)} million mi`,
      primaryValue: millionKm.toFixed(millionKm < 10 ? 2 : 1),
      primaryUnit: "million km",
      secondaryValue: millionMiles.toFixed(millionMiles < 10 ? 2 : 1),
      secondaryUnit: "million mi",
    };
  }

  if (lightYears < 0.01) {
    const primaryValue = astronomicalUnits.toFixed(astronomicalUnits < 10 ? 2 : astronomicalUnits < 100 ? 1 : 0);
    const lightTravel = formatLightTravel(safeKilometres);
    return {
      primary: `${primaryValue} AU`,
      secondary: lightTravel.text,
      primaryValue,
      primaryUnit: "AU",
      secondaryValue: lightTravel.value,
      secondaryUnit: lightTravel.unit,
    };
  }

  const primaryValue = lightYears.toFixed(lightYears < 0.1 ? 3 : lightYears < 1 ? 2 : 1);
  // Once light-years become the primary display, derive AU from that exact
  // displayed light-year value—not from the still-changing unrounded kilometre
  // value. This keeps both labels perfectly synchronized: AU changes at the
  // same instant the visible light-year number changes and is always its direct
  // conversion (1 ly = LIGHT_YEAR_KM / ASTRONOMICAL_UNIT_KM AU).
  const displayedLightYears = Number(primaryValue);
  const displayedAstronomicalUnits = displayedLightYears
    * (LIGHT_YEAR_KM / ASTRONOMICAL_UNIT_KM);
  const secondaryValue = wholeNumberFormatter.format(displayedAstronomicalUnits);
  return {
    primary: `${primaryValue} light-years`,
    secondary: `${secondaryValue} AU`,
    primaryValue,
    primaryUnit: "light-years",
    secondaryValue,
    secondaryUnit: "AU",
  };
}


/** Formats an approximate minimum-to-maximum Earth distance as a compact range. */
export function formatEarthDistanceRange(range) {
  if (!range) return null;
  const minimumAU = range.minimumKilometres / ASTRONOMICAL_UNIT_KM;
  const maximumAU = range.maximumKilometres / ASTRONOMICAL_UNIT_KM;

  if (maximumAU >= 0.10 && maximumAU < 10_000) {
    const digits = maximumAU < 10 ? 2 : 1;
    return `${minimumAU.toFixed(digits)}–${maximumAU.toFixed(digits)} AU`;
  }

  const minimum = formatEarthDistance(range.minimumKilometres).primary;
  const maximum = formatEarthDistance(range.maximumKilometres).primary;
  return `${minimum}–${maximum}`;
}

/**
 * Produces Earth-referenced distances for clicked celestial bodies.
 * Planet values follow the angular positions visible in the current scene while
 * using JPL semi-major axes for the physical scale.
 */
export function createEarthDistanceTracker({ earth, resolvePlanetByName = null }) {
  const earthWorldDirection = new THREE.Vector3();
  const bodyWorldDirection = new THREE.Vector3();
  const earthHeliocentricPosition = new THREE.Vector3();
  const bodyHeliocentricPosition = new THREE.Vector3();
  const parentWorldPosition = new THREE.Vector3();
  const satelliteOffset = new THREE.Vector3();

  function heliocentricPosition(body, orbitalRadiusAU, target) {
    body.getWorldPosition(target);
    if (target.lengthSq() < 1e-10 || orbitalRadiusAU <= 0) return target.set(0, 0, 0);
    return target.normalize().multiplyScalar(orbitalRadiusAU);
  }

  /**
   * Finds the planet a moon belongs to.
   *
   * The first attempt walked up the scene graph, on the assumption that a moon
   * sits inside its planet. It does not: a satellite system is a *sibling* of
   * the planet's mesh, both hanging off an unnamed orbital pivot, so the walk
   * found nothing and every moon fell silently back to the old behaviour --
   * which looked like the fix had not worked, when what had actually happened
   * is that it never ran.
   *
   * So the planet is looked up by name from the list the application already
   * keeps. The graph walk is retained underneath as a fallback, because it
   * costs nothing and would cover a body built outside that list.
   */
  function findParentPlanet(body) {
    const parentName = String(body?.userData?.parentPlanet ?? "");
    if (!parentName) return null;
    const resolved = resolvePlanetByName?.(parentName);
    if (resolved) return resolved;
    let node = body.parent;
    while (node) {
      if (node.userData?.name === parentName && node.userData?.visualRadius) return node;
      node = node.parent;
    }
    return null;
  }

  /**
   * Where a moon actually is, in heliocentric AU.
   *
   * Every moon used to be given its planet's orbital elements verbatim and
   * then projected onto that planet's semi-major axis -- so all ninety-five
   * Jovian moons returned Jupiter's distance from Earth, identical to the
   * kilometre. That is what made the readout look hardcoded: it was not
   * hardcoded, it was the same computation performed on the same numbers
   * ninety-five times.
   *
   * The fix is to put the moon where it is: its planet's position, plus its
   * own offset from that planet. The *direction* of the offset is read live
   * from the scene, so it swings round as the moon orbits, but the *length*
   * comes from the catalogue in real kilometres -- because the scene
   * deliberately compresses satellite orbits and its distances are not to
   * scale.
   *
   * The differences are small next to interplanetary distances and they are
   * real: Io and Callisto are about 1.5 million kilometres apart, which is a
   * visible difference in a readout quoted in kilometres, and the value now
   * changes as a moon rounds its orbit toward Earth and away again.
   */
  function satelliteHeliocentricPosition(body, parentAU, target) {
    const axisKm = Number(body?.userData?.satelliteSemiMajorAxisKm);
    const parent = findParentPlanet(body);
    if (!parent || !Number.isFinite(axisKm) || axisKm <= 0) return null;

    heliocentricPosition(parent, parentAU, target);
    if (target.lengthSq() < 1e-10) return null;

    parent.getWorldPosition(parentWorldPosition);
    body.getWorldPosition(satelliteOffset);
    satelliteOffset.sub(parentWorldPosition);
    if (satelliteOffset.lengthSq() < 1e-12) return target;

    return target.addScaledVector(
      satelliteOffset.normalize(),
      axisKm / ASTRONOMICAL_UNIT_KM,
    );
  }

  function getBodyDistanceFromEarth(body) {
    const name = bodyName(body) || "Celestial body";
    const normalizedName = name.toLowerCase();

    if (normalizedName === "earth" || normalizedName.includes("earth interaction")) {
      return {
        kilometres: 0,
        region: "Earth reference point",
        bodyName: "Earth",
        basis: "reference",
      };
    }

    if (normalizedName.includes("moon")) {
      return {
        kilometres: AVERAGE_MOON_DISTANCE_KM,
        region: "Average Earth–Moon distance",
        bodyName: name,
        basis: "average",
      };
    }

    if (normalizedName.includes("sun")) {
      return {
        kilometres: ASTRONOMICAL_UNIT_KM,
        region: "Average Earth–Sun distance",
        bodyName: name,
        basis: "average",
      };
    }

    const orbitalElements = resolveOrbitalElements(body);
    if (orbitalElements) {
      const earthAU = PLANET_ORBITAL_ELEMENTS.earth.semiMajorAxisAU;
      const bodyAU = orbitalElements.semiMajorAxisAU;
      heliocentricPosition(earth, earthAU, earthWorldDirection);
      earthHeliocentricPosition.copy(earthWorldDirection);

      /*
       * A moon is placed relative to its planet; everything else is placed on
       * its own orbit. Falling back to the planet's own position when the moon
       * has no catalogued axis is deliberate -- it is the old behaviour, and
       * for a moon whose real orbit is unknown it is the honest answer.
       */
      const satellitePosition = orbitalElements.source === "satellite-parent-orbit"
        ? satelliteHeliocentricPosition(body, bodyAU, bodyWorldDirection)
        : null;
      if (!satellitePosition) heliocentricPosition(body, bodyAU, bodyWorldDirection);
      bodyHeliocentricPosition.copy(bodyWorldDirection);

      return {
        kilometres: earthHeliocentricPosition.distanceTo(bodyHeliocentricPosition)
          * ASTRONOMICAL_UNIT_KM,
        region: body?.userData?.isAsteroid
          ? orbitalElements.source === "jpl-small-body"
            ? "Current simulated separation · verified small-body orbit"
            : "Current simulated separation · generated asteroid orbit"
          : orbitalElements.source === "satellite-parent-orbit"
            ? (Number.isFinite(Number(body?.userData?.satelliteSemiMajorAxisKm))
              ? `Current simulated separation · ${body.userData.parentPlanet} plus this moon's own orbit`
              : `Current simulated separation · ${body.userData.parentPlanet} moon system`)
            : "Current simulated Earth separation · planetary orbit",
        bodyName: name,
        basis: orbitalElements.source,
        approximateRange: calculateApproximateEarthRange(orbitalElements),
      };
    }

    // Safe fallback for future satellites or custom bodies that have no physical
    // orbit metadata yet. It preserves a useful numerical readout instead of N/A.
    earth.getWorldPosition(earthWorldDirection);
    body.getWorldPosition(bodyWorldDirection);
    const sceneUnitsFromEarth = earthWorldDirection.distanceTo(bodyWorldDirection);
    const earthOrbitRadius = Math.max(1, Number(earth.userData?.orbitRadius) || 29);

    return {
      kilometres: (sceneUnitsFromEarth / earthOrbitRadius) * ASTRONOMICAL_UNIT_KM,
      region: "Approximate scene-scaled distance from Earth",
      bodyName: name,
      basis: "scene-scale",
    };
  }

  return { getBodyDistanceFromEarth };
}

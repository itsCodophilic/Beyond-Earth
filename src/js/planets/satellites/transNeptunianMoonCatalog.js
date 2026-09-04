import * as THREE from "three";
import { PLANET_SCALE_PROFILES } from "../../config/celestialScale.js";

/**
 * Satellites of the worlds beyond Neptune.
 *
 * Seven moons across six parents. None of them has ever been visited, and all
 * but Vanth and Dysnomia are known only as a point of light whose brightness
 * and orbital period were measured over many nights -- so what is authored here
 * is what is actually established: the orbit, the size, and how dark the
 * surface is. The arrangement of the surface is invented, and has to be.
 *
 * Sedna has no moon. Hubble searched in 2004 down to five hundred times fainter
 * than Sedna itself and found nothing, which is also why Sedna's mass is still
 * unknown -- there is no companion to weigh it with.
 *
 * Two of these are unusual enough to shape how they are drawn:
 *
 *   - **Vanth** is 443 km beside Orcus's 910. That is over half, which makes
 *     Orcus-Vanth a binary in everything but name, like Pluto and Charon.
 *   - **Dysnomia** and **MK 2** are among the darkest surfaces known --
 *     albedo 0.05 and 0.04, charcoal -- while their parents are among the
 *     brightest. Eris reflects 96% of what reaches it and Makemake 82%. A moon
 *     drawn as a small bright ice ball beside them would be wrong by a factor
 *     of twenty.
 */

const RAW = Object.freeze({
  Eris: [
    {
      name: "Dysnomia",
      designation: "(136199) Eris I",
      semiMajorAxisKm: 37_273,
      eccentricity: 0.006,
      inclinationDeg: 78.29,
      nodeDeg: 126.0,
      meanAnomalyDeg: 41.0,
      periodDays: 15.785899,
      diameterKm: 615,
      diameterLabel: "≈ 615 km",
      albedo: 0.05,
      shape: [1.02, 0.99, 0.98],
      colour: 0x4a4644,
      tidallyLocked: true,
      discovered: "2005, Keck Observatory",
      description:
        "Eris's only moon, and one of the darkest surfaces measured anywhere in the Solar System: it reflects about five per cent of the light that reaches it, beside a parent that reflects ninety-six. Large enough at some 615 km to be a dwarf planet in its own right were it orbiting the Sun instead.",
      structure:
        "Dark, largely featureless carbon-rich globe with a nearly polar orbit around Eris and a tidally locked rotation",
    },
  ],
  Haumea: [
    {
      name: "Namaka",
      designation: "(136108) Haumea II",
      semiMajorAxisKm: 25_657,
      eccentricity: 0.249,
      inclinationDeg: 13.41,
      nodeDeg: 205.0,
      meanAnomalyDeg: 178.0,
      periodDays: 18.28,
      diameterKm: 170,
      diameterLabel: "≈ 170 km",
      albedo: 0.6,
      shape: [1.16, 0.94, 0.9],
      colour: 0xd9dee4,
      tidallyLocked: false,
      discovered: "2005, Keck Observatory",
      description:
        "The inner and smaller of Haumea's two moons, on a markedly eccentric orbit that Hi'iaka keeps stirring: its elements are not constant from one orbit to the next, which is unusual enough that the system is modelled rather than tabulated.",
      structure:
        "Small elongated water-ice fragment, almost certainly a shard of the same collision that spun Haumea into an ellipsoid",
    },
    {
      name: "Hi'iaka",
      designation: "(136108) Haumea I",
      semiMajorAxisKm: 49_500,
      eccentricity: 0.0002,
      inclinationDeg: 0.2,
      nodeDeg: 206.0,
      meanAnomalyDeg: 52.0,
      periodDays: 49.12,
      diameterKm: 310,
      diameterLabel: "≈ 310 km",
      albedo: 0.66,
      shape: [1.08, 0.97, 0.95],
      colour: 0xe4e9ee,
      tidallyLocked: false,
      discovered: "2005, Keck Observatory",
      description:
        "Haumea's larger moon, and a rarity: its surface is almost pure crystalline water ice, more so than nearly anything else known out here. That is the strongest evidence that the whole Haumea family are fragments of one shattered icy mantle.",
      structure:
        "Bright, nearly pure water-ice body with a fresh crystalline surface and very little of the reddening that coats most of its neighbours",
    },
  ],
  Orcus: [
    {
      name: "Vanth",
      designation: "(90482) Orcus I",
      semiMajorAxisKm: 9_030,
      eccentricity: 0.007,
      inclinationDeg: 90.54,
      nodeDeg: 53.0,
      meanAnomalyDeg: 267.0,
      periodDays: 9.539,
      diameterKm: 443,
      diameterLabel: "443 ± 10 km",
      albedo: 0.08,
      shape: [1.01, 1.0, 0.99],
      colour: 0x6b5148,
      tidallyLocked: true,
      discovered: "2005, Hubble Space Telescope",
      description:
        "Half the diameter of Orcus itself, which makes this a binary rather than a moon and a planet. Vanth is also the redder and far darker of the two -- Orcus is bright water ice, Vanth reflects about eight per cent -- so the pair almost certainly did not form from the same material in the same place.",
      structure:
        "Dark red-brown body on a near-perfectly polar orbit, tidally locked, and large enough that the two bodies orbit a barycentre outside Orcus's surface",
    },
  ],
  Quaoar: [
    {
      name: "Weywot",
      designation: "(50000) Quaoar I",
      semiMajorAxisKm: 13_300,
      eccentricity: 0.011,
      inclinationDeg: 4.8,
      nodeDeg: 341.0,
      meanAnomalyDeg: 118.0,
      periodDays: 12.438,
      diameterKm: 150,
      diameterLabel: "≈ 116–172 km",
      albedo: 0.12,
      shape: [1.13, 0.95, 0.92],
      colour: 0x7b5c52,
      tidallyLocked: false,
      discovered: "2007, Hubble Space Telescope",
      description:
        "Quaoar's only confirmed moon, orbiting roughly in the plane of the two rings and about three times further out than the outer one. Named, like its parent, from the creation story of the Tongva people of the Los Angeles basin.",
      structure:
        "Small dark irregular body, probably a collisional fragment, close to coplanar with Quaoar's equator and its rings",
    },
  ],
  Makemake: [
    {
      name: "MK 2",
      designation: "S/2015 (136472) 1",
      semiMajorAxisKm: 22_250,
      eccentricity: 0.03,
      inclinationDeg: 83.7,
      nodeDeg: 79.0,
      meanAnomalyDeg: 214.0,
      periodDays: 18.023,
      diameterKm: 175,
      diameterLabel: "≈ 175 km",
      albedo: 0.04,
      shape: [1.1, 0.96, 0.93],
      colour: 0x38332f,
      tidallyLocked: false,
      discovered: "2016, Hubble Space Telescope",
      description:
        "As dark as charcoal, orbiting one of the brightest surfaces in the Solar System: Makemake reflects eighty-two per cent of the light that reaches it and MK 2 about four. It is too small for its gravity to hold on to bright ice, so what is left is the dark residue underneath.",
      structure:
        "Very dark carbon-rich body on a near-polar orbit, stripped of any volatile ice its weak gravity could not retain",
    },
  ],
  Gonggong: [
    {
      name: "Xiangliu",
      designation: "(225088) Gonggong I",
      semiMajorAxisKm: 24_021,
      eccentricity: 0.29,
      inclinationDeg: 83.0,
      nodeDeg: 172.0,
      meanAnomalyDeg: 96.0,
      periodDays: 25.22,
      diameterKm: 100,
      diameterLabel: "≈ 36–100 km",
      albedo: 0.12,
      shape: [1.2, 0.93, 0.88],
      colour: 0x8b7268,
      tidallyLocked: false,
      discovered: "2016, Hubble Space Telescope",
      description:
        "A small moon on a strikingly eccentric orbit -- it swings between roughly seventeen and thirty-one thousand kilometres from Gonggong. Photometry in 2017 showed it is markedly less red than its parent, which is the sort of mismatch that usually means a captured or collisional origin.",
      structure:
        "Small irregular fragment, noticeably greyer than Gonggong's deep red surface, on a highly eccentric near-polar orbit",
    },
  ],
});

function stableSeed(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 100_000;
  }
  return (hash % 1000) / 1000;
}

function orbitalSpeedKmS(semiMajorAxisKm, periodDays) {
  return (Math.PI * 2 * semiMajorAxisKm) / (periodDays * 86_400);
}

/**
 * Where the moon is *drawn*, in parent radii.
 *
 * The real ratios are unusable as a picture. Vanth sits at ten Orcus radii and
 * Hi'iaka at eighty-five Haumea radii; drawn to scale in one frame, either the
 * inner moon is inside the planet's glow or the outer one is off screen. The
 * measured axis is preserved in the metadata and stated on the moon's card --
 * what is compressed is only the spacing, and the *ordering* is never changed.
 */
function displayOrbitScale(parentName, index, count) {
  const inner = 2.6;
  const outer = count > 1 ? 5.4 : 3.6;
  if (count <= 1) return inner + (outer - inner) * 0.5;
  return inner + (outer - inner) * (index / (count - 1));
}

function buildProfiles(parentName, records) {
  const parentProfile = PLANET_SCALE_PROFILES[parentName];
  const parentDiameterKm = parentProfile?.diameterKm ?? 1_000;
  const parentVisualRadius = parentProfile?.visualRadius ?? 1;

  return Object.freeze(records.map((record, index) => {
    const seed = stableSeed(record.name);
    const trueRatioRadius = parentVisualRadius * (record.diameterKm / parentDiameterKm);
    /*
     * Small moons are drawn larger than they are -- but by a curve, not by
     * brackets.
     *
     * The first attempt used size bands, and it flattened the very thing that
     * makes this set worth looking at: every moon landed between a third and a
     * half of its parent, so Hi'iaka and Namaka rendered at the same size
     * despite Hi'iaka being nearly twice the diameter, and Xiangliu -- a
     * twelfth of Gonggong -- came out bigger than Dysnomia is relative to Eris.
     *
     * A power curve keeps the ordering intact instead. Anything already a fifth
     * of its parent is drawn true; below that the enlargement grows smoothly as
     * the moon gets smaller, so the small ones stay visible without any two of
     * them converging on the same apparent size.
     */
    const ratio = record.diameterKm / parentDiameterKm;
    const TRUE_SIZE_ABOVE = 0.20;
    const boost = ratio >= TRUE_SIZE_ABOVE
      ? 1
      : Math.min(2.4, Math.pow(TRUE_SIZE_ABOVE / Math.max(ratio, 0.001), 0.55));
    const visualRadius = trueRatioRadius * boost;
    const speed = THREE.MathUtils.clamp(0.026 / Math.sqrt(record.periodDays), 0.0026, 0.011);
    const tumble = record.tidallyLocked ? 1 : 6.5;

    return Object.freeze({
      ...record,
      family: ratio > 0.35 ? "Binary companion" : "Small trans-Neptunian moon",
      trueSizeRatio: ratio,
      parentName,
      surfaceEvidence: record.diameterKm > 400
        ? "Stellar-occultation diameter and Hubble astrometry"
        : "Hubble astrometry and rotational photometry; unresolved",
      surfaceStructure: record.structure,
      surfaceRoughness: 0.985,
      color: record.colour,
      diameterEstimated: true,
      orbitScale: displayOrbitScale(parentName, index, records.length),
      /*
       * The real orbital radius, carried through so the distance readout can
       * place the moon relative to its parent rather than on top of it.
       *
       * `orbitScale` above is a *display* number -- these systems are
       * compressed hard so a moon stays visible beside its world -- so nothing
       * measured from the scene can recover this.
       */
      semiMajorAxisKm: record.semiMajorAxisKm,
      inclination: THREE.MathUtils.degToRad(record.inclinationDeg),
      node: THREE.MathUtils.degToRad(record.nodeDeg),
      meanAnomaly: THREE.MathUtils.degToRad(record.meanAnomalyDeg),
      retrograde: false,
      speed,
      seed,
      visualRadius,
      showOrbitGuide: true,
      instanced: false,
      interactionTier: "direct",
      chaoticTumble: !record.tidallyLocked,
      tumbleRate: record.tidallyLocked ? null : [
        speed * tumble * (0.34 + seed * 0.08),
        speed * tumble,
        speed * tumble * (0.22 + seed * 0.06),
      ],
      initialRotation: [seed * 0.8 - 0.4, seed * 1.4, seed * 0.6 - 0.3],
      orbitalSpeed: `${orbitalSpeedKmS(record.semiMajorAxisKm, record.periodDays).toFixed(3)} km/s around ${parentName}`,
      orbitSummary: `Measured semimajor axis ${record.semiMajorAxisKm.toLocaleString("en-US")} km; sidereal period ${record.periodDays.toFixed(3)} days; eccentricity ${record.eccentricity.toFixed(3)}; inclination ${record.inclinationDeg.toFixed(1)}°. The scene compresses orbital spacing for readability and keeps the measured ordering.`,
      dataNote: `Discovered ${record.discovered}. Geometric albedo ${record.albedo.toFixed(2)}.${
        boost > 1.02 ? ` The mesh is enlarged about ${boost.toFixed(1)}× so a body this small remains visible beside its parent; the scientific diameter above is the measured one, and the enlargement is scaled so no two moons of one world end up the same apparent size.` : " Drawn at its true size relative to its parent."
      }`,
    });
  }));
}

export const TRANS_NEPTUNIAN_MOON_SYSTEMS = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW).map(([parentName, records]) => [
      parentName,
      buildProfiles(parentName, records),
    ]),
  ),
);

/** Parents that actually have a moon, for the satellite system to iterate. */
export const TRANS_NEPTUNIAN_MOON_PARENTS = Object.freeze(
  Object.keys(TRANS_NEPTUNIAN_MOON_SYSTEMS),
);

/** How many moons each of these worlds is known to have. Sedna's is zero. */
export const TRANS_NEPTUNIAN_MOON_COUNTS = Object.freeze({
  ...Object.fromEntries(
    Object.entries(TRANS_NEPTUNIAN_MOON_SYSTEMS).map(([name, list]) => [name, list.length]),
  ),
  Sedna: 0,
});

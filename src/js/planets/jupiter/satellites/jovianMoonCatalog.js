import * as THREE from "three";

/**
 * Current Jovian satellite catalogue from NASA/JPL's Planetary Satellite Mean
 * Elements table (JUP365, JUP347, JUP348 and JUP349 solutions, accessed 2026).
 *
 * Tuple columns:
 * [name, JPL code, semi-major axis km, eccentricity, inclination degrees,
 *  ascending node degrees, mean anomaly degrees, orbital period days]
 *
 * The table currently contains 115 satellites. Mean elements describe the
 * overall orbit; they are not intended to replace a high-precision ephemeris.
 */
const JPL_JOVIAN_ORBITS = Object.freeze([
  ["Io", 501, 421800, 0.004, 0, 0, 330.9, 1.762732],
  ["Europa", 502, 671100, 0.009, 0.5, 184, 345.4, 3.525463],
  ["Ganymede", 503, 1070400, 0.001, 0.2, 58.5, 324.8, 7.155588],
  ["Callisto", 504, 1882700, 0.007, 0.3, 309.1, 87.4, 16.69044],
  ["Amalthea", 505, 181400, 0.003, 0.4, 282.9, 310.6, 0.499918],
  ["Thebe", 514, 221900, 0.018, 1.1, 340.4, 182.1, 0.676105],
  ["Adrastea", 515, 129000, 0, 0, 0, 214.5, 0.29826],
  ["Metis", 516, 128000, 0, 0, 0, 166, 0.294779],
  ["Himalia", 506, 11439000, 0.16, 28.4, 64.2, 78.3, 249.909],
  ["Elara", 507, 11710700, 0.212, 27.8, 112.8, 346.9, 258.8861],
  ["Pasiphae", 508, 23463200, 0.412, 148.3, 315.7, 279.3, 734.4215],
  ["Sinope", 509, 23679300, 0.262, 157.3, 308, 157.4, 744.5951],
  ["Lysithea", 510, 11699100, 0.117, 27.7, 9.2, 328.5, 258.5035],
  ["Carme", 511, 23139200, 0.261, 164.6, 115.5, 259.5, 719.2806],
  ["Ananke", 512, 21029500, 0.238, 147.6, 13.7, 271.7, 623.1097],
  ["Leda", 513, 11145200, 0.162, 28.2, 216.9, 232.6, 240.3264],
  ["Callirrhoe", 517, 23789400, 0.29, 144.9, 278.2, 117.9, 749.791],
  ["Themisto", 518, 7397000, 0.257, 44.3, 202.7, 289.1, 129.9681],
  ["Magaclite", 519, 23640100, 0.421, 149.9, 292.2, 116.1, 742.7715],
  ["Taygete", 520, 23103400, 0.257, 164.7, 300.8, 116.5, 717.5917],
  ["Chaldene", 521, 22926300, 0.261, 164.7, 134.5, 275.3, 709.3625],
  ["Harpalyke", 522, 20887500, 0.239, 147.8, 35.6, 255.4, 616.7833],
  ["Kalyke", 523, 23298000, 0.261, 164.7, 37.7, 224.9, 726.7007],
  ["Iocaste", 524, 21062300, 0.223, 148.7, 268.9, 182, 624.5479],
  ["Erinome", 525, 23027200, 0.272, 164.3, 311.2, 273.1, 714.0542],
  ["Isonoe", 526, 22976300, 0.249, 164.9, 134.1, 116.3, 711.6604],
  ["Praxidike", 527, 20931100, 0.245, 148.2, 281.3, 128, 618.7229],
  ["Autonoe", 528, 23785200, 0.326, 150.7, 264.8, 134, 749.6097],
  ["Thyone", 529, 20972700, 0.235, 147.6, 240.8, 242.5, 620.5875],
  ["Hermippe", 530, 21103600, 0.22, 150.2, 330.3, 158.6, 626.3799],
  ["Aitne", 531, 23059400, 0.273, 164.5, 358.4, 120.6, 715.5396],
  ["Eurydome", 532, 22894500, 0.287, 148.9, 297.7, 281.8, 707.8569],
  ["Euanthe", 533, 20822900, 0.243, 148.1, 265.2, 353.5, 613.9278],
  ["Euporie", 534, 19261900, 0.148, 145.5, 63.4, 56.4, 546.1778],
  ["Orthosie", 535, 20897800, 0.294, 144.2, 212.4, 161.1, 617.2347],
  ["Sponde", 536, 23538700, 0.323, 149.4, 109.3, 177.4, 737.9542],
  ["Kale", 537, 23047800, 0.262, 164.6, 56.7, 175.9, 715.016],
  ["Pasithee", 538, 22840800, 0.274, 164.5, 318, 237.8, 705.409],
  ["Hegemone", 539, 23342600, 0.357, 152.5, 311.5, 241.1, 728.7743],
  ["Mneme", 540, 20815800, 0.24, 147.8, 0.9, 236.1, 613.6104],
  ["Aoede", 541, 23773100, 0.437, 155.7, 156.5, 207.6, 749.0708],
  ["Thelxinoe", 542, 20972300, 0.229, 150.7, 174.9, 275.1, 620.5458],
  ["Arche", 543, 23093200, 0.263, 164.5, 333.3, 34, 717.1056],
  ["Kallichore", 544, 23017100, 0.253, 164.7, 23.9, 66.8, 713.5931],
  ["Helike", 545, 20911400, 0.155, 154.4, 94.6, 45.8, 617.8625],
  ["Carpo", 546, 17039500, 0.415, 53.3, 52.1, 336.6, 454.4],
  ["Eukelade", 547, 23062400, 0.274, 164.7, 200.4, 234.2, 715.6868],
  ["Cyllene", 548, 23650000, 0.421, 146.8, 253.6, 153.3, 743.2062],
  ["Kore", 549, 24203300, 0.338, 141.7, 324.2, 40.6, 769.4229],
  ["Herse", 550, 23146700, 0.258, 164.4, 299.5, 123.1, 719.6264],
  ["S2010_J_1", 551, 23185600, 0.256, 164.5, 284.7, 183.4, 721.4257],
  ["S2010_J_2", 552, 20786900, 0.244, 148, 357.3, 292.5, 612.3507],
  ["Dia", 553, 12257900, 0.232, 29.1, 293.9, 320.9, 277.2472],
  ["S2016_J_1", 554, 20796700, 0.245, 145.1, 247.7, 215.3, 612.7812],
  ["S2003_J_18", 555, 20332800, 0.102, 145.7, 166.8, 252.5, 592.3333],
  ["S2011_J_2", 556, 22903400, 0.358, 151.7, 24.9, 297.6, 708.2931],
  ["Eirene", 557, 23051300, 0.263, 164.7, 180, 336.7, 715.191],
  ["Philophrosyn", 558, 22600200, 0.221, 146.1, 234.3, 88.9, 694.2042],
  ["S2017_J_1", 559, 23739600, 0.321, 145.6, 251.8, 250.1, 747.4382],
  ["Eupheme", 560, 20763400, 0.234, 147.9, 227.5, 339.8, 611.316],
  ["S2003_J_19", 561, 23153100, 0.264, 164.6, 21.9, 196.9, 719.9222],
  ["Valetudo", 562, 18690100, 0.217, 34.5, 291.2, 90.5, 522.0743],
  ["S2017_J_2", 563, 22949600, 0.27, 164.5, 359.4, 278.2, 710.4208],
  ["S2017_J_3", 564, 20936500, 0.238, 147.9, 27.9, 235.4, 618.9653],
  ["Pandia", 565, 11479600, 0.178, 28.9, 249.8, 158.5, 251.2319],
  ["S2017_J_5", 566, 23202000, 0.261, 164.7, 42.3, 69.3, 722.1972],
  ["S2017_J_6", 567, 23251200, 0.333, 149.6, 312.8, 146, 724.4688],
  ["S2017_J_7", 568, 20960400, 0.235, 147.4, 264.9, 353, 620.0167],
  ["S2017_J_8", 569, 22819600, 0.259, 164.8, 97.3, 349.4, 704.4181],
  ["S2017_J_9", 570, 21764200, 0.197, 155.4, 245.3, 243.3, 656.0479],
  ["Ersa", 571, 11399400, 0.117, 29, 113.7, 270.8, 248.6153],
  ["S2011_J_1", 572, 23120800, 0.269, 164.7, 253.5, 225.4, 718.4153],
  ["S2003_J_2", 55501, 20992900, 0.225, 150.1, 348.4, 42.3, 621.4715],
  ["S2003_J_4", 55502, 22922300, 0.327, 148.3, 175.4, 216.5, 709.1229],
  ["S2003_J_9", 55503, 23195100, 0.268, 164.7, 46.3, 359.8, 721.8792],
  ["S2003_J_10", 55504, 23384400, 0.257, 164.6, 155.7, 272.8, 730.7375],
  ["S2003_J_12", 55505, 20959300, 0.235, 150, 54.1, 160.7, 619.9611],
  ["S2003_J_16", 55506, 20877500, 0.238, 147.8, 5.3, 298.2, 616.3444],
  ["S2003_J_23", 55507, 23824000, 0.306, 144.4, 30.9, 140.6, 751.3993],
  ["S2003_J_24", 55508, 22882400, 0.263, 164.6, 208.7, 121.6, 707.3347],
  ["S2011_J_3", 55509, 11716800, 0.192, 27.6, 123.3, 359.4, 259.0875],
  ["S2018_J_2", 55510, 11419700, 0.152, 28.3, 91.8, 115.5, 249.275],
  ["S2018_J_3", 55511, 23400200, 0.268, 164.9, 135.7, 279, 731.4875],
  ["S2021_J_1", 55512, 20954700, 0.228, 150.5, 241.1, 129.1, 619.7687],
  ["S2021_J_2", 55513, 20926600, 0.242, 148.1, 269.5, 110.8, 618.5028],
  ["S2021_J_3", 55514, 20776600, 0.239, 147.9, 141.7, 167.9, 611.8736],
  ["S2021_J_4", 55515, 23019700, 0.265, 164.6, 129.9, 218.9, 713.7056],
  ["S2021_J_5", 55516, 23414600, 0.272, 164.9, 154.4, 236.5, 732.1528],
  ["S2021_J_6", 55517, 22870400, 0.271, 164.9, 87.2, 208.5, 706.7653],
  ["S2016_J_3", 55518, 22719300, 0.251, 164.6, 36.8, 59.1, 699.7583],
  ["S2016_J_4", 55519, 23113900, 0.294, 147.1, 203.2, 217.5, 718.0382],
  ["S2018_J_4", 55520, 16328500, 0.177, 50.2, 52.1, 138.3, 426.2646],
  ["S2022_J_1", 55521, 22744700, 0.257, 164.5, 310.9, 42.2, 700.9333],
  ["S2022_J_2", 55522, 23073400, 0.263, 164.7, 47.7, 98.9, 716.2104],
  ["S2022_J_3", 55523, 21015100, 0.248, 148.1, 233.1, 271.7, 622.4361],
  ["S2017_J_10", 55525, 21075800, 0.209, 145.1, 329.6, 157.7, 625.1493],
  ["S2017_J_11", 55526, 22991300, 0.268, 164.8, 134.9, 236.9, 712.3826],
  ["S2011_J_4", 55527, 11104600, 0.128, 28.5, 342.4, 314.6, 239.0521],
  ["S2018_J_5", 55528, 23269900, 0.261, 164.9, 189.4, 82.9, 725.3785],
  ["S2024_J_1", 55529, 23462100, 0.273, 164.7, 272.4, 147.7, 734.3764],
  ["S2011_J_5", 55530, 23527800, 0.251, 164.6, 43.7, 66.6, 737.4646],
  ["S2010_J_3", 55531, 23862900, 0.313, 148.3, 312.4, 40.1, 753.2771],
  ["S2010_J_4", 55532, 22793400, 0.278, 164.6, 147.5, 80.4, 703.1938],
  ["S2010_J_5", 55533, 23581000, 0.257, 164.6, 309.5, 233.7, 739.9875],
  ["S2010_J_6", 55534, 21489800, 0.297, 149.9, 279.1, 87.8, 643.6715],
  ["S2011_J_6", 55535, 23238700, 0.261, 164.9, 310.6, 54.2, 723.934],
  ["S2017_J_12", 55536, 23270500, 0.257, 164.8, 236.7, 273.2, 725.3986],
  ["S2017_J_13", 55537, 22842700, 0.277, 164.5, 115.9, 26.8, 705.4972],
  ["S2017_J_14", 55538, 23412500, 0.436, 142.7, 294.2, 100.3, 732.0424],
  ["S2017_J_15", 55539, 23170300, 0.232, 149.2, 304.1, 324.6, 720.6535],
  ["S2017_J_16", 55540, 23007800, 0.268, 164.7, 4.7, 148.8, 713.1292],
  ["S2017_J_17", 55541, 11776100, 0.164, 29, 322.4, 244.5, 261.066],
  ["S2017_J_18", 55542, 22923800, 0.254, 164.9, 39.9, 40.6, 709.2396],
  ["S2021_J_7", 55543, 23305900, 0.253, 149.4, 286.5, 293.4, 727.0104],
  ["S2021_J_8", 55544, 20978900, 0.243, 147.1, 132, 85, 620.8486],
]);

const RESOLVED_GALILEAN_DATA = Object.freeze({
  Io: { diameterKm: 3642.98, family: "Galilean moon", appearance: "io", description: "The Solar System's most volcanically active world, resurfaced by sulfurous lava, giant calderas, plume deposits, and intense tidal heating." },
  Europa: { diameterKm: 3121.6, family: "Galilean moon", appearance: "europa", description: "A bright ice shell crossed by rust-coloured lineae and chaotic terrain, covering a global saltwater ocean that may contain habitable conditions." },
  Ganymede: { diameterKm: 5262.4, family: "Galilean moon", appearance: "ganymede", description: "The Solar System's largest moon, mixing old dark cratered terrain with younger grooved ice and possessing an internally generated magnetic field." },
  Callisto: { diameterKm: 4820.6, family: "Galilean moon", appearance: "callisto", description: "An ancient ice-rock world saturated with impact craters, including the enormous multi-ring Valhalla basin, and probably hiding a deep ocean." },
});

const INNER_MOON_DATA = Object.freeze({
  Metis: { diameterKm: 43, dimensions: "60 × 40 × 34 km", shape: [1.40, 0.93, 0.79], appearance: "inner-dark", description: "The innermost known moon of Jupiter, an irregular collision-scarred body embedded in the main ring and helping replenish its dust." },
  Adrastea: { diameterKm: 16.4, dimensions: "20 × 16 × 14 km", shape: [1.22, 0.98, 0.85], appearance: "inner-dark", description: "A tiny irregular moon skimming the outer edge of Jupiter's main ring and supplying dust through continual micrometeoroid impacts." },
  Amalthea: { diameterKm: 167, dimensions: "250 × 146 × 128 km", shape: [1.50, 0.87, 0.77], appearance: "amalthea", description: "A porous, potato-shaped, deep-red inner moon with enormous craters, bright patches, steep scarps, and a surface dusted by sulfur from Io." },
  Thebe: { diameterKm: 98.6, dimensions: "116 × 98 × 84 km", shape: [1.18, 0.99, 0.85], appearance: "thebe", description: "A dark red, heavily battered inner moon whose vast Zethus crater and impact debris help feed Jupiter's faint Thebe gossamer ring." },
});

// Photometric diameter estimates are provided only where widely established.
// All other tiny moons receive an explicit approximate value and an unresolved
// status in their information card rather than a fabricated precise dimension.
const ESTIMATED_DIAMETERS_KM = Object.freeze({
  Himalia: 170, Elara: 80, Pasiphae: 58, Sinope: 35, Lysithea: 42, Carme: 46,
  Ananke: 29, Leda: 22, Callirrhoe: 10, Themisto: 9, Magaclite: 5, Taygete: 5,
  Chaldene: 4, Harpalyke: 4, Kalyke: 5, Iocaste: 5, Erinome: 3, Isonoe: 4,
  Praxidike: 7, Autonoe: 4, Thyone: 4, Hermippe: 4, Aitne: 3, Eurydome: 3,
  Euanthe: 3, Euporie: 2, Orthosie: 2, Sponde: 2, Kale: 2, Pasithee: 2,
  Hegemone: 3, Mneme: 2, Aoede: 4, Thelxinoe: 2, Arche: 3, Kallichore: 2,
  Helike: 4, Carpo: 3, Eukelade: 4, Cyllene: 2, Kore: 2, Herse: 2, Dia: 4,
  Eirene: 4, Philophrosyn: 2, Eupheme: 2, Valetudo: 1, Pandia: 3, Ersa: 3,
});

const FAMILY_APPEARANCE = Object.freeze({
  "Himalia family": { appearance: "c-type", colour: 0x686c69, summary: "a neutral-grey C-type family fragment with dark, carbon-rich and magnetite-bearing material" },
  "Ananke family": { appearance: "p-type", colour: 0x5b514b, summary: "a dark grey-brown collision fragment associated with hydrated, carbonaceous P-type material" },
  "Carme family": { appearance: "d-type", colour: 0x70453d, summary: "a red-sloped D-type family fragment rich in very dark carbonaceous material" },
  "Pasiphae family": { appearance: "mixed-dark", colour: 0x5d5550, summary: "a compositionally varied, dark retrograde fragment with grey-to-muted-red surface material" },
  "Carpo group": { appearance: "p-type", colour: 0x5c5047, summary: "a distant prograde irregular fragment on a steeply inclined orbit" },
  "Themisto group": { appearance: "p-type", colour: 0x5e5148, summary: "an isolated prograde irregular satellite with a dark, mildly red-sloped surface" },
  "Valetudo group": { appearance: "mixed-dark", colour: 0x62534c, summary: "an unusual prograde moon crossing the realm of Jupiter's retrograde satellites" },
});

const ORBIT_GUIDE_LEADERS = new Set([
  "Io", "Europa", "Ganymede", "Callisto", "Metis", "Adrastea", "Amalthea", "Thebe",
  "Himalia", "Themisto", "Carpo", "Valetudo", "Ananke", "Carme", "Pasiphae",
]);

function displayMoonName(catalogueName) {
  const match = catalogueName.match(/^S(\d{4})_J_(\d+)$/);
  if (match) return `S/${match[1]} J ${match[2]}`;
  // JPL's compact table truncates these two longer IAU spellings.
  if (catalogueName === "Magaclite") return "Megaclite";
  if (catalogueName === "Philophrosyn") return "Philophrosyne";
  return catalogueName;
}

function stableSeed(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function classifyFamily(name, semiMajorAxisKm, inclinationDeg) {
  if (RESOLVED_GALILEAN_DATA[name]) return "Galilean moon";
  if (INNER_MOON_DATA[name]) return "Inner regular moon";
  if (name === "Themisto") return "Themisto group";
  if (name === "Carpo" || name === "S2018_J_4") return "Carpo group";
  if (name === "Valetudo") return "Valetudo group";
  if (inclinationDeg < 90 && semiMajorAxisKm >= 10_500_000 && semiMajorAxisKm <= 13_000_000) return "Himalia family";
  if (inclinationDeg >= 160) return "Carme family";
  if (inclinationDeg >= 140 && semiMajorAxisKm < 22_100_000) return "Ananke family";
  return "Pasiphae family";
}

function compressedOrbitScale(semiMajorAxisKm) {
  // Jupiter's real outer-moon system is more than fifty times wider than Io's
  // orbit. A power curve preserves ordering and family spacing without sending
  // the small moons thousands of scene units away from their planet.
  return 0.78 + Math.pow(semiMajorAxisKm / 421_800, 0.42);
}

function compressedVisualRadius(diameterKm, isResolved) {
  if (isResolved) {
    return THREE.MathUtils.clamp(0.18 + 0.31 * Math.pow(diameterKm / 5262.4, 0.72), 0.16, 0.50);
  }
  return THREE.MathUtils.clamp(0.026 + 0.056 * Math.pow(diameterKm / 140, 0.45), 0.026, 0.082);
}

function orbitalSpeedKmS(semiMajorAxisKm, periodDays) {
  return (Math.PI * 2 * semiMajorAxisKm) / (periodDays * 86_400);
}

function createOrbitSummary(semiMajorAxisKm, periodDays, eccentricity, inclinationDeg, retrograde) {
  const orbitDistance = semiMajorAxisKm >= 1_000_000
    ? `${(semiMajorAxisKm / 1_000_000).toFixed(2)} million km`
    : `${semiMajorAxisKm.toLocaleString("en-US")} km`;
  const period = periodDays < 1
    ? `${(periodDays * 24).toFixed(2)} hours`
    : `${periodDays.toFixed(periodDays < 20 ? 3 : 1)} days`;
  return `Mean orbit: ${orbitDistance} from Jupiter · period ${period} · eccentricity ${eccentricity.toFixed(3)} · inclination ${inclinationDeg.toFixed(1)}° · ${retrograde ? "retrograde" : "prograde"}.`;
}

function createIrregularDescription(displayName, family, appearance, direction, estimated) {
  const uncertainty = estimated
    ? "It has not been resolved as a surface by spacecraft; its displayed shape, craters, and colour are an evidence-based family reconstruction."
    : "Its resolved dimensions guide the displayed irregular shape.";
  return `${displayName} is ${appearance.summary} on a ${direction} orbit in the ${family}. ${uncertainty}`;
}

export const JUPITER_MOON_PROFILES = Object.freeze(JPL_JOVIAN_ORBITS.map((row) => {
  const [catalogueName, jplCode, semiMajorAxisKm, eccentricity, inclinationDeg, nodeDeg, meanAnomalyDeg, periodDays] = row;
  const displayName = displayMoonName(catalogueName);
  const resolvedData = RESOLVED_GALILEAN_DATA[catalogueName] ?? INNER_MOON_DATA[catalogueName] ?? null;
  const family = classifyFamily(catalogueName, semiMajorAxisKm, inclinationDeg);
  const appearance = resolvedData ?? FAMILY_APPEARANCE[family] ?? FAMILY_APPEARANCE["Pasiphae family"];
  const diameterKm = resolvedData?.diameterKm ?? ESTIMATED_DIAMETERS_KM[catalogueName] ?? 2;
  const diameterEstimated = !resolvedData;
  const seed = stableSeed(catalogueName);
  const retrograde = inclinationDeg > 90;
  const direction = retrograde ? "retrograde" : "prograde";
  const isRegular = family === "Galilean moon" || family === "Inner regular moon";
  const visualRadius = compressedVisualRadius(diameterKm, family === "Galilean moon");

  return Object.freeze({
    name: displayName,
    catalogueName,
    jplCode,
    family,
    appearance: appearance.appearance,
    colour: appearance.colour,
    diameterKm,
    diameterEstimated,
    dimensions: resolvedData?.dimensions ?? null,
    orbitScale: compressedOrbitScale(semiMajorAxisKm),
    semiMajorAxisKm,
    eccentricity,
    inclination: THREE.MathUtils.degToRad(inclinationDeg),
    inclinationDeg,
    node: THREE.MathUtils.degToRad(nodeDeg),
    meanAnomaly: THREE.MathUtils.degToRad(meanAnomalyDeg),
    periodDays,
    retrograde,
    // Period controls relative speed; the range is compressed so outer moons
    // remain visibly alive without the Galilean system becoming frantic.
    speed: (retrograde ? -1 : 1) * THREE.MathUtils.clamp(0.022 / Math.sqrt(periodDays), 0.00055, 0.018),
    seed,
    shape: isRegular
      ? (INNER_MOON_DATA[catalogueName]
        ? INNER_MOON_DATA[catalogueName].shape
        : [1.002, 1, 0.999])
      : [1.08 + seed * 0.45, 0.78 + seed * 0.20, 0.70 + seed * 0.22],
    visualRadius,
    tidallyLocked: isRegular,
    showOrbitGuide: ORBIT_GUIDE_LEADERS.has(catalogueName),
    initialRotation: [seed * 0.8 - 0.4, seed * Math.PI * 2, seed * 0.6 - 0.3],
    orbitalSpeed: `${orbitalSpeedKmS(semiMajorAxisKm, periodDays).toFixed(2)} km/s around Jupiter`,
    orbitSummary: createOrbitSummary(
      semiMajorAxisKm,
      periodDays,
      eccentricity,
      inclinationDeg,
      retrograde,
    ),
    description: resolvedData?.description
      ?? createIrregularDescription(displayName, family, appearance, direction, diameterEstimated),
    dataNote: diameterEstimated
      ? "Diameter and visible surface are estimates; orbit uses JPL mean elements."
      : "Dimensions and appearance are constrained by spacecraft observations.",
  });
}));

export const JUPITER_MOON_COUNT = JUPITER_MOON_PROFILES.length;

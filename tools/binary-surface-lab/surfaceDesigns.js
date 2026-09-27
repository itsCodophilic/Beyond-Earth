/**
 * The candidate designs for the five binary systems, for the surface lab.
 *
 * Each system has three variants, A, B and C; each variant gives every body
 * in the system a terrain (see surfaceGenerator.js for what each one is
 * modelled on) and each body keeps its own palette in every variant, so the
 * eleven stay distinguishable whatever is chosen.
 *
 * Palettes are sRGB, dark / mid / light, deliberately close together: a
 * real surface is low contrast in albedo (see the generator's header). They
 * follow the measured colours -- all eleven are red to very red, B-R 1.64 to
 * 1.74 (Lempo system V-R 0.69; Grundy, Benecchi, Rabinowitz et al.) -- and
 * the user's brief: Lempo strongly red, Teharonhiawako and Sawiskera dark
 * reddish-brown, Altjira deep dark red, Manwë and Thorondor dark ultra-red.
 */

export const PALETTES = Object.freeze({
  Lempo: { dark: "#3d1410", mid: "#8c2f22", light: "#b8573f" },
  Hiisi: { dark: "#45190c", mid: "#9b4220", light: "#c47346" },
  Paha: { dark: "#37120f", mid: "#842a20", light: "#ad4f3c" },
  Sila: { dark: "#3e1c12", mid: "#8a4a31", light: "#b27456" },
  // Rose, where Sila is brick: the pair must not read as one body twice.
  Nunam: { dark: "#45191f", mid: "#9c4c55", light: "#c67d82" },
  Teharonhiawako: { dark: "#241510", mid: "#5a3528", light: "#7e5745" },
  Sawiskera: { dark: "#1f1210", mid: "#4f2b26", light: "#744a42" },
  Altjira: { dark: "#1f0a0b", mid: "#56201f", light: "#7f3c35" },
  "Altjira I": { dark: "#2a110c", mid: "#6a2e22", light: "#93513d" },
  "Manwë": { dark: "#2c140a", mid: "#7a3e22", light: "#a8663f" },
  Thorondor: { dark: "#331a0c", mid: "#8a4b28", light: "#b67a4e" },
});

/* The terrains. Radii and widths are in radians on the unit sphere. */
export const TERRAINS = Object.freeze({
  saturated: {
    label: "Saturated craters (Callisto)",
    recipe: {
      broad: 0.14, fine: 0.06, grain: 0.045, bake: 0.35,
      craters: { count: 2400, rmin: 0.011, rmax: 0.2, slope: 1.8, wearMin: 0.12, wearBias: 0.6, fresh: 0.05, rays: 0.3 },
    },
  },
  rubble: {
    label: "Boulder rubble pile (Bennu, Ryugu)",
    recipe: {
      broad: 0.1, fine: 0.09, grain: 0.08, bake: 0.4,
      rubble: { levels: [
        { freq: 9, amp: 0.5, toneVar: 0.22, gapDark: 0.04, cover: 0.85 },
        { freq: 26, amp: 0.45, toneVar: 0.28, gapDark: 0.05, cover: 0.8 },
        { freq: 70, amp: 0.35, toneVar: 0.28, gapDark: 0.04, cover: 0.7 },
      ] },
      craters: { count: 60, rmin: 0.03, rmax: 0.2, slope: 1.6, wearMin: 0.2, wearBias: 1.5, fresh: 0.03 },
    },
  },
  mounds: {
    label: "Smooth mounds, few craters (Arrokoth)",
    recipe: {
      broad: 0.12, fine: 0.05, grain: 0.03, bake: 0.25,
      mounds: { count: 14, rmin: 0.25, rmax: 0.55, amp: 0.085, toneVar: 0.14, edgeDark: 0.06 },
      patches: { freq: 3, threshold: 0.28, bright: 0.16 },
      craters: { count: 40, rmin: 0.02, rmax: 0.14, slope: 1.4, wearMin: 0.35, fresh: 0.08 },
      collar: 0.35,
    },
  },
  giants: {
    label: "Giant spalled craters (Mathilde)",
    recipe: {
      broad: 0.08, fine: 0.05, grain: 0.04, bake: 0.3,
      giants: { count: 5, rmin: 0.34, rmax: 0.6, slope: 1, wearMin: 0.6, spall: 0.07 },
      craters: { count: 320, rmin: 0.015, rmax: 0.1, slope: 2, wearMin: 0.25, fresh: 0.03 },
    },
  },
  grooved: {
    label: "Grooves and pit chains (Lutetia, Phobos)",
    recipe: {
      broad: 0.12, fine: 0.07, grain: 0.05, bake: 0.35,
      grooves: { families: 2, perFamily: 7, width: 0.012, depth: 0.012, pits: 22, dark: 0.03 },
      craters: { count: 420, rmin: 0.014, rmax: 0.16, slope: 1.9, wearMin: 0.2, wearBias: 0.7, fresh: 0.05 },
      patches: { freq: 5, threshold: 0.35, bright: 0.1 },
    },
  },
  snowball: {
    label: "Dirty snowball: fresh icy craters, fractures",
    recipe: {
      broad: 0.16, fine: 0.08, grain: 0.06, bake: 0.3,
      craters: { count: 700, rmin: 0.012, rmax: 0.14, slope: 2.1, wearMin: 0.25, fresh: 0.16, rays: 0.15 },
      fractures: { count: 9, width: 0.006, depth: 0.01, length: 1.2, dark: 0.06 },
      flecks: 0.5,
    },
  },
});

/* Always true of a body, whatever variant: the brief. */
const BODY_EXTRAS = Object.freeze({
  // "Bright frost patches in crater floors"; "fractures near the neck".
  "Manwë": { frost: 0.75, fractures: { count: 10, width: 0.007, depth: 0.012, length: 0.55, dark: 0.07, aroundNeck: true } },
  // More battered than its partner.
  Sawiskera: { craterBoost: 1.35 },
  // "Paha the same colour", smaller and more pitted.
  Paha: { craterBoost: 1.2 },
});

function merge(terrain, body) {
  const base = TERRAINS[terrain].recipe;
  const extra = BODY_EXTRAS[body] ?? {};
  const recipe = JSON.parse(JSON.stringify(base));
  if (extra.frost) recipe.frost = extra.frost;
  if (extra.fractures) recipe.fractures = extra.fractures;
  if (extra.craterBoost && recipe.craters) recipe.craters.count *= extra.craterBoost;
  return recipe;
}

/*
 * The variants. `why` is what the lab shows beside the choice: which real
 * body each look is borrowed from, and why that is a plausible borrowing.
 */
export const SYSTEMS = Object.freeze([
  {
    key: "lempo",
    name: "Lempo · Hiisi · Paha",
    brief: "Strongly red (tholins), highly cratered, rubble pile; Paha the same colour.",
    variants: {
      A: { title: "Callisto-red", terrains: { Lempo: "saturated", Hiisi: "saturated", Paha: "saturated" },
        why: "Cratered to saturation, like Callisto: an old surface where every new impact lands on an older one. Young craters keep bright, paler haloes." },
      B: { title: "Ryugu rubble", terrains: { Lempo: "rubble", Hiisi: "rubble", Paha: "rubble" },
        why: "A rubble pile shows it: boulders of every size, as Bennu and Ryugu do, with only a few craters that the loose surface has not erased." },
      C: { title: "Mixed", terrains: { Lempo: "saturated", Hiisi: "giants", Paha: "rubble" },
        why: "Three histories: Lempo saturated, Hiisi scarred by a few giant impacts like Mathilde, small Paha a boulder pile." },
    },
  },
  {
    key: "sila",
    name: "Sila · Nunam",
    brief: "Cold classical near-equal pair, tidally locked; the population Arrokoth belongs to.",
    variants: {
      A: { title: "Arrokoth-like", terrains: { Sila: "mounds", Nunam: "mounds" },
        why: "Arrokoth is the only cold classical ever seen close up: smooth, few craters, rounded mounds and bright patches. The closest real analogue there is." },
      B: { title: "Lightly cratered", terrains: { Sila: "saturated", Nunam: "snowball" },
        why: "More cratering than Arrokoth -- Sila and Nunam are twenty times its size and have swept up more -- with icy fresh craters on Nunam." },
      C: { title: "Giant impacts", terrains: { Sila: "giants", Nunam: "giants" },
        why: "Mathilde-style: a handful of huge, angular craters on very uniform ground." },
    },
  },
  {
    key: "teharonhiawako",
    name: "Teharonhiawako · Sawiskera",
    brief: "Ultra-red, dark reddish-brown dirty snowballs, craters and fractures; Sawiskera more battered.",
    variants: {
      A: { title: "Snowball and battered", terrains: { Teharonhiawako: "snowball", Sawiskera: "saturated" },
        why: "Teharonhiawako a dirty snowball with fresh icy craters and fractures; Sawiskera cratered to saturation, the battered one." },
      B: { title: "Grooved", terrains: { Teharonhiawako: "grooved", Sawiskera: "grooved" },
        why: "Fractures as Lutetia and Phobos carry them: families of grooves and pit chains from old impacts." },
      C: { title: "Giant impacts", terrains: { Teharonhiawako: "snowball", Sawiskera: "giants" },
        why: "Sawiskera's elongation read as damage: a few giant spalled craters, as on Mathilde." },
    },
  },
  {
    key: "altjira",
    name: "Altjira · Altjira I",
    brief: "Deep dark red, porous rubble pile (density ~0.3 g/cm3); Altjira probably itself two bodies.",
    variants: {
      A: { title: "Bennu rubble", terrains: { Altjira: "rubble", "Altjira I": "rubble" },
        why: "Porous and loosely bound: boulder fields of every size, as on Bennu and Ryugu." },
      B: { title: "Mathilde-dark", terrains: { Altjira: "giants", "Altjira I": "giants" },
        why: "Mathilde is the porous rubble pile we have seen: half empty inside, very dark, and scarred by craters nearly as wide as itself." },
      C: { title: "Arrokoth pair", terrains: { Altjira: "mounds", "Altjira I": "rubble" },
        why: "If Altjira is two bodies touching, it may look like Arrokoth: smooth lobes with a bright neck. Its partner a rubble pile." },
    },
  },
  {
    key: "manwe",
    name: "Manwë · Thorondor",
    brief: "Dark ultra-red; Manwë a contact binary with fractures at the neck and frost in crater floors; Thorondor an irregular fragment.",
    variants: {
      A: { title: "Arrokoth contact", terrains: { "Manwë": "mounds", Thorondor: "grooved" },
        why: "Manwë like Arrokoth, a contact binary with a bright collar at the neck, plus the frosted crater floors and neck fractures asked for; Thorondor a grooved fragment." },
      B: { title: "Cratered", terrains: { "Manwë": "saturated", Thorondor: "saturated" },
        why: "Both heavily cratered; Manwë keeps its frost and neck fractures." },
      C: { title: "Fragment and rubble", terrains: { "Manwë": "snowball", Thorondor: "rubble" },
        why: "Manwë an icy snowball with bright fresh craters; Thorondor a loose boulder fragment." },
    },
  },
]);

/* Stable seeds, so a design looks the same every time it is opened. */
export const SEEDS = Object.freeze({
  Lempo: 101, Hiisi: 202, Paha: 303, Sila: 404, Nunam: 505,
  Teharonhiawako: 606, Sawiskera: 707, Altjira: 808, "Altjira I": 909,
  "Manwë": 1010, Thorondor: 1111,
});

export function specFor(system, variantKey, body, { width = 1024, height = 512, lobed = false, tweaks = {} } = {}) {
  const variant = system.variants[variantKey];
  const terrain = variant.terrains[body];
  return {
    width, height, lobed,
    seed: SEEDS[body] ?? 1,
    palette: PALETTES[body],
    recipe: merge(terrain, body),
    tweaks,
    terrain,
  };
}

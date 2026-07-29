/** Creates deterministic random values so the celestial sky never reshuffles. */
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller transform for natural centre-heavy distributions. */
export function gaussian(random) {
  const first = Math.max(1e-7, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * random());
}

/** Smooth interpolation with zero velocity at both ends. */
export function smootherstep(value, minimum, maximum) {
  const amount = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}


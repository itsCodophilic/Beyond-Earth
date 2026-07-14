import { SPACE_ENVIRONMENT_CONFIG } from "./spaceEnvironmentConfig.js";
import { smootherstep } from "./seededRandom.js";

const STATE_KEYS = [
  "journeyProgress",
  "solarInfluence",
  "solarGlare",
  "rendererExposure",
  "directLightIntensity",
  "sunApparentScale",
  "starVisibility",
  "heroStarVisibility",
  "milkyWayVisibility",
  "galaxyVisibility",
  "dustVisibility",
  "zodiacalGlow",
  "debrisVisibility",
  "backgroundContrast",
  "bloomStrength",
  "lensFlareStrength",
];

/**
 * Converts one normalized journey value into a coordinated deep-space state.
 *
 * The important visual rule is that space remains black in every region. The
 * journey reveals additional faint information; it never replaces darkness
 * with a bright cloud background.
 */
export class EnvironmentStateController {
  constructor() {
    this.journeyProgress = 0;
    this.state = this.#calculateTargets(0, {});
    this.targets = { ...this.state };
  }

  setJourneyProgress(progress) {
    this.journeyProgress = Math.min(1, Math.max(0, progress));
  }

  update(deltaTime) {
    const targets = this.#calculateTargets(this.journeyProgress, this.targets);
    const damping = 1 - Math.exp(-SPACE_ENVIRONMENT_CONFIG.damping.environment * deltaTime);

    STATE_KEYS.forEach((key) => {
      this.state[key] += (targets[key] - this.state[key]) * damping;
    });
    return this.state;
  }

  #calculateTargets(progress, target) {
    const middle = smootherstep(progress, 0.24, 0.70);
    const outer = smootherstep(progress, 0.60, 0.94);
    const deep = smootherstep(progress, 0.82, 1.0);
    const solarInfluence = 1 - smootherstep(progress, 0.10, 0.97);

    const exposure = SPACE_ENVIRONMENT_CONFIG.exposure.innerSolar
      + middle * (SPACE_ENVIRONMENT_CONFIG.exposure.outerSolar - SPACE_ENVIRONMENT_CONFIG.exposure.innerSolar)
      + deep * (SPACE_ENVIRONMENT_CONFIG.exposure.interstellar - SPACE_ENVIRONMENT_CONFIG.exposure.outerSolar);

    target.journeyProgress = progress;
    target.solarInfluence = solarInfluence;
    target.solarGlare = solarInfluence * (1 - outer * 0.78);
    target.rendererExposure = exposure;
    target.directLightIntensity = 0.72 + solarInfluence * 0.28;
    target.sunApparentScale = 0.42 + solarInfluence * 0.58;

    // Ordinary stars are present throughout the Solar System. The faint tail is
    // progressively revealed as solar glare and foreground brightness weaken.
    target.starVisibility = 0.82 + middle * 0.12 + outer * 0.22 + deep * 0.12;
    target.heroStarVisibility = 0.28 + middle * 0.12 + outer * 0.34 + deep * 0.30;

    // The Milky Way and galaxies never pop into existence. Their very low inner
    // values become perceptually useful only in the outer-system exposure range.
    target.milkyWayVisibility = 0.18 + middle * 0.14 + outer * 0.28 + deep * 0.22;
    target.galaxyVisibility = 0.22 + middle * 0.16 + outer * 0.42 + deep * 0.38;

    // Local dust is a rare glint, not a surrounding fog or a galactic ribbon.
    target.dustVisibility = 0.010 + solarInfluence * 0.022 + outer * 0.026 + deep * 0.034;
    target.zodiacalGlow = 0.075 * solarInfluence * (1 - outer * 0.92);
    target.debrisVisibility = 0.16 + middle * 0.34;
    target.backgroundContrast = 1.06 + outer * 0.15 + deep * 0.07;
    target.bloomStrength = 0.36 + solarInfluence * 0.18;
    target.lensFlareStrength = solarInfluence * 0.50;
    return target;
  }
}

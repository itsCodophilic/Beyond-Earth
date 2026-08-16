import { SPACE_ENVIRONMENT_CONFIG } from "./spaceEnvironmentConfig.js";
import { smootherstep } from "./seededRandom.js";

/**
 * Every value that is actually consumed downstream.
 *
 * This list used to carry sixteen entries, eleven of which drove the deep-sky
 * star, Milky Way, galaxy and dust layers. Those layers have been removed, so
 * their targets are gone too rather than being damped every frame for nobody.
 */
const STATE_KEYS = [
  "journeyProgress",
  "solarGlare",
  "rendererExposure",
  "zodiacalGlow",
  "backgroundContrast",
];

/**
 * Converts one normalized journey value into a coordinated deep-space state.
 *
 * The important visual rule is that space remains black in every region. The
 * journey adjusts exposure and the faint zodiacal glow; it never replaces
 * darkness with a bright cloud background.
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
    // Retained as a local: several targets below are derived from it, but
    // nothing outside this class reads it.
    const solarInfluence = 1 - smootherstep(progress, 0.10, 0.97);

    const exposure = SPACE_ENVIRONMENT_CONFIG.exposure.innerSolar
      + middle * (SPACE_ENVIRONMENT_CONFIG.exposure.outerSolar - SPACE_ENVIRONMENT_CONFIG.exposure.innerSolar)
      + deep * (SPACE_ENVIRONMENT_CONFIG.exposure.interstellar - SPACE_ENVIRONMENT_CONFIG.exposure.outerSolar);

    target.journeyProgress = progress;
    target.solarGlare = solarInfluence * (1 - outer * 0.78);
    target.rendererExposure = exposure;
    target.zodiacalGlow = 0.075 * solarInfluence * (1 - outer * 0.92);
    target.backgroundContrast = 1.06 + outer * 0.15 + deep * 0.07;
    return target;
  }
}

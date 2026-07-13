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
 * Converts one normalized journey value into every coordinated visual state.
 * Target values are damped over time, so scroll, focus, reverse travel, and
 * browser-restored scroll positions all use the same continuous transition.
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
    const middle = smootherstep(progress, 0.22, 0.72);
    const outer = smootherstep(progress, 0.58, 0.96);
    const deep = smootherstep(progress, 0.78, 1);
    const solarInfluence = 1 - smootherstep(progress, 0.08, 0.96);
    const exposure = SPACE_ENVIRONMENT_CONFIG.exposure.innerSolar
      + middle * (SPACE_ENVIRONMENT_CONFIG.exposure.outerSolar - SPACE_ENVIRONMENT_CONFIG.exposure.innerSolar)
      + deep * (SPACE_ENVIRONMENT_CONFIG.exposure.interstellar - SPACE_ENVIRONMENT_CONFIG.exposure.outerSolar);

    target.journeyProgress = progress;
    target.solarInfluence = solarInfluence;
    target.solarGlare = solarInfluence * (1 - outer * 0.72);
    target.rendererExposure = exposure;
    target.directLightIntensity = 0.72 + solarInfluence * 0.28;
    target.sunApparentScale = 0.42 + solarInfluence * 0.58;
    // Stars, the Milky Way, and distant galaxies exist in every region. Solar
    // glare suppresses only the area surrounding the Sun, so the rest of the
    // sky remains rich even while the camera is among the inner planets.
    target.starVisibility = 0.88 + middle * 0.07 + outer * 0.05;
    target.heroStarVisibility = 0.05 + middle * 0.08 + outer * 0.55;
    target.milkyWayVisibility = 0.64 + middle * 0.16 + outer * 0.20;
    target.galaxyVisibility = 0.22 + middle * 0.14 + outer * 0.46;
    target.dustVisibility = 0.09 + solarInfluence * 0.23 * (1 - deep);
    target.zodiacalGlow = 0.27 * solarInfluence * (1 - outer * 0.82);
    target.debrisVisibility = 0.22 + middle * 0.38;
    target.backgroundContrast = 0.84 + outer * 0.16;
    target.bloomStrength = 0.42 + solarInfluence * 0.20;
    target.lensFlareStrength = solarInfluence * 0.55;
    return target;
  }
}

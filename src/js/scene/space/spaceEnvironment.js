import * as THREE from "three";
import { createCosmicDustField } from "./cosmicDustField.js";
import { EnvironmentStateController } from "./environmentStateController.js";
import { createGalaxyField } from "./galaxyField.js";
import { createHeroStarField } from "./heroStarField.js";
import { createMilkyWayBackground } from "./milkyWayBackground.js";
import {
  detectQualityPreset,
  QUALITY_PRESETS,
  SPACE_ENVIRONMENT_CONFIG,
} from "./spaceEnvironmentConfig.js";
import { createStarField } from "./starField.js";
import { createZodiacalLight } from "./zodiacalLight.js";

/**
 * Public facade for every non-planetary space layer.
 *
 * Main.js supplies journey progress, time, and resize events. Internal systems
 * remain private so the application cannot accidentally desynchronize star,
 * galaxy, dust, exposure, and solar-glare transitions.
 */
export class SpaceEnvironment {
  constructor({ scene, camera, renderer, quality = null }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.root = new THREE.Group();
    this.root.name = "Layered solar-system space environment";
    this.stateController = new EnvironmentStateController();
    this.layers = [];
    this.initialized = false;
    this.paused = false;
    this.sunPosition = new THREE.Vector3();
    this.sunDirection = new THREE.Vector3(0, 0, -1);
    this.hasSolarDirectionOverride = false;
    this.updateContext = {
      time: 0,
      visibility: 0,
      exposure: 1,
      solarSuppression: 1,
      sunDirection: this.sunDirection,
      sunPosition: this.sunPosition,
      reducedMotion: false,
      contrast: 1,
    };

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.handleMotionPreference = (event) => {
      this.reducedMotion = event.matches;
    };
    this.motionQuery.addEventListener?.("change", this.handleMotionPreference);

    this.qualityName = quality ?? detectQualityPreset({ reducedMotion: this.reducedMotion });
    this.quality = QUALITY_PRESETS[this.qualityName] ?? QUALITY_PRESETS.medium;
  }

  /** Builds all geometry once. No texture downloads or per-frame compilation occur. */
  async init() {
    if (this.initialized) return this;
    const radii = SPACE_ENVIRONMENT_CONFIG.radii;
    const pixelRatio = Math.min(window.devicePixelRatio, this.quality.maxPixelRatio);

    this.backgroundStars = createStarField({
      count: this.quality.backgroundStars,
      minimumRadius: radii.backgroundStarShell - 45,
      maximumRadius: radii.backgroundStarShell + 45,
      seed: 0x51a7f13d,
      pixelRatio,
      name: "Deterministic distant stellar sphere",
    });
    this.parallaxStars = createStarField({
      count: this.quality.parallaxStars,
      minimumRadius: radii.parallaxMinimum,
      maximumRadius: radii.parallaxMaximum,
      seed: 0x77bc3e19,
      pixelRatio,
      name: "Subtle mid-distance parallax stars",
      midDistance: true,
    });
    this.milkyWay = createMilkyWayBackground({
      count: this.quality.galacticStars,
      radius: radii.milkyWayShell,
      pixelRatio,
      rotation: SPACE_ENVIRONMENT_CONFIG.milkyWayRotation,
    });
    this.heroStars = createHeroStarField({
      count: this.quality.heroStars,
      radius: radii.heroStarShell,
      pixelRatio,
    });
    this.galaxies = createGalaxyField({
      count: this.quality.galaxies,
      radius: radii.galaxyShell,
    });
    this.dust = createCosmicDustField({
      count: this.quality.dust,
      maximumRadius: radii.dustMaximum,
      pixelRatio,
    });
    this.zodiacalLight = createZodiacalLight({ radius: radii.parallaxMaximum + 140 });

    this.layers.push(
      this.backgroundStars,
      this.parallaxStars,
      this.milkyWay,
      this.heroStars,
      this.galaxies,
      this.dust,
      this.zodiacalLight,
    );
    this.root.add(...this.layers.map((layer) => layer.object));
    this.scene.add(this.root);
    this.setQuality(this.qualityName);
    this.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    this.initialized = true;
    return this;
  }

  setJourneyProgress(progress) {
    this.stateController.setJourneyProgress(progress);
  }

  setSunPosition(position) {
    this.sunPosition.copy(position);
    this.hasSolarDirectionOverride = false;
  }

  /** Optional override for integrations with a directional solar-light model. */
  setSolarDirection(direction) {
    this.sunDirection.copy(direction).normalize();
    this.hasSolarDirectionOverride = true;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  /**
   * Updates uniforms only. Static star/galaxy buffer attributes never return to
   * the CPU, avoiding geometry uploads and allocations inside the render loop.
   */
  update(deltaTime, elapsedTime) {
    if (!this.initialized || this.paused) return this.stateController.state;
    const state = this.stateController.update(deltaTime);
    if (!this.hasSolarDirectionOverride) {
      this.sunDirection.copy(this.sunPosition).sub(this.camera.position);
      if (this.sunDirection.lengthSq() < 1e-8) this.sunDirection.set(0, 0, -1);
      else this.sunDirection.normalize();
    }

    this.renderer.toneMappingExposure = state.rendererExposure;
    const context = this.updateContext;
    context.time = elapsedTime;
    context.exposure = state.backgroundContrast;
    context.solarSuppression = state.solarGlare;
    context.reducedMotion = this.reducedMotion;
    context.contrast = state.backgroundContrast;
    context.visibility = state.starVisibility;
    this.backgroundStars.update(context);
    context.visibility = state.starVisibility * (0.20 + state.journeyProgress * 0.20);
    this.parallaxStars.update(context);
    context.visibility = state.milkyWayVisibility;
    this.milkyWay.update(context);
    context.visibility = this.quality.heroStarsEnabled ? state.heroStarVisibility : 0;
    this.heroStars.update(context);
    context.visibility = this.quality.galaxiesEnabled ? state.galaxyVisibility : 0;
    this.galaxies.update(context);
    context.visibility = this.quality.dustEnabled ? state.dustVisibility : 0;
    this.dust.update(context);
    context.visibility = this.quality.zodiacalLightEnabled ? state.zodiacalGlow : 0;
    this.zodiacalLight.update(context);
    return state;
  }

  resize(width, height, requestedPixelRatio = window.devicePixelRatio) {
    const pixelRatio = Math.min(requestedPixelRatio, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.layers.forEach((layer) => layer.resize?.(pixelRatio));
  }

  /**
   * Runtime quality changes hide optional layers and adjust pixel density.
   * Population counts are selected during init to avoid a disruptive rebuild.
   */
  setQuality(presetName) {
    const preset = QUALITY_PRESETS[presetName];
    if (!preset) return;
    this.qualityName = presetName;
    this.quality = preset;
    if (this.heroStars) this.heroStars.object.visible = preset.heroStarsEnabled;
    if (this.galaxies) this.galaxies.object.visible = preset.galaxiesEnabled;
    if (this.dust) this.dust.object.visible = preset.dustEnabled;
    if (this.zodiacalLight) this.zodiacalLight.object.visible = preset.zodiacalLightEnabled;
  }

  dispose() {
    this.motionQuery.removeEventListener?.("change", this.handleMotionPreference);
    this.layers.forEach((layer) => layer.dispose?.());
    this.root.removeFromParent();
    this.layers.length = 0;
    this.initialized = false;
  }
}

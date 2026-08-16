import * as THREE from "three";
import { EnvironmentStateController } from "./environmentStateController.js";
import {
  QUALITY_PRESETS,
  SPACE_ENVIRONMENT_CONFIG,
} from "./spaceEnvironmentConfig.js";
import { createZodiacalLight } from "./zodiacalLight.js";

/**
 * Public facade for every non-planetary space layer.
 *
 * Main.js supplies journey progress, time, and resize events. Internal systems
 * remain private so the application cannot accidentally desynchronize star,
 * galaxy, dust, exposure, and solar-glare transitions.
 */
export class SpaceEnvironment {
  constructor({ scene, camera, renderer, quality = null, pixelRatio = window.devicePixelRatio }) {
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
    this.sunAngularRadius = 0;
    this.hasSolarDirectionOverride = false;
    this.updateContext = {
      time: 0,
      visibility: 0,
      exposure: 1,
      solarSuppression: 1,
      sunDirection: this.sunDirection,
      sunPosition: this.sunPosition,
      sunAngularRadius: 0,
      reducedMotion: false,
      contrast: 1,
    };

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.handleMotionPreference = (event) => {
      this.reducedMotion = event.matches;
    };
    this.motionQuery.addEventListener?.("change", this.handleMotionPreference);

    this.qualityName = QUALITY_PRESETS[quality] ? quality : "medium";
    this.quality = QUALITY_PRESETS[this.qualityName];
    this.pixelRatio = Math.max(0.5, Number(pixelRatio) || 1);
  }

  /** Builds all geometry once. No texture downloads or per-frame compilation occur. */
  async init() {
    if (this.initialized) return this;
    const radii = SPACE_ENVIRONMENT_CONFIG.radii;

    this.zodiacalLight = this.quality.zodiacalLightEnabled
      ? createZodiacalLight({ radius: radii.zodiacalLightShell })
      : null;

    this.layers.push(...[this.zodiacalLight].filter(Boolean));
    if (this.layers.length) {
      this.root.add(...this.layers.map((layer) => layer.object));
    }
    // The root must join the scene even when every layer is disabled, so that
    // re-enabling one later does not silently render nothing.
    this.scene.add(this.root);
    this.setQuality(this.qualityName);
    this.resize(window.innerWidth, window.innerHeight, this.pixelRatio);
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

  /** Sets the physical photosphere's current apparent angular radius in radians. */
  setSunAngularRadius(radians) {
    this.sunAngularRadius = Math.max(0, Number(radians) || 0);
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
    context.sunAngularRadius = this.sunAngularRadius;
    context.exposure = state.backgroundContrast;
    context.solarSuppression = state.solarGlare;
    context.reducedMotion = this.reducedMotion;
    context.contrast = state.backgroundContrast;
    context.journeyProgress = state.journeyProgress;
    context.visibility = state.zodiacalGlow;
    this.zodiacalLight?.update(context);
    return state;
  }

  resize(width, height, requestedPixelRatio = window.devicePixelRatio) {
    // The application owns renderer pixel density. The environment mirrors the
    // fixed cinematic value into point-size uniforms.
    this.pixelRatio = Math.max(0.5, Number(requestedPixelRatio) || 1);
    this.layers.forEach((layer) => layer.resize?.(this.pixelRatio));
    return this.pixelRatio;
  }

  /**
   * Runtime quality changes hide optional layers and adjust active populations.
   * Pixel density is supplied separately; geometry capacity is selected once
   * during init and remains on the fixed cinematic profile.
   */
  setQuality(presetName) {
    const preset = QUALITY_PRESETS[presetName];
    if (!preset) return;
    this.qualityName = presetName;
    this.quality = preset;

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

/**
 * Texture-loading layer.
 *
 * Network work is kept outside the scene builder. Callers receive a simple
 * dictionary such as `{ earth: Texture, moon: Texture }` and do not need to
 * understand callbacks, color spaces, wrapping, or fallback behavior.
 */
import * as THREE from "three";
import { OPTIONAL_TEXTURES, TEXTURE_BACKUP_URLS, TEXTURE_FALLBACKS, TEXTURE_URLS } from "../config/textures.js";
import { makeNoiseTexture } from "./proceduralTextures.js";

// A remote image request is allowed a finite total budget. TextureLoader can
// otherwise wait forever when a host accepts a connection but never finishes
// the response, leaving the HTML interface visible while the 3D universe never
// reaches its first frame.
const TEXTURE_LOAD_BUDGET_MS = 6500;

// Earth and the Moon are visible in the opening shot. Their primary surface
// maps must be ready before the first 3D frame is constructed; otherwise the
// procedural streaming bridge is visible for a few seconds and then visibly
// "pops" into the real texture after the loader has already disappeared.
//
// Only these essential opening maps are blocking. Heavy optional layers such as
// Earth clouds/lights and every distant-planet remote texture still stream in
// the background, so this does not bring back the old all-assets startup stall.
const OPENING_CRITICAL_TEXTURES = new Set([
  "earth",
  "moon",
  "moonDisplacement",
]);

/**
 * Creates a tiny, GPU-friendly texture for optional image layers.
 *
 * Optional maps need a real Texture object during the first frame so the
 * material can keep a stable reference while its network image is loading.
 * The chosen pixel represents a visually neutral value for each map:
 * - a flat normal points directly away from the surface;
 * - black cloud/light maps contribute nothing;
 * - a white ring map leaves Saturn's material colour unchanged.
 */
function createNeutralTexture(name) {
  const neutralPixels = {
    earthNormal: [128, 128, 255, 255],
    earthClouds: [0, 0, 0, 255],
    earthLights: [0, 0, 0, 255],
    saturnRing: [255, 255, 255, 255],
  };
  const [red, green, blue, alpha] = neutralPixels[name] ?? [255, 255, 255, 255];
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
  context.fillRect(0, 0, 1, 1);

  // This must remain a plain Texture—not DataTexture or CanvasTexture. The
  // remote upgrade later changes its image from a canvas to an HTML image, and
  // renderer upload logic branches on those specialised texture class flags.
  // Keeping a stable base class prevents corrupt normal-map uploads on Earth.
  const texture = new THREE.Texture(canvas);

  texture.colorSpace = ["earthLights", "saturnRing"].includes(name)
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.userData.isFallback = true;
  texture.userData.isStreamingPlaceholder = true;

  return texture;
}

/**
 * Creates the surface shown while a required remote image is still in flight.
 *
 * A 512px bridge carries enough colour structure for the opening camera while
 * keeping its creation and first GPU upload below a visible startup hitch. The
 * real remote image still replaces it in place as soon as it is available.
 */
function createStreamingPlaceholder(name, fallbackKind) {
  let texture;
  if (OPTIONAL_TEXTURES.has(name)) {
    texture = createNeutralTexture(name);
  } else {
    const generatedTexture = makeNoiseTexture(fallbackKind, 512);

    // CanvasTexture is convenient for generating the fallback, but the live
    // upgrade may replace that canvas with an HTML image. Copy its presentation
    // into a base Texture so Three.js uses one valid upload path for both.
    texture = new THREE.Texture(generatedTexture.image);
    texture.colorSpace = generatedTexture.colorSpace;
    texture.wrapS = generatedTexture.wrapS;
    texture.wrapT = generatedTexture.wrapT;
    texture.minFilter = generatedTexture.minFilter;
    texture.magFilter = generatedTexture.magFilter;
    texture.generateMipmaps = generatedTexture.generateMipmaps;
    texture.needsUpdate = true;
    generatedTexture.dispose();
  }

  texture.userData.isFallback = true;
  texture.userData.isStreamingPlaceholder = true;
  texture.userData.textureName = name;
  return texture;
}

/**
 * Replaces a placeholder's image without replacing the Texture object itself.
 *
 * Every material and shader already points at `target`, so mutating that object
 * lets the real image appear automatically without rebuilding planets, rings,
 * cloud layers, raycast targets, or the animation system.
 */
function upgradeTextureInPlace(target, source) {
  if (!target || !source || target === source) return;

  target.image = source.image;
  target.mapping = source.mapping;
  target.channel = source.channel;
  target.wrapS = source.wrapS;
  target.wrapT = source.wrapT;
  target.magFilter = source.magFilter;
  target.minFilter = source.minFilter;
  target.anisotropy = source.anisotropy;
  target.format = source.format;
  target.internalFormat = source.internalFormat;
  target.type = source.type;
  target.colorSpace = source.colorSpace;
  target.flipY = source.flipY;
  target.generateMipmaps = source.generateMipmaps;
  target.premultiplyAlpha = source.premultiplyAlpha;
  target.unpackAlignment = source.unpackAlignment;
  target.userData = {
    ...target.userData,
    ...source.userData,
    isStreamingPlaceholder: false,
  };
  target.needsUpdate = true;

  // The temporary loader texture is no longer referenced. Its decoded image is
  // now owned through `target`, while dispose releases only its WebGL handle.
  source.dispose();
}

/** Loads one image, tries a backup URL, then supplies a procedural fallback. */
function loadTexture(loader, url, fallbackKind, options = {}) {
  const candidates = [url, ...(options.backupUrls ?? [])].filter(Boolean);
  const startedAt = performance.now();

  return new Promise((resolve) => {
    let promiseSettled = false;

    const resolveOnce = (texture) => {
      if (promiseSettled) {
        // A timed-out browser request may still finish later. It is no longer
        // used by the scene, so release its GPU-side image rather than leaking.
        texture?.dispose?.();
        return;
      }
      promiseSettled = true;
      resolve(texture);
    };

    const resolveFallback = (failedUrl, reason = "failed") => {
      console.warn(`[Beyond Earth] Texture ${reason}: ${failedUrl}`);
      if (options.optional) {
        resolveOnce(null);
        return;
      }

      // Non-blocking remote loads already have a visible bridge texture. Reuse
      // it instead of generating another large procedural map several seconds
      // later, which previously caused a noticeable post-load hitch.
      if (options.fallbackTexture) {
        options.fallbackTexture.userData.failedUrl = failedUrl;
        options.fallbackTexture.userData.fallbackReason = reason;
        resolveOnce(options.fallbackTexture);
        return;
      }

      const fallback = makeNoiseTexture(fallbackKind);
      fallback.userData.isFallback = true;
      fallback.userData.failedUrl = failedUrl;
      fallback.userData.fallbackReason = reason;
      resolveOnce(fallback);
    };

    const attempt = (candidateIndex) => {
      const candidateUrl = candidates[candidateIndex];
      if (!candidateUrl) {
        resolveFallback(url, "has no usable source");
        return;
      }

      const remainingBudget = Math.max(
        0,
        (options.timeoutMs ?? TEXTURE_LOAD_BUDGET_MS) - (performance.now() - startedAt),
      );
      if (remainingBudget <= 0) {
        resolveFallback(candidateUrl, "timed out");
        return;
      }

      let attemptSettled = false;
      const finishAttempt = (callback) => {
        if (attemptSettled || promiseSettled) return false;
        attemptSettled = true;
        clearTimeout(timeoutId);
        callback();
        return true;
      };
      const remainingCandidates = Math.max(1, candidates.length - candidateIndex);
      const timeoutId = setTimeout(() => {
        finishAttempt(() => {
          if (candidateIndex + 1 < candidates.length) {
            console.warn(`[Beyond Earth] Texture timed out; trying backup: ${candidateUrl}`);
            attempt(candidateIndex + 1);
          } else {
            resolveFallback(candidateUrl, "timed out");
          }
        });
      }, Math.max(900, remainingBudget / remainingCandidates));

      loader.load(
        candidateUrl,
        (texture) => {
          const accepted = finishAttempt(() => {
            // Colour maps are decoded as sRGB. Height, normal and cloud-mask data
            // remain linear so their numeric values are not gamma transformed.
            if (options.color !== false) texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = options.anisotropy ?? 4;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            texture.userData.sourceUrl = candidateUrl;
            texture.userData.isFallback = candidateIndex > 0;
            resolveOnce(texture);
          });
          if (!accepted) texture.dispose();
        },
        undefined,
        () => {
          finishAttempt(() => {
            if (candidateIndex + 1 < candidates.length) {
              console.warn(`[Beyond Earth] Texture failed; trying backup: ${candidateUrl}`);
              attempt(candidateIndex + 1);
              return;
            }
            resolveFallback(candidateUrl);
          });
        },
      );
    };

    attempt(0);
  });
}

/**
 * Loads the universe texture dictionary without allowing the public internet to
 * hold the first WebGL frame hostage.
 *
 * Local project textures remain part of startup because they are served with
 * the app and resolve quickly. Remote NASA/Three.js maps receive an immediate
 * bridge texture and continue loading in the background. When one succeeds,
 * `upgradeTextureInPlace` swaps its pixels into the already-rendered material.
 */
export async function loadUniverseTextures({ anisotropy = 4 } = {}) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const textures = {};
  const startupTextureJobs = [];

  Object.entries(TEXTURE_URLS).forEach(([name, url]) => {
    const fallbackKind = TEXTURE_FALLBACKS[name] ?? name;
    const options = {
      optional: OPTIONAL_TEXTURES.has(name),
      backupUrls: TEXTURE_BACKUP_URLS[name] ? [TEXTURE_BACKUP_URLS[name]] : [],
      color: !["earthNormal", "earthClouds", "moonDisplacement"].includes(name),
      anisotropy,
    };

    if (/^https?:\/\//i.test(url)) {
      const isOpeningCritical = OPENING_CRITICAL_TEXTURES.has(name);

      if (isOpeningCritical) {
        // Earth/Moon are the opening heroes. Await their real image (or backup)
        // while the HTML loader is still present so the first visible frame is
        // already final-quality instead of changing 2–3 seconds later.
        startupTextureJobs.push(
          loadTexture(loader, url, fallbackKind, options).then((texture) => {
            textures[name] = texture;
          }),
        );
        return;
      }

      const placeholder = createStreamingPlaceholder(name, fallbackKind);
      textures[name] = placeholder;

      // All non-critical remote maps remain non-blocking. Their placeholders are
      // upgraded in place once the network image arrives, preserving the fast
      // opening path for Jupiter/Saturn/Uranus and optional Earth layers.
      loadTexture(loader, url, fallbackKind, {
        ...options,
        fallbackTexture: placeholder,
      }).then((loadedTexture) => {
        if (loadedTexture && loadedTexture !== placeholder) {
          upgradeTextureInPlace(placeholder, loadedTexture);
        }
      });
      return;
    }

    // Bundled surface maps are dependable and should be ready before their
    // planets are constructed, avoiding a visible low-to-high detail pop.
    startupTextureJobs.push(
      loadTexture(loader, url, fallbackKind, options).then((texture) => {
        textures[name] = texture;
      }),
    );
  });

  await Promise.all(startupTextureJobs);

  return textures;
}

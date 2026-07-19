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

/** Loads one image, tries a backup URL, then supplies a procedural fallback. */
function loadTexture(loader, url, fallbackKind, options = {}) {
  const candidates = [url, ...(options.backupUrls ?? [])].filter(Boolean);

  return new Promise((resolve) => {
    const attempt = (candidateIndex) => {
      const candidateUrl = candidates[candidateIndex];
      loader.load(
        candidateUrl,
        (texture) => {
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
          resolve(texture);
        },
        undefined,
        () => {
          if (candidateIndex + 1 < candidates.length) {
            console.warn(`[Beyond Earth] Texture failed; trying backup: ${candidateUrl}`);
            attempt(candidateIndex + 1);
            return;
          }

          console.warn(`[Beyond Earth] Texture failed to load: ${candidateUrl}`);
          if (options.optional) {
            resolve(null);
            return;
          }

          const fallback = makeNoiseTexture(fallbackKind);
          fallback.userData.isFallback = true;
          fallback.userData.failedUrl = candidateUrl;
          resolve(fallback);
        },
      );
    };

    attempt(0);
  });
}

/** Loads all universe textures in parallel and returns them by their semantic names. */
export async function loadUniverseTextures({ anisotropy = 4 } = {}) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const textures = {};

  // Promise.all starts every download together and waits until all have settled.
  await Promise.all(Object.entries(TEXTURE_URLS).map(async ([name, url]) => {
    textures[name] = await loadTexture(loader, url, TEXTURE_FALLBACKS[name] ?? name, {
      optional: OPTIONAL_TEXTURES.has(name),
      backupUrls: TEXTURE_BACKUP_URLS[name] ? [TEXTURE_BACKUP_URLS[name]] : [],
      color: !["earthNormal", "earthClouds", "moonDisplacement"].includes(name),
      anisotropy,
    });
  }));

  return textures;
}

/**
 * Texture-loading layer.
 *
 * Network work is kept outside the scene builder. Callers receive a simple
 * dictionary such as `{ earth: Texture, moon: Texture }` and do not need to
 * understand callbacks, color spaces, wrapping, or fallback behavior.
 */
import * as THREE from "three";
import { OPTIONAL_TEXTURES, TEXTURE_FALLBACKS, TEXTURE_URLS } from "../config/textures.js";
import { makeNoiseTexture } from "./proceduralTextures.js";

/** Loads one image and supplies a procedural surface when a required asset fails. */
function loadTexture(loader, url, fallbackKind, options = {}) {
  // TextureLoader uses callbacks, so a Promise lets the caller use async/await.
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        // Most color images must be decoded as sRGB. Normal maps store numbers,
        // not colors, so the caller deliberately sets `color: false` for them.
        if (options.color !== false) texture.colorSpace = THREE.SRGBColorSpace;
        // Anisotropy keeps a texture sharper when its surface is viewed at an angle.
        texture.anisotropy = options.anisotropy ?? 4;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.userData.sourceUrl = url;
        texture.userData.isFallback = false;
        resolve(texture);
      },
      undefined,
      // Optional detail layers may safely be null. Required planet surfaces get
      // a generated canvas texture so one failed URL cannot break the whole scene.
      () => {
        console.warn(`[Beyond Earth] Texture failed to load: ${url}`);
        if (options.optional) {
          resolve(null);
          return;
        }
        const fallback = makeNoiseTexture(fallbackKind);
        fallback.userData.isFallback = true;
        fallback.userData.failedUrl = url;
        resolve(fallback);
      },
    );
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
      color: name !== "earthNormal",
      anisotropy,
    });
  }));

  return textures;
}

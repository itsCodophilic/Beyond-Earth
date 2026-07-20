/**
 * Procedural texture generators.
 *
 * These functions draw normal 2D Canvas graphics, then wrap each canvas in a
 * THREE.CanvasTexture so WebGL can use it on a 3D material. They provide useful
 * offline fallbacks and are also easy places to experiment with visual styles.
 */
import * as THREE from "three";

/*
  makeNoiseTexture
  - Procedurally generates a planet-like canvas texture for bodies without external imagery.
*/
export function makeNoiseTexture(kind, size = 1024) {
  // Planet maps use a 2:1 rectangle because that ratio wraps naturally around a sphere.
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size / 2;
  const ctx = textureCanvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, size, size / 2);
  // Each body gets a recognisable three-color base even without downloaded images.
  const palettes = {
    mercury: ["#5f5a55", "#aaa092", "#373534"],
    venus: ["#b58a57", "#f1d6a1", "#8a643f"],
    earth: ["#053f92", "#1784ca", "#041d50"],
    moon: ["#d8d3c8", "#7a7770", "#353331"],
    mars: ["#8c321e", "#d06a37", "#4d1d17"],
    jupiter: ["#6d442a", "#d8b58b", "#f1dfc8"],
    saturn: ["#8ea0a2", "#f2e4ca", "#b7a38f"],
    uranus: ["#78d6df", "#c0f4f6", "#4f93a6"],
    neptune: ["#183f9a", "#4a7dff", "#091f56"],
    pluto: ["#8d766d", "#d7cec0", "#4c3b39"],
    sun: ["#ff7a18", "#ffd166", "#b32013"],
  };
  const palette = palettes[kind] ?? palettes.earth;
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.48, palette[1]);
  gradient.addColorStop(1, palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size / 2);

  // Random translucent ellipses break up the perfect gradient and suggest terrain/clouds.
  for (let i = 0; i < 120; i += 1) {
    ctx.beginPath();
    const y = Math.random() * size * 0.5;
    const bandHeight = kind === "jupiter" || kind === "saturn" ? 8 + Math.random() * 28 : 3 + Math.random() * 24;
    ctx.ellipse(Math.random() * size, y, 36 + Math.random() * 150, bandHeight, Math.random() * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.18})`;
    ctx.fill();
  }

  if (kind === "moon" || kind === "mercury") {
    // Dark circles imitate impact craters on airless rocky bodies.
    for (let i = 0; i < 150; i += 1) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size * 0.5, 4 + Math.random() * 25, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20,20,20,${0.08 + Math.random() * 0.2})`;
      ctx.fill();
    }
  }

  if (kind === "mercury") {
    // MESSENGER revealed bright, shallow, irregular hollows that are distinct
    // from ordinary impact craters. These clustered pale pits preserve that
    // character when the local 2K map is unavailable.
    for (let cluster = 0; cluster < 12; cluster += 1) {
      const cx = Math.random() * size;
      const cy = Math.random() * size * 0.5;
      const clusterRadius = 18 + Math.random() * 34;
      const pitCount = 5 + Math.floor(Math.random() * 10);
      for (let pit = 0; pit < pitCount; pit += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * clusterRadius;
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance * 0.58;
        const radius = 1.4 + Math.random() * 4.6;
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,232,229,${0.14 + Math.random() * 0.16})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(38,40,40,${0.10 + Math.random() * 0.16})`;
        ctx.fill();
      }
    }
  }

  if (kind === "jupiter") {
    // Horizontal bands and two ellipses evoke Jupiter's storms and Great Red Spot.
    for (let y = 0; y < size / 2; y += 16) {
      ctx.fillStyle = y % 48 === 0 ? "rgba(95,50,28,0.34)" : "rgba(255,238,205,0.14)";
      ctx.fillRect(0, y + Math.sin(y * 0.08) * 5, size, 8 + Math.sin(y * 0.03) * 4);
    }
    ctx.beginPath();
    ctx.ellipse(size * 0.66, size * 0.29, 78, 32, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(166,71,42,0.78)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.66, size * 0.29, 45, 18, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(228,142,91,0.48)";
    ctx.fill();
  }

  if (kind === "saturn") {
    // Fine, complete latitude bands echo Saturn's circular cloud zones. The
    // dedicated 3D shader supplies the polar hexagon; this fallback only needs
    // the reference's ivory, sand and pearl-grey global colour structure.
    const saturnBands = [
      ["rgba(255,246,235,0.20)", 3],
      ["rgba(164,167,168,0.11)", 2],
      ["rgba(205,189,175,0.13)", 4],
      ["rgba(254,238,221,0.16)", 2],
    ];
    for (let y = 0; y < size / 2; y += 7) {
      const [color, height] = saturnBands[Math.floor(y / 7) % saturnBands.length];
      ctx.fillStyle = color;
      ctx.fillRect(0, y, size, height);
    }

    // Keep blue confined to the compact north-polar cap. The latitude band
    // immediately below it is neutral pearl-grey and taupe, not cyan.
    const northFade = ctx.createLinearGradient(0, 0, 0, size * 0.16);
    northFade.addColorStop(0, "rgba(15,47,102,0.82)");
    northFade.addColorStop(0.16, "rgba(61,138,152,0.50)");
    northFade.addColorStop(0.31, "rgba(145,157,158,0.30)");
    northFade.addColorStop(0.58, "rgba(184,164,143,0.20)");
    northFade.addColorStop(1, "rgba(215,203,185,0.0)");
    ctx.fillStyle = northFade;
    ctx.fillRect(0, 0, size, size * 0.16);

    // The reference also shows additional cool blue circular decks below the
    // main polar eye, so the offline fallback includes a few soft concentric
    // rings near the north pole instead of only a simple top fade.
    ctx.save();
    ctx.translate(size * 0.5, size * 0.06);
    const polarRings = [
      // Blue and lavender remain concentrated at the vortex and hexagonal cap.
      [size * 0.07, size * 0.042, "rgba(112,100,173,0.42)", 5],
      [size * 0.13, size * 0.070, "rgba(61,138,152,0.32)", 6],
      // Immediately below the cap: whitish scattered deck.
      [size * 0.23, size * 0.118, "rgba(230,227,220,0.26)", 8],
      // Then one subdued blue circular ring.
      [size * 0.32, size * 0.156, "rgba(88,128,145,0.18)", 8],
      // Beyond that, return to normal Saturn colours.
      [size * 0.41, size * 0.205, "rgba(199,188,172,0.16)", 10],
    ];
    polarRings.forEach(([rx, ry, color, width]) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    });
    ctx.restore();
  }

  if (kind === "venus") {
    // Venus is almost featureless in natural visible light, but spacecraft
    // filters reveal low-contrast east-west filaments, equatorial convection,
    // bright polar hoods and the planet-scale Y wave. Keep these details subtle.
    ctx.globalAlpha = 0.23;
    for (let i = 0; i < 54; i += 1) {
      const y = Math.random() * size * 0.5;
      const latitudeWeight = Math.abs(y / (size * 0.5) - 0.5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 24) {
        const wave = Math.sin(x * 0.016 + i * 0.74) * (9 + latitudeWeight * 13);
        const fine = Math.sin(x * 0.045 + i * 1.31) * 3;
        ctx.lineTo(x, y + wave + fine);
      }
      ctx.strokeStyle = i % 4 === 0 ? "#9b7248" : "#fff1cd";
      ctx.lineWidth = 4 + Math.random() * 9;
      ctx.stroke();
    }

    // Blockier equatorial cloud cells.
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 42; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size,
        size * (0.19 + Math.random() * 0.12),
        18 + Math.random() * 58,
        5 + Math.random() * 15,
        Math.random() * 0.25 - 0.125,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = i % 3 === 0 ? "#9b7148" : "#fff5d8";
      ctx.fill();
    }

    // High, bright polar haze caps.
    const polarGradient = ctx.createLinearGradient(0, 0, 0, size * 0.5);
    polarGradient.addColorStop(0, "rgba(255,248,221,0.44)");
    polarGradient.addColorStop(0.18, "rgba(255,245,215,0.08)");
    polarGradient.addColorStop(0.82, "rgba(255,245,215,0.08)");
    polarGradient.addColorStop(1, "rgba(255,248,221,0.44)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = polarGradient;
    ctx.fillRect(0, 0, size, size * 0.5);

    // A very restrained Y-shaped ultraviolet absorber pattern contributes
    // structure without converting the fallback into false-colour imagery.
    ctx.globalAlpha = 0.085;
    ctx.strokeStyle = "#765235";
    ctx.lineCap = "round";
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(size * 0.50, size * 0.28);
    ctx.lineTo(size * 0.50, size * 0.18);
    ctx.moveTo(size * 0.50, size * 0.20);
    ctx.bezierCurveTo(size * 0.43, size * 0.16, size * 0.36, size * 0.10, size * 0.28, size * 0.08);
    ctx.moveTo(size * 0.50, size * 0.20);
    ctx.bezierCurveTo(size * 0.57, size * 0.16, size * 0.64, size * 0.10, size * 0.72, size * 0.08);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (kind === "mars") {
    ctx.fillStyle = "rgba(255,235,210,0.75)";
    ctx.fillRect(0, 0, size, 24);
    ctx.fillRect(0, size / 2 - 26, size, 26);
  }

  if (kind === "neptune") {
    ctx.beginPath();
    ctx.ellipse(size * 0.58, size * 0.27, 58, 25, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(9,22,70,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(220,245,255,0.45)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(size * 0.1, size * 0.2);
    ctx.bezierCurveTo(size * 0.32, size * 0.16, size * 0.52, size * 0.24, size * 0.9, size * 0.18);
    ctx.stroke();
  }


  if (kind === "pluto") {
    // Pale nitrogen-ice plains and reddish tholin-rich terrain evoke the
    // New Horizons visible-light appearance without requiring a remote asset.
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#efe8d9";
    ctx.beginPath();
    ctx.ellipse(size * 0.63, size * 0.24, size * 0.12, size * 0.095, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a4b48";
    ctx.beginPath();
    ctx.ellipse(size * 0.22, size * 0.30, size * 0.22, size * 0.10, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let index = 0; index < 52; index += 1) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size * 0.5, 2 + Math.random() * 13, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(55,42,41,${0.04 + Math.random() * 0.12})`;
      ctx.fill();
    }
  }

  if (kind === "uranus") {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#e7ffff";
    for (let y = 18; y < size / 2; y += 42) ctx.fillRect(0, y, size, 5);
    ctx.globalAlpha = 1;
  }

  // CanvasTexture watches this canvas as the pixel source for a GPU texture.
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/*
  makeRockTexture
  - Builds a rugged rock canvas texture used for asteroids and small debris.
*/
export function makeRockTexture() {
  const size = 256;
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext("2d");
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#4a4036");
  base.addColorStop(0.5, "#8b7a67");
  base.addColorStop(1, "#27231f");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Thousands of tiny rectangles add high-frequency grain to otherwise flat rocks.
  for (let i = 0; i < 1200; i += 1) {
    const shade = 40 + Math.random() * 130;
    ctx.fillStyle = `rgba(${shade},${shade * 0.9},${shade * 0.76},${0.05 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  for (let i = 0; i < 34; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 5 + Math.random() * 22, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(20,18,15,${0.08 + Math.random() * 0.18})`;
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Repeat wrapping prevents stretched edges when the map is reused on rock shapes.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/*
  makeGlowTexture
  - Creates a soft radial glow texture for sprites and halo effects.
*/
export function makeGlowTexture() {
  // A radial alpha fade produces a soft billboard/sprite instead of a hard square.
  const size = 128;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.88)");
  gradient.addColorStop(0.52, "rgba(134,213,255,0.25)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(sprite);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

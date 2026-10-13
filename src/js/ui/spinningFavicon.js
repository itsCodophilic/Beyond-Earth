/**
 * The tab icon: a small Earth that turns (round 72, the owner: "our own
 * favicon, an Earth shape which spins").
 *
 * Browsers do not animate favicons themselves (an animated SVG or GIF icon is
 * shown frozen in most of them), so the page draws one: a 64 px sphere,
 * shaded from the upper left, tilted 23.4 degrees like the real Earth,
 * textured from a 128 x 64 map of the Earth (public/favicon-earth-map.png,
 * made from the site's own earth-no-clouds.jpg), and handed to the <link
 * rel="icon"> about twelve times a second. One turn every eight seconds.
 *
 * Cheap on purpose: everything about each pixel except its longitude is
 * worked out once, so a frame is 3,200 texture look-ups and one toDataURL of
 * a 64 px canvas. A background tab's timers are throttled to once a second
 * by the browser, which is all a tab strip needs. With reduced motion asked
 * for, the static public/favicon.png stays.
 */
const SIZE = 64;
const TURN_SECONDS = 8;
const FRAME_MS = 83;
const TILT = (23.4 * Math.PI) / 180;

export function startSpinningFavicon({ mapUrl, link = document.querySelector('link[rel~="icon"]') } = {}) {
  if (!link || !mapUrl) return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(SIZE, SIZE);

  const map = new Image();
  map.decoding = "async";
  map.src = mapUrl;
  let timer = null;

  map.onload = () => {
    const w = map.naturalWidth;
    const h = map.naturalHeight;
    const reader = document.createElement("canvas");
    reader.width = w;
    reader.height = h;
    const readerCtx = reader.getContext("2d");
    readerCtx.drawImage(map, 0, 0);
    const texels = readerCtx.getImageData(0, 0, w, h).data;

    // Per pixel, once: where it is on the globe, how lit, how much limb glow,
    // and how much of the pixel the disc covers (for a smooth edge).
    const centre = (SIZE - 1) / 2;
    const radius = SIZE / 2 - 0.5;
    const light = [-0.55, -0.45, 0.7];
    const len = Math.hypot(...light);
    const pixels = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const nx = (x - centre) / radius;
        const ny = (y - centre) / radius;
        const r = Math.hypot(nx, ny);
        if (r > 1 + 1 / radius) continue;
        const cover = Math.max(0, Math.min(1, (1 - r) * radius + 0.5));
        const r2 = Math.min(1, nx * nx + ny * ny);
        const nz = Math.sqrt(1 - r2);
        const tx = nx * Math.cos(TILT) + ny * Math.sin(TILT);
        const ty = -nx * Math.sin(TILT) + ny * Math.cos(TILT);
        const lat = Math.asin(Math.max(-1, Math.min(1, -ty)));
        const lon = Math.atan2(tx, nz);
        const shade = 0.28 + 0.72 * Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / len);
        const rim = (1 - nz) ** 3 * 0.55;
        const v = Math.min(h - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * h)));
        pixels.push({ at: (y * SIZE + x) * 4, lon, row: v * w, shade, rim, cover });
      }
    }

    const draw = () => {
      const phase = ((performance.now() / 1000) / TURN_SECONDS) * Math.PI * 2;
      const data = image.data;
      for (let i = 0; i < pixels.length; i += 1) {
        const p = pixels[i];
        const u = ((((p.lon + phase) / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
        const t = (p.row + Math.floor(u * w)) * 4;
        data[p.at] = Math.min(255, texels[t] * p.shade + 90 * p.rim);
        data[p.at + 1] = Math.min(255, texels[t + 1] * p.shade + 160 * p.rim);
        data[p.at + 2] = Math.min(255, texels[t + 2] * p.shade + 255 * p.rim);
        data[p.at + 3] = 255 * p.cover;
      }
      ctx.putImageData(image, 0, 0);
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");
    };
    draw();
    timer = setInterval(draw, FRAME_MS);
  };

  return {
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

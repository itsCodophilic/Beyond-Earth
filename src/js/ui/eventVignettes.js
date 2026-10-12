/**
 * Small animated pictures of each space event, for the Space events
 * carousel (round 43; the owner chose concept C, "Cosmic carousel", from
 * prototypes/space-events-concepts.html).
 *
 * Each is a 2D canvas sketch of what the event is -- a coronal mass ejection
 * leaving the limb, a plume over Io, the Moon sliding across the Sun -- drawn
 * from `t` (seconds) so it loops. They are previews, not the event: the
 * event itself is staged in the 3D scene when "Go watch it" is pressed.
 */

export const FAMILY_COLOURS = Object.freeze({
  solar: "#ffb347",
  planetary: "#e8c48f",
  smallBody: "#8fd3ff",
  impact: "#ff7a59",
  ring: "#f3e3a6",
  surface: "#9ff0c4",
  alignment: "#b9a4ff",
  deepSky: "#ff8fd8",
  origins: "#d6b8ff",
  fields: "#5fe0e8",
  orbit: "#7fb2ff",
});

const rand = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function stars(ctx, w, h, n, t, seed = 1) {
  for (let i = 0; i < n; i += 1) {
    const x = rand(i + seed) * w;
    const y = rand(i * 3.7 + seed) * h;
    const a = 0.25 + 0.5 * rand(i * 9.1 + seed) * (0.7 + 0.3 * Math.sin(t * 1.5 + i));
    const big = rand(i * 2.3) > 0.92 ? 1.6 : 1;
    ctx.fillStyle = `rgba(230,236,255,${a})`;
    ctx.fillRect(x, y, big, big);
  }
}
function glow(ctx, x, y, r, c, a = 1) {
  if (!(r > 0)) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
function disc(ctx, x, y, r, inner, outer) {
  if (!(r > 0)) return;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws event `ev` ({ id, family }) into a w x h canvas at time t. */
export function drawEventVignette(ctx, w, h, t, ev) {
  ctx.fillStyle = "#020309";
  ctx.fillRect(0, 0, w, h);
  stars(ctx, w, h, Math.round((w * h) / 900), t, ev.id.length);
  const m = Math.min(w, h);
  const id = ev.id;
  if (id === "solar-cme" || id === "sungrazer") {
    const sx = w * 0.18; const sy = h * 0.55; const R = m * 0.42;
    glow(ctx, sx, sy, R * 2.1, "rgba(255,170,70,.45)");
    disc(ctx, sx, sy, R, "#fff1c4", "#ff8a1f");
    if (id === "solar-cme") {
      const p = (t * 0.35) % 1;
      ctx.strokeStyle = `rgba(255,190,120,${1 - p})`;
      ctx.lineWidth = 2 + 6 * (1 - p);
      ctx.beginPath();
      ctx.ellipse(sx + R + p * w * 0.55, sy - p * h * 0.15, R * 0.25 + p * m * 0.55, R * 0.18 + p * m * 0.42, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 40; i += 1) {
        const a = rand(i) * Math.PI - Math.PI / 2; const d = R + p * w * 0.6 * rand(i + 5);
        ctx.fillStyle = `rgba(255,220,170,${(1 - p) * 0.8})`;
        ctx.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 2, 2);
      }
    } else {
      const p = (t * 0.25) % 1; const x = w * (1.05 - p * 0.75); const y = h * (0.05 + p * 0.45);
      if (p < 0.85) {
        const tail = ctx.createLinearGradient(x, y, x + w * 0.35, y - h * 0.25);
        tail.addColorStop(0, "rgba(180,225,255,.9)");
        tail.addColorStop(1, "rgba(180,225,255,0)");
        ctx.strokeStyle = tail; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.35, y - h * 0.25); ctx.stroke();
        glow(ctx, x, y, 10, "rgba(220,240,255,1)");
      } else glow(ctx, sx + R, sy - R * 0.4, m * 0.25 * (1 - (p - 0.85) / 0.15), "rgba(255,255,230,.9)");
    }
  } else if (["jupiter-impact", "saturn-impact", "lunar-impact-flash"].includes(id)) {
    const cx = w * 0.5; const cy = h * 1.9; const R = h * 1.55;
    const body = id === "jupiter-impact" ? ["#e9cfa6", "#7a4a26"] : id === "saturn-impact" ? ["#f1e2b8", "#8a6f3e"] : ["#cfcfcf", "#4a4a4a"];
    disc(ctx, cx, cy, R, body[0], body[1]);
    if (id !== "lunar-impact-flash") {
      for (let b = 0; b < 7; b += 1) {
        ctx.strokeStyle = `rgba(90,50,20,${0.15 + 0.1 * (b % 2)})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, R - 14 - b * 16), Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
    }
    for (let i = 0; i < 4; i += 1) {
      const p = (t * 0.6 + i * 0.27) % 1;
      const a = Math.PI * (1.2 + 0.6 * rand(i + Math.floor(t * 0.6 + i * 0.27)));
      const x = cx + Math.cos(a) * (R - 6); const y = cy + Math.sin(a) * (R - 6);
      if (p < 0.5) {
        ctx.strokeStyle = `rgba(255,220,180,${0.8 - p})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 60 * (0.5 - p) * 2, y - 80 * (0.5 - p) * 2); ctx.lineTo(x - 10 * (0.5 - p), y - 14 * (0.5 - p)); ctx.stroke();
      } else glow(ctx, x, y, 6 + 40 * (1 - p) * 2 * (p - 0.5) * 4, `rgba(255,${id === "lunar-impact-flash" ? 210 : 190},140,1)`, 1 - (p - 0.5) * 2);
    }
  } else if (["io-eruption", "enceladus-plumes", "triton-geysers"].includes(id)) {
    const cx = w * 0.5; const cy = h * 1.7; const R = h * 1.2;
    const body = id === "io-eruption" ? ["#f3e07a", "#9a6a1c"] : id === "enceladus-plumes" ? ["#f4fbff", "#8aa3b8"] : ["#f2d9d1", "#8a6f72"];
    disc(ctx, cx, cy, R, body[0], body[1]);
    const n = id === "enceladus-plumes" ? 4 : 2;
    for (let v = 0; v < n; v += 1) {
      const vx = cx + (v - (n - 1) / 2) * w * 0.18; const vy = cy - R + 4 + Math.abs(v - (n - 1) / 2) * 6;
      for (let i = 0; i < 70; i += 1) {
        const life = (t * 0.5 + rand(i + v * 99)) % 1; const spread = rand(i * 2 + v) - 0.5;
        const height = h * (id === "io-eruption" ? 0.75 : id === "enceladus-plumes" ? 0.7 : 0.35);
        let x = vx + spread * life * w * (id === "io-eruption" ? 0.22 : 0.08);
        let y = vy - Math.sin(life * Math.PI * (id === "io-eruption" ? 0.95 : 0.6)) * height;
        if (id === "triton-geysers") { x = vx + life * life * w * 0.35; y = vy - Math.min(life * 3, 1) * height; }
        const col = id === "io-eruption" ? `rgba(255,${Math.round(200 + 40 * rand(i))},120,` : id === "enceladus-plumes" ? "rgba(210,240,255," : "rgba(60,50,55,";
        ctx.fillStyle = `${col}${(1 - life) * 0.9})`;
        ctx.fillRect(x, y, 1.8, 1.8);
      }
    }
  } else if (id === "meteor-shower") {
    const cx = w * 0.5; const cy = h * 2.2; const R = h * 1.6;
    glow(ctx, cx, cy - R, w * 0.6, "rgba(90,150,255,.35)");
    disc(ctx, cx, cy, R, "#2a6fd6", "#071a3e");
    for (let i = 0; i < 9; i += 1) {
      const p = (t * 0.7 + rand(i)) % 1; const x0 = w * (0.1 + rand(i + 3) * 0.9);
      const x = x0 - p * w * 0.3; const y = h * 0.05 + p * h * 0.55;
      const g = ctx.createLinearGradient(x, y, x + 40, y - 70);
      g.addColorStop(0, `rgba(255,250,230,${1 - p})`); g.addColorStop(1, "rgba(255,250,230,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y - 70); ctx.stroke();
    }
  } else if (id === "solar-eclipse") {
    const cx = w * 0.5; const cy = h * 0.5; const R = m * 0.26;
    const p = (Math.sin(t * 0.5) + 1) / 2; const cover = 1 - Math.abs(p - 0.5) * 2;
    glow(ctx, cx, cy, R * (2 + 1.4 * cover), `rgba(240,240,255,${0.15 + 0.55 * cover})`);
    disc(ctx, cx, cy, R, "#fff6d8", "#ffb347");
    ctx.fillStyle = "#020309";
    ctx.beginPath(); ctx.arc(cx + (p - 0.5) * R * 4.4, cy + (p - 0.5) * R * 0.4, R * 1.02, 0, Math.PI * 2); ctx.fill();
  } else if (["mars-dust-storm", "saturn-white-spot", "uranus-storms"].includes(id)) {
    const cx = w * 0.5; const cy = h * 0.5; const R = m * 0.38;
    const pal = id === "mars-dust-storm" ? ["#e28a55", "#5a2412", "rgba(240,190,130,"] : id === "saturn-white-spot" ? ["#f1e2b8", "#7a6236", "rgba(255,255,245,"] : ["#c8f2f6", "#3f8a9a", "rgba(255,255,255,"];
    disc(ctx, cx, cy, R, pal[0], pal[1]);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const grow = id === "mars-dust-storm" ? (t * 0.15) % 1 : (t * 0.2) % 1;
    for (let i = 0; i < 160; i += 1) {
      const lat = id === "mars-dust-storm" ? (rand(i) - 0.5) * 2 * grow : (id === "saturn-white-spot" ? 0.35 : -0.45) + (rand(i) - 0.5) * 0.22;
      const lon = (rand(i + 7) * 2 - 1) * (id === "mars-dust-storm" ? 1 : grow) + t * 0.05;
      const cl = Math.max(-1, Math.min(1, lat));
      const x = cx + Math.sin(lon * 1.5) * R * Math.cos(Math.asin(cl)); const y = cy - lat * R;
      ctx.fillStyle = `${pal[2]}${0.25 + 0.4 * rand(i + 2)})`;
      ctx.beginPath(); ctx.arc(x, y, 3 + 5 * rand(i + 4), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (id === "ring-spokes") {
    const cx = w * 0.5; const cy = h * 0.55; const R = m * 0.24;
    const rings = (half) => {
      for (let r = 1.35; r < 2.3; r += 0.03) {
        ctx.strokeStyle = `rgba(240,225,180,${0.12 + 0.18 * rand(r * 50)})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, R * r, 0, half ? Math.PI : Math.PI * 2); ctx.stroke();
      }
    };
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.32); rings(false);
    for (let i = 0; i < 6; i += 1) {
      const a = t * 0.25 + i * 1.05; const life = (Math.sin(t * 0.8 + i) + 1) / 2;
      ctx.strokeStyle = `rgba(30,24,20,${0.55 * life})`; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.6, Math.sin(a) * R * 1.6); ctx.lineTo(Math.cos(a + 0.12) * R * 2.05, Math.sin(a + 0.12) * R * 2.05); ctx.stroke();
    }
    ctx.restore();
    disc(ctx, cx, cy, R, "#f1e2b8", "#7a6236");
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.32); ctx.beginPath(); ctx.rect(-R * 2.4, 0, R * 4.8, R * 3); ctx.clip(); rings(true); ctx.restore();
  } else if (id === "mercury-sodium-tail") {
    const cx = w * 0.28; const cy = h * 0.5; const R = m * 0.13;
    glow(ctx, -w * 0.1, cy, w * 0.5, "rgba(255,180,80,.35)");
    for (let i = 0; i < 200; i += 1) {
      const p = (t * 0.25 + rand(i)) % 1; const x = cx + p * w * 0.85; const y = cy + (rand(i + 3) - 0.5) * (R * 1.2 + p * h * 0.5);
      ctx.fillStyle = `rgba(255,170,60,${(1 - p) * 0.6})`; ctx.fillRect(x, y, 2, 2);
    }
    disc(ctx, cx, cy, R, "#cfc6bc", "#4d4741");
  } else if (id === "supernova" || id === "kilonova") {
    const cx = w * 0.5; const cy = h * 0.5; const p = (t * 0.22) % 1; const c2 = id === "supernova" ? "255,200,240" : "190,170,255";
    if (id === "kilonova" && p < 0.35) {
      const a = t * 12 * (0.3 + p * 4); const r = m * 0.12 * (1 - p / 0.35);
      glow(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 16, "rgba(220,230,255,1)");
      glow(ctx, cx - Math.cos(a) * r, cy - Math.sin(a) * r, 16, "rgba(220,230,255,1)");
    } else {
      const q = id === "kilonova" ? (p - 0.35) / 0.65 : p;
      glow(ctx, cx, cy, m * (0.15 + q * 0.6), `rgba(${c2},${1 - q})`);
      ctx.strokeStyle = `rgba(${c2},${(1 - q) * 0.8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, m * q * 0.55), 0, Math.PI * 2); ctx.stroke();
      glow(ctx, cx, cy, 10 + 24 * (1 - q), "rgba(255,255,255,1)");
    }
  } else if (/-passage$/.test(id)) {
    const sx = w * 0.42; const sy = h * 0.58;
    glow(ctx, sx, sy, m * 0.25, "rgba(255,190,110,.5)"); disc(ctx, sx, sy, m * 0.05, "#fff1c4", "#ff9a3a");
    const path = (u) => [sx + Math.sinh(u) * w * 0.32, sy - (Math.cosh(u) - 1.6) * h * 0.22 - h * 0.08];
    ctx.strokeStyle = "rgba(127,227,224,.35)"; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let u = -2; u <= 2.001; u += 0.05) { const [x, y] = path(u); if (u === -2) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    const [x, y] = path(((t * 0.3) % 1) * 4 - 2);
    glow(ctx, x, y, 14, "rgba(127,227,224,1)");
  } else if (id === "solar-system-formation") {
    // A dusty disc round a young star, a gap opening where Jupiter grows.
    const cx = w * 0.5; const cy = h * 0.52; const R = Math.min(w * 0.46, h * 1.3);
    const p = (t * 0.12) % 1;
    glow(ctx, cx, cy, R * 0.35, "rgba(255,210,150,.6)");
    for (let i = 0; i < 520; i += 1) {
      const a = rand(i) * 0.95 + 0.05; const r = R * a;
      const ang = rand(i + 9) * Math.PI * 2 + t * 0.9 * a ** -1.5 * 0.4;
      const inGap = Math.abs(a - 0.5) < 0.05 && p > 0.3;
      if (inGap) continue;
      const x = cx + Math.cos(ang) * r; const y = cy + Math.sin(ang) * r * 0.32;
      const ice = a > 0.38;
      ctx.fillStyle = ice ? `rgba(160,208,255,${0.5 * (1 - a * 0.4)})` : `rgba(255,200,140,${0.65})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    const ja = t * 0.9 * 0.5 ** -1.5 * 0.4;
    glow(ctx, cx + Math.cos(ja) * R * 0.5, cy + Math.sin(ja) * R * 0.5 * 0.32, 4 + 8 * Math.min(1, p * 3), "rgba(255,220,170,1)");
    disc(ctx, cx, cy, m * 0.05, "#fff4d8", "#ffb347");
  } else if (id === "solar-wind") {
    const cx = w * 0.5; const cy = h * 0.5; const R = m * 0.1;
    glow(ctx, cx, cy, R * 3, "rgba(255,170,70,.4)");
    for (let arm = 0; arm < 6; arm += 1) {
      ctx.strokeStyle = "rgba(255,211,138,.22)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k <= 60; k += 1) {
        const r = R + (k / 60) * w * 0.6; const ang = arm * (Math.PI / 3) - (k / 60) * 2.2 - t * 0.05;
        const x = cx + Math.cos(ang) * r; const y = cy + Math.sin(ang) * r;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 260; i += 1) {
      const ang = rand(i) * Math.PI * 2; const polar = Math.abs(Math.sin(ang)) > 0.42;
      const life = (t * (polar ? 0.32 : 0.18) + rand(i + 4)) % 1; const r = R + life * w * 0.62;
      ctx.fillStyle = `rgba(255,${Math.round(236 - 90 * life)},${Math.round(190 - 120 * life)},${0.85 * (1 - life)})`;
      ctx.fillRect(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 1.7, 1.7);
    }
    disc(ctx, cx, cy, R, "#fff1c4", "#ff8a1f");
  } else if (id === "earth-magnetosphere") {
    const ex = w * 0.42; const ey = h * 0.5; const R = m * 0.09;
    const squeeze = (Math.sin(t * 0.6) + 1) / 2;
    const r0 = R * (5.2 - 1.6 * squeeze);
    const shell = (rs, colour, a) => {
      ctx.strokeStyle = colour; ctx.globalAlpha = a; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let k = -60; k <= 60; k += 1) {
        const th = (k / 60) * 2.5; const r = rs * Math.pow(2 / (1 + Math.cos(th)), 0.58);
        const x = ex - r * Math.cos(th); const y = ey + r * Math.sin(th);
        if (k === -60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    };
    for (let i = 0; i < 160; i += 1) {
      const life = (t * 0.35 + rand(i)) % 1; let x = -10 + life * (w + 20); let y = rand(i + 2) * h;
      const dy = y - ey; const nose = ex - r0 * 1.3;
      if (x > nose && Math.abs(dy) < r0 * 1.6) y = ey + Math.sign(dy || 1) * (r0 * 1.1 + Math.abs(dy) * 0.4);
      ctx.fillStyle = `rgba(255,${squeeze > 0.6 ? 170 : 225},${squeeze > 0.6 ? 190 : 170},.7)`; ctx.fillRect(x, y, 1.6, 1.6);
    }
    shell(r0 * 1.3, "#ffc27a", 0.55);
    shell(r0, "#7fd8ff", 0.85);
    for (let L = 2; L <= 4; L += 1) {
      ctx.strokeStyle = "rgba(159,230,255,.35)"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.ellipse(ex - R * L * 0.6 * (0.8 - 0.2 * squeeze), ey, R * L * 0.62 * (0.8 - 0.2 * squeeze), R * L * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(ex + R * L * 0.9, ey, R * L * 0.95, R * L * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    }
    disc(ctx, ex, ey, R, "#5b9cff", "#0c2a5c");
    glow(ctx, ex, ey - R * 0.95, R * (0.6 + 0.6 * squeeze), "rgba(109,255,156,.9)");
    glow(ctx, ex, ey + R * 0.95, R * (0.6 + 0.6 * squeeze), "rgba(109,255,156,.9)");
  } else if (id === "seasons") {
    const cx = w * 0.5; const cy = h * 0.5; const Rx = w * 0.36; const Ry = h * 0.3;
    glow(ctx, cx, cy, m * 0.22, "rgba(255,190,90,.55)"); disc(ctx, cx, cy, m * 0.07, "#fff1c4", "#ff9a3a");
    ctx.strokeStyle = "rgba(207,224,255,.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, Rx, Ry, 0, 0, Math.PI * 2); ctx.stroke();
    const L = t * 0.5; const x = cx + Math.cos(L) * Rx; const y = cy + Math.sin(L) * Ry; const g = m * 0.075;
    const tilt = (23.44 * Math.PI) / 180;
    // Lit half towards the Sun.
    disc(ctx, x, y, g, "#2a6fd6", "#0b1f45");
    const toSun = Math.atan2(cy - y, cx - x);
    ctx.fillStyle = "rgba(255,240,200,.55)"; ctx.beginPath(); ctx.arc(x, y, g, toSun - Math.PI / 2, toSun + Math.PI / 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(x - Math.sin(tilt) * g * 1.7, y + Math.cos(tilt) * g * 1.7); ctx.lineTo(x + Math.sin(tilt) * g * 1.9, y - Math.cos(tilt) * g * 1.9); ctx.stroke();
  } else {
    const c = FAMILY_COLOURS[ev.family] ?? "#ffffff";
    glow(ctx, w * 0.5, h * 0.5, m * 0.3, c);
  }
  ctx.globalAlpha = 1;
}

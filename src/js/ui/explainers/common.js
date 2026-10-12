/**
 * Shared pieces for the board's explanations (explainerView.js): the
 * planets' positions on a date, Kepler's equation for the catalogued
 * bodies, and the small canvas and SVG drawing helpers every topic uses.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const UNIX_EPOCH_JD = 2440587.5;
export const NOW_JD = UNIX_EPOCH_JD + Date.now() / 86_400_000;

/*
 * The planets, from JPL's "Keplerian Elements for Approximate Positions of
 * the Major Planets" (Standish), Table 1, J2000 ecliptic, valid 1800-2050 --
 * the same table smallBodies.js uses for its co-orbital frames. a AU, e,
 * I deg, L0 deg (mean longitude at J2000), Ldot deg/century, varpi, node.
 */
export const PLANETS = Object.freeze({
  Mercury: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L0: 252.25032350, Ldot: 149472.67411175, varpi: 77.45779628, node: 48.33076593, colour: "#9d958c" },
  Venus: { a: 0.72333566, e: 0.00677672, i: 3.39467605, L0: 181.97909950, Ldot: 58517.81538729, varpi: 131.60246718, node: 76.67984255, colour: "#e6c992" },
  Earth: { a: 1.00000261, e: 0.01671123, i: -0.00001531, L0: 100.46457166, Ldot: 35999.37244981, varpi: 102.93768193, node: 0, colour: "#4f86c6" },
  Mars: { a: 1.52371034, e: 0.09339410, i: 1.84969142, L0: -4.55343205, Ldot: 19140.30268499, varpi: -23.94362959, node: 49.55953891, colour: "#c46a3f" },
  Jupiter: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L0: 34.39644051, Ldot: 3034.74612775, varpi: 14.72847983, node: 100.47390909, colour: "#d9b48c" },
  Saturn: { a: 9.53667594, e: 0.05386179, i: 2.48599187, L0: 49.95424423, Ldot: 1222.49362201, varpi: 92.59887831, node: 113.66242448, colour: "#e3cf9f" },
  Uranus: { a: 19.18916464, e: 0.04725744, i: 0.77263783, L0: 313.23810451, Ldot: 428.48202785, varpi: 170.95427630, node: 74.01692503, colour: "#9fd8df" },
  Neptune: { a: 30.06992276, e: 0.00859048, i: 1.77004347, L0: -55.12002969, Ldot: 218.45945325, varpi: 44.96476227, node: 131.78422574, colour: "#5078d8" },
});

export function kepler(M, e) {
  let E = M + 0.85 * e * Math.sign(Math.sin(M));
  for (let i = 0; i < 12; i += 1) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-9) break;
  }
  return E;
}

/* Ecliptic x, y (AU) of an element set at mean anomaly M (radians). */
export function placeOnOrbit(nodeRad, argRad, incRad, e, aAU, M, out = { x: 0, y: 0, r: 0 }) {
  const E = kepler(((M % TAU) + TAU) % TAU, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = aAU * (1 - e * Math.cos(E));
  const u = argRad + nu;
  const cu = Math.cos(u);
  const su = Math.sin(u);
  out.x = r * (Math.cos(nodeRad) * cu - Math.sin(nodeRad) * su * Math.cos(incRad));
  out.y = r * (Math.sin(nodeRad) * cu + Math.cos(nodeRad) * su * Math.cos(incRad));
  out.r = r;
  return out;
}

export function planetAt(name, jd, out = { x: 0, y: 0, r: 0 }) {
  const p = PLANETS[name];
  const T = (jd - 2451545.0) / 36525;
  const L = p.L0 + p.Ldot * T;
  return placeOnOrbit(p.node * DEG, (p.varpi - p.node) * DEG, p.i * DEG, p.e, p.a, (L - p.varpi) * DEG, out);
}

export function planetLongitude(name, jd) {
  const q = planetAt(name, jd);
  return Math.atan2(q.y, q.x);
}

/*
 * A catalogue row from populationCatalogue.js -- [a, e, i, node, arg. peri,
 * M, H, epoch?] -- turned into something cheap to place on any date.
 */
export function prepareRow(row) {
  const [a, e, i, node, arg, M, H, epoch = 2461200.5] = row;
  const n = 0.9856076686 / a ** 1.5;
  return { a, e, inc: i * DEG, node: node * DEG, arg: arg * DEG, M0: M * DEG, n: n * DEG, epoch, H };
}

export function rowAt(p, jd, out = { x: 0, y: 0, r: 0 }) {
  return placeOnOrbit(p.node, p.arg, p.inc, p.e, p.a, p.M0 + p.n * (jd - p.epoch), out);
}

/* ------------------------------------------------------------- canvas */

export function drawSun(ctx, x, y, r = 7) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  glow.addColorStop(0, "rgba(255, 220, 150, 0.9)");
  glow.addColorStop(1, "rgba(255, 200, 120, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fff4d6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function ring(ctx, x, y, r, colour = "rgba(200, 215, 235, 0.22)", dash = null, width = 1) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function dot(ctx, x, y, r, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/* A label on a dark tab, so whatever is behind cannot swallow it. */
export function tag(ctx, text, x, y, { colour = "rgba(230, 236, 246, 0.9)", align = "center", font = "600 10px ui-sans-serif, system-ui, sans-serif", size } = {}) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 10;
  let left = align === "center" ? x - w / 2 : align === "left" ? x : x - w;
  if (size) left = Math.max(2, Math.min(size - w - 2, left));
  ctx.fillStyle = "rgba(6, 9, 14, 0.82)";
  ctx.fillRect(left, y - 8, w, 15);
  ctx.fillStyle = colour;
  ctx.textAlign = "left";
  ctx.fillText(text, left + 5, y + 3);
}

export function arrow(ctx, x1, y1, x2, y2, colour = "rgba(159, 240, 220, 0.85)", head = 6, width = 1.4) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.45) * head, y2 - Math.sin(a - 0.45) * head);
  ctx.lineTo(x2 - Math.cos(a + 0.45) * head, y2 - Math.sin(a + 0.45) * head);
  ctx.closePath();
  ctx.fill();
}

/* ---------------------------------------------------------------- svg */

export const SVG_HEAD = '<svg viewBox="0 0 120 120" role="img" aria-hidden="true">';
export const svgSun = (x = 60, y = 60, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff4d6"/><circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="rgba(255,220,150,0.25)"/>`;
export const svgRing = (r, colour = "rgba(200,215,235,0.35)", x = 60, y = 60, dash = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${colour}" stroke-width="1"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
export const svgDot = (x, y, r, fill) => `<circle cx="${x.toFixed ? x.toFixed(1) : x}" cy="${y.toFixed ? y.toFixed(1) : y}" r="${r}" fill="${fill}"/>`;
export const svgText = (x, y, words, colour = "#cfd8e3", size = 7, anchor = "middle") => `<text x="${x}" y="${y}" fill="${colour}" font-size="${size}" text-anchor="${anchor}" font-family="ui-sans-serif, system-ui, sans-serif">${words}</text>`;
export function svgEllipse(a, e, periDeg, colour = "#9ff0dc", cx = 60, cy = 60, scale = 1, dash = "") {
  // Sun at the focus (cx, cy); perihelion towards periDeg.
  const pts = [];
  for (let k = 0; k <= 96; k += 1) {
    const nu = (k / 96) * TAU;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu)) * scale;
    const ang = nu + periDeg * DEG;
    pts.push(`${k ? "L" : "M"} ${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy - Math.sin(ang) * r).toFixed(1)}`);
  }
  return `<path d="${pts.join(" ")} Z" fill="none" stroke="${colour}" stroke-width="1.2"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}
export const svgArrowDefs = (id, colour = "#9ff0dc") => `<defs><marker id="${id}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${colour}"/></marker></defs>`;
export const svgLine = (x1, y1, x2, y2, colour = "#9ff0dc", { width = 1.2, dash = "", marker = "" } = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}${marker ? ` marker-end="url(#${marker})"` : ""}/>`;

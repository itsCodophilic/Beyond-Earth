/**
 * Reusable celestial dossier for planets, stars, moons, and asteroids.
 *
 * Planet values use the existing NASA-oriented educational dataset. Other
 * bodies are resolved from the scientific metadata already attached to their
 * Three.js Object3D, and unavailable rows are hidden instead of guessed.
 */

const PLANET_DETAILS = Object.freeze({
  Mercury: Object.freeze({
    classification: "Terrestrial Planet",
    relativeScale: "0.055 Earth masses · 0.383× Earth's diameter",
    distanceFromStar: "0.39 AU · about 58 million km from the Sun",
    orbitalPeriod: "88 Earth days",
    moons: "0 moons",
    atmosphere: "An extremely thin exosphere containing oxygen, sodium, hydrogen, helium, and potassium.",
    temperature: "Mean about 167°C · roughly −180°C to 430°C across night and day",
    rotation: "58.6 Earth days",
    axialTilt: "About 2°",
    gravity: "3.70 m/s² · about 38% of Earth's gravity",
    lore: "Mercury is the smallest planet and the closest world to the Sun. Its heavily cratered surface records billions of years of impacts, while its unusually large metallic core occupies much of the planet's interior.",
    scienceUrl: "https://science.nasa.gov/mercury/facts/",
  }),
  Venus: Object.freeze({
    classification: "Terrestrial Planet",
    relativeScale: "0.815 Earth masses · 0.949× Earth's diameter",
    distanceFromStar: "0.72 AU · about 108 million km from the Sun",
    orbitalPeriod: "225 Earth days",
    moons: "0 moons",
    atmosphere: "About 96.5% carbon dioxide and 3.5% nitrogen, beneath clouds of sulfuric acid.",
    temperature: "Mean surface temperature about 464°C",
    rotation: "243 Earth days · retrograde rotation",
    axialTilt: "About 3° from upright, while rotating backward",
    gravity: "8.87 m/s² · about 90% of Earth's gravity",
    lore: "Venus is close to Earth in size, yet its runaway greenhouse atmosphere makes it the hottest planet. Radar observations reveal volcanic plains, mountains, and thousands of volcanic features beneath its opaque cloud deck.",
    scienceUrl: "https://science.nasa.gov/venus/facts/",
  }),
  Earth: Object.freeze({
    classification: "Terrestrial Planet",
    relativeScale: "1 Earth mass · 1× Earth's diameter",
    distanceFromStar: "1 AU · about 150 million km from the Sun",
    orbitalPeriod: "365.25 Earth days",
    moons: "1 moon",
    atmosphere: "About 78% nitrogen, 21% oxygen, and roughly 1% argon with trace gases.",
    temperature: "Global mean about 15°C · observed extremes roughly −89°C to 57°C",
    rotation: "23 hours 56 minutes",
    axialTilt: "About 23.4°",
    gravity: "9.81 m/s²",
    lore: "Earth is the only world currently known to support life. Liquid surface oceans, active geology, a protective magnetic field, and a balanced atmosphere work together to create a remarkably dynamic habitable planet.",
    scienceUrl: "https://science.nasa.gov/earth/facts/",
  }),
  Mars: Object.freeze({
    classification: "Terrestrial Planet",
    relativeScale: "0.107 Earth masses · 0.532× Earth's diameter",
    distanceFromStar: "1.52 AU · about 228 million km from the Sun",
    orbitalPeriod: "687 Earth days",
    moons: "2 moons",
    atmosphere: "About 95% carbon dioxide, with nitrogen, argon, and trace gases.",
    temperature: "Mean about −65°C · roughly −153°C to 20°C",
    rotation: "24 hours 37 minutes",
    axialTilt: "About 25°",
    gravity: "3.71 m/s² · about 38% of Earth's gravity",
    lore: "Mars preserves evidence of ancient rivers, lakes, and wetter climates. Today it is a cold desert with polar ice caps, giant volcanoes, deep canyons, dust storms, and subsurface environments that remain important targets in the search for past life.",
    scienceUrl: "https://science.nasa.gov/mars/facts/",
  }),
  Jupiter: Object.freeze({
    classification: "Gas Giant",
    relativeScale: "317.8 Earth masses · 10.97× Earth's diameter",
    distanceFromStar: "5.2 AU · about 778 million km from the Sun",
    orbitalPeriod: "11.86 Earth years · about 4,333 days",
    moons: "95 confirmed moons",
    atmosphere: "Mostly hydrogen and helium, with traces of methane, ammonia, water vapour, and other compounds.",
    temperature: "About −110°C near the one-bar atmospheric level",
    rotation: "About 9 hours 56 minutes",
    axialTilt: "About 3°",
    gravity: "24.79 m/s² · about 2.53× Earth's gravity",
    lore: "Jupiter is the largest planet, a rapidly rotating world of powerful jet streams, immense storms, and a deep atmosphere with no solid surface. Its complex moon system includes volcanic Io, ocean-bearing Europa, giant Ganymede, and cratered Callisto.",
    scienceUrl: "https://science.nasa.gov/jupiter/facts/",
  }),
  Saturn: Object.freeze({
    classification: "Gas Giant",
    relativeScale: "95.2 Earth masses · 9.45× Earth's diameter",
    distanceFromStar: "9.5 AU · about 1.4 billion km from the Sun",
    orbitalPeriod: "29.45 Earth years · about 10,759 days",
    moons: "274 confirmed moons",
    atmosphere: "Mostly hydrogen and helium, with traces of methane, ammonia, and water vapour.",
    temperature: "About −140°C near the one-bar atmospheric level",
    rotation: "About 10.7 hours",
    axialTilt: "About 26.7°",
    gravity: "10.44 m/s² · about 1.06× Earth's gravity",
    lore: "Saturn is distinguished by its vast ring system, built from countless particles of ice and rock. Beneath the rings is a fast-spinning hydrogen-helium giant, accompanied by a diverse family of moons including hazy Titan and ocean-bearing Enceladus.",
    scienceUrl: "https://science.nasa.gov/saturn/facts/",
  }),
  Uranus: Object.freeze({
    classification: "Ice Giant",
    relativeScale: "14.5 Earth masses · 4.01× Earth's diameter",
    distanceFromStar: "19 AU · about 2.9 billion km from the Sun",
    orbitalPeriod: "84 Earth years · about 30,687 days",
    moons: "28 confirmed moons",
    atmosphere: "Mostly hydrogen and helium with methane, plus small amounts of water and ammonia compounds deeper inside.",
    temperature: "Mean about −195°C · atmospheric lows near −224°C",
    rotation: "About 17 hours 14 minutes · retrograde rotation",
    axialTilt: "About 97.8°",
    gravity: "8.87 m/s² · about 90% of Earth's gravity",
    lore: "Uranus rotates almost on its side, producing extreme seasonal illumination during its long orbit. Methane gives the planet its blue-green colour, while faint rings and a collection of icy moons surround the unusually tilted ice giant.",
    scienceUrl: "https://science.nasa.gov/uranus/facts/",
  }),
  Neptune: Object.freeze({
    classification: "Ice Giant",
    relativeScale: "17.1 Earth masses · 3.88× Earth's diameter",
    distanceFromStar: "30 AU · about 4.5 billion km from the Sun",
    orbitalPeriod: "164.8 Earth years · about 60,190 days",
    moons: "16 confirmed moons",
    atmosphere: "Mostly hydrogen and helium with methane, along with deeper water, ammonia, and hydrocarbon compounds.",
    temperature: "About −200°C near the one-bar atmospheric level",
    rotation: "About 16 hours",
    axialTilt: "About 28°",
    gravity: "11.15 m/s² · about 1.14× Earth's gravity",
    lore: "Neptune is the most distant major planet and hosts some of the fastest winds measured in the Solar System. Its active blue atmosphere forms changing clouds and storms, while the large moon Triton travels in a retrograde orbit and likely originated in the Kuiper Belt.",
    scienceUrl: "https://science.nasa.gov/neptune/facts/",
  }),
  Pluto: Object.freeze({
    classification: "Dwarf Planet · Kuiper Belt Object",
    relativeScale: "0.00218 Earth masses · 0.186× Earth's diameter",
    distanceFromStar: "Average 39 AU · about 5.9 billion km from the Sun",
    orbitalPeriod: "248 Earth years",
    moons: "5 moons",
    atmosphere: "A thin, seasonal atmosphere of nitrogen with methane and carbon monoxide.",
    temperature: "Mean about −232°C · roughly −240°C to −226°C",
    rotation: "About 153 hours · 6.4 Earth days · retrograde",
    axialTilt: "About 57°",
    gravity: "0.62 m/s² · about 6% of Earth's gravity",
    lore: "Pluto is a complex, geologically active dwarf planet whose bright heart-shaped region includes a vast nitrogen-ice plain. Its large moon Charon forms a tightly coupled binary-like system with Pluto, while four much smaller moons orbit farther out.",
    scienceUrl: "https://science.nasa.gov/dwarf-planets/pluto/facts/",
  }),
});

const BODY_OVERRIDES = Object.freeze({
  Sun: Object.freeze({
    classification: "G-type Main-Sequence Star",
    massRelative: "About 333,000 Earth masses",
    sizeRelative: "About 109× Earth's diameter",
    rotation: "About 25 Earth days at the equator",
    gravity: "About 274 m/s² at the visible surface",
    lore: "The Sun is the gravitational and energetic centre of the Solar System. Its light and plasma activity shape the environment experienced by every planet, moon, asteroid, and comet.",
  }),
  Moon: Object.freeze({
    classification: "Natural Satellite of Earth",
    massRelative: "About 0.0123 Earth masses",
    sizeRelative: "About 0.273× Earth's diameter",
    rotation: "27.3 Earth days · tidally locked to Earth",
    gravity: "1.62 m/s² · about 16.5% of Earth's gravity",
  }),
});

const JPL_SOURCE_URL = "https://ssd.jpl.nasa.gov/planets/phys_par.html";

function dispatchPanelState(open, bodyName = null) {
  window.dispatchEvent(new CustomEvent("beyond-earth:planet-details-state", {
    detail: { open, planetName: bodyName, bodyName },
  }));
}

function splitRelativeScale(value = "") {
  const [massRelative = "", sizeRelative = ""] = String(value).split(" · ");
  return { massRelative, sizeRelative };
}

function getBodyName(bodyOrName) {
  return typeof bodyOrName === "string"
    ? bodyOrName
    : String(bodyOrName?.userData?.name ?? bodyOrName?.name ?? "");
}

function cleanValue(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text || /^(not available|unavailable|unknown|scale comparison unavailable)$/i.test(text)) return null;
  return text;
}

function resolveDetails(bodyOrName, context = {}) {
  const name = getBodyName(bodyOrName);
  const body = typeof bodyOrName === "string" ? null : bodyOrName;
  const info = body?.userData?.info ?? {};
  const planet = PLANET_DETAILS[name];
  const override = BODY_OVERRIDES[name] ?? {};
  const relative = splitRelativeScale(planet?.relativeScale);
  const parentName = body?.userData?.parentPlanet ?? context.parentName ?? null;
  const isSatellite = Boolean(body?.userData?.isSatellite || parentName || info.type === "Natural satellite");
  const isAsteroid = Boolean(body?.userData?.isAsteroid || /asteroid/i.test(info.type ?? ""));

  const details = {
    name,
    classification: planet?.classification
      ?? override.classification
      ?? info.type
      ?? body?.userData?.detail?.split("|")?.[0]?.trim()
      ?? "Celestial body",
    massRelative: planet ? relative.massRelative : override.massRelative,
    sizeRelative: planet
      ? relative.sizeRelative
      : override.sizeRelative ?? info.sizeComparison ?? body?.userData?.sizeComparison,
    diameter: info.diameter,
    distance: planet?.distanceFromStar
      ?? context.distanceFromEarth
      ?? info.distanceFromEarth,
    orbital: planet?.orbitalPeriod ?? info.orbitalSpeed,
    relationLabel: planet
      ? "Natural satellites"
      : context.satelliteRankText
        ? "Satellite size rank"
        : parentName
          ? "Parent world"
          : isAsteroid
            ? "Solar-System region"
            : "Location",
    relationValue: planet?.moons
      ?? context.satelliteRankText
      ?? parentName
      ?? (isAsteroid ? "Asteroid population" : "Milky Way · Solar System"),
    atmosphere: planet?.atmosphere ?? info.atmosphere,
    temperature: planet?.temperature ?? info.temperature,
    rotation: planet?.rotation ?? override.rotation ?? info.rotationPeriod,
    axialTilt: planet?.axialTilt ?? info.axialTilt,
    gravity: planet?.gravity ?? override.gravity ?? info.gravity,
    surface: info.surfaceEvidence
      ? `${info.surfaceEvidence}${info.roughness ? ` · model roughness ${info.roughness}` : ""}`
      : null,
    lore: planet?.lore
      ?? override.lore
      ?? info.description
      ?? body?.userData?.detail
      ?? "No extended description is currently available for this body.",
    scienceUrl: planet?.scienceUrl ?? null,
    showJplSource: Boolean(planet),
    breadcrumbTail: isSatellite && parentName ? `${parentName} system` : null,
  };

  [
    "massRelative", "sizeRelative", "diameter", "distance", "orbital",
    "relationValue", "atmosphere", "temperature", "rotation", "axialTilt",
    "gravity", "surface",
  ].forEach((key) => {
    details[key] = cleanValue(details[key]);
  });

  return details;
}

/** Creates and controls the reusable celestial dossier dialog. */
export function createCelestialDetailsPanel() {
  let layer = document.querySelector("#planet-details-panel");
  if (!layer) {
    layer = document.createElement("section");
    layer.id = "planet-details-panel";
    layer.className = "planet-details";
    layer.hidden = true;
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("aria-labelledby", "planet-details-title");
    layer.innerHTML = `
      <div class="planet-details__backdrop" data-planet-details-dismiss></div>
      <article class="planet-details__card" tabindex="-1">
        <button class="planet-details__close" type="button" aria-label="Close celestial details">×</button>

        <header class="planet-details__header">
          <span class="planet-details__eyebrow" id="planet-details-breadcrumb" data-cosmic-text>Milky Way Galaxy · Solar System</span>
          <div class="planet-details__heading-row">
            <div>
              <h2 id="planet-details-title" data-cosmic-text>Celestial body</h2>
              <p id="planet-details-classification" data-cosmic-text>Classification</p>
            </div>
          </div>
        </header>

        <dl class="planet-details__core" aria-label="Core celestial details">
          <div class="planet-details__fact" data-core-field="mass">
            <dt data-cosmic-text>Mass vs Earth</dt>
            <dd id="planet-details-mass" data-cosmic-text>—</dd>
          </div>
          <div class="planet-details__fact" data-core-field="size">
            <dt data-cosmic-text>Size vs Earth</dt>
            <dd id="planet-details-size" data-cosmic-text>—</dd>
          </div>
          <div class="planet-details__fact" data-core-field="diameter">
            <dt data-cosmic-text>Physical diameter</dt>
            <dd id="planet-details-diameter" data-cosmic-text>—</dd>
          </div>
          <div class="planet-details__fact" data-core-field="distance">
            <dt data-cosmic-text>Distance / position</dt>
            <dd id="planet-details-distance" data-cosmic-text>—</dd>
          </div>
          <div class="planet-details__fact" data-core-field="orbital">
            <dt data-cosmic-text>Orbital period / motion</dt>
            <dd id="planet-details-orbital" data-cosmic-text>—</dd>
          </div>
          <div class="planet-details__fact" data-core-field="relation">
            <dt id="planet-details-relation-label" data-cosmic-text>System relation</dt>
            <dd id="planet-details-relation" data-cosmic-text>—</dd>
          </div>
        </dl>

        <details class="planet-details__advanced">
          <summary>
            <span>
              <strong data-cosmic-text>Explore scientific details</strong>
              <small data-cosmic-text>Atmosphere, climate, rotation, gravity, surface evidence, and story</small>
            </span>
            <span class="planet-details__summary-icon" aria-hidden="true"></span>
          </summary>

          <div class="planet-details__advanced-grid">
            <div class="planet-details__advanced-item" data-planet-field="atmosphere">
              <span data-cosmic-text>Atmospheric composition</span>
              <p id="planet-details-atmosphere" data-cosmic-text></p>
            </div>
            <div class="planet-details__advanced-item" data-planet-field="temperature">
              <span data-cosmic-text>Surface / atmospheric temperature</span>
              <p id="planet-details-temperature" data-cosmic-text></p>
            </div>
            <div class="planet-details__advanced-item" data-planet-field="rotation">
              <span data-cosmic-text>Rotation period · day length</span>
              <p id="planet-details-rotation" data-cosmic-text></p>
            </div>
            <div class="planet-details__advanced-item" data-planet-field="axialTilt">
              <span data-cosmic-text>Axial tilt</span>
              <p id="planet-details-tilt" data-cosmic-text></p>
            </div>
            <div class="planet-details__advanced-item" data-planet-field="gravity">
              <span data-cosmic-text>Gravity</span>
              <p id="planet-details-gravity" data-cosmic-text></p>
            </div>
            <div class="planet-details__advanced-item" data-planet-field="surface">
              <span data-cosmic-text>Surface evidence</span>
              <p id="planet-details-surface" data-cosmic-text></p>
            </div>
            <div class="planet-details__advanced-item planet-details__advanced-item--lore" data-planet-field="lore">
              <span data-cosmic-text>Celestial story</span>
              <p id="planet-details-lore" data-cosmic-text></p>
            </div>
          </div>
        </details>

        <footer class="planet-details__sources" id="planet-details-sources">
          <span data-cosmic-text>Rounded educational values from</span>
          <a id="planet-details-nasa-source" href="https://science.nasa.gov/solar-system/" target="_blank" rel="noreferrer">NASA Science</a>
          <span aria-hidden="true">·</span>
          <a href="${JPL_SOURCE_URL}" target="_blank" rel="noreferrer">NASA/JPL physical parameters</a>
        </footer>
      </article>
    `;
    document.body.append(layer);
  }

  const card = layer.querySelector(".planet-details__card");
  const closeButton = layer.querySelector(".planet-details__close");
  const advanced = layer.querySelector(".planet-details__advanced");
  const breadcrumb = layer.querySelector("#planet-details-breadcrumb");
  const title = layer.querySelector("#planet-details-title");
  const classification = layer.querySelector("#planet-details-classification");
  const relationLabel = layer.querySelector("#planet-details-relation-label");
  const nasaSource = layer.querySelector("#planet-details-nasa-source");
  const sources = layer.querySelector("#planet-details-sources");

  const coreFields = Object.freeze({
    mass: layer.querySelector("#planet-details-mass"),
    size: layer.querySelector("#planet-details-size"),
    diameter: layer.querySelector("#planet-details-diameter"),
    distance: layer.querySelector("#planet-details-distance"),
    orbital: layer.querySelector("#planet-details-orbital"),
    relation: layer.querySelector("#planet-details-relation"),
  });
  const advancedFields = Object.freeze({
    atmosphere: layer.querySelector("#planet-details-atmosphere"),
    temperature: layer.querySelector("#planet-details-temperature"),
    rotation: layer.querySelector("#planet-details-rotation"),
    axialTilt: layer.querySelector("#planet-details-tilt"),
    gravity: layer.querySelector("#planet-details-gravity"),
    surface: layer.querySelector("#planet-details-surface"),
    lore: layer.querySelector("#planet-details-lore"),
  });

  let open = false;
  let closeTimer = null;
  let revealFrame = null;
  let previouslyFocused = null;
  let activeBodyName = null;
  let activeCosmicTarget = null;
  let lastRippleAt = -Infinity;
  let lastRippleX = -Infinity;
  let lastRippleY = -Infinity;

  function getFocusableElements() {
    return Array.from(layer.querySelectorAll(
      'button:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.closest("[hidden]") && element.offsetParent !== null);
  }

  function writeCoreField(key, value) {
    const output = coreFields[key];
    const row = layer.querySelector(`[data-core-field="${key}"]`);
    if (!output || !row) return;
    const available = Boolean(value);
    row.hidden = !available;
    output.textContent = available ? value : "";
  }

  function writeAdvancedField(key, value) {
    const output = advancedFields[key];
    const row = layer.querySelector(`[data-planet-field="${key}"]`);
    if (!output || !row) return;
    const available = Boolean(value);
    row.hidden = !available;
    output.textContent = available ? value : "";
  }

  function prepareCosmicText(element) {
    if (!element) return;
    // The dossier is populated while the outer layer may still carry the
    // `hidden` attribute. The old generic hidden-ancestor guard therefore
    // rejected every title and value before per-character spans were built.
    // Ignore only the panel's temporary hidden state, while continuing to
    // skip fact rows that are intentionally unavailable.
    const hiddenAncestor = element.closest("[hidden]");
    if (hiddenAncestor && hiddenAncestor !== layer) return;
    const originalText = element.textContent.replace(/\s+/g, " ").trim();
    if (!originalText) return;
    element.setAttribute("aria-label", originalText);
    element.textContent = "";
    originalText.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        element.append(document.createTextNode(" "));
        return;
      }
      const token = document.createElement("span");
      token.className = "planet-details__cosmic-token";
      token.setAttribute("aria-hidden", "true");
      Array.from(part).forEach((character) => {
        const glyph = document.createElement("span");
        glyph.className = "planet-details__cosmic-character";
        glyph.textContent = character;
        token.append(glyph);
      });
      element.append(token);
    });
  }

  function resetCosmicText(target = activeCosmicTarget) {
    target?.classList.remove("is-cosmic-active");
    target?.querySelectorAll(".planet-details__cosmic-character").forEach((glyph) => {
      glyph.classList.remove("is-reacting", "is-rippling");
      glyph.style.removeProperty("--cosmic-character-x");
      glyph.style.removeProperty("--cosmic-character-y");
      glyph.style.removeProperty("--cosmic-character-turn");
      glyph.style.removeProperty("--cosmic-character-scale");
      glyph.style.removeProperty("--cosmic-ripple-lift");
      glyph.style.removeProperty("--cosmic-ripple-settle");
      glyph.style.removeProperty("--cosmic-ripple-delay");
    });
  }

  function animateCosmicText(target, clientX, clientY, now) {
    if (!target) return;
    const targetChanged = activeCosmicTarget !== target;
    if (activeCosmicTarget && targetChanged) resetCosmicText(activeCosmicTarget);
    activeCosmicTarget = target;
    target.classList.add("is-cosmic-active");
    const pointerTravel = Math.hypot(clientX - lastRippleX, clientY - lastRippleY);
    const shouldRipple = targetChanged || pointerTravel > 20 || now - lastRippleAt > 440;
    const rippleGlyphs = [];

    target.querySelectorAll(".planet-details__cosmic-character").forEach((glyph) => {
      const rect = glyph.getBoundingClientRect();
      const deltaX = clientX - (rect.left + rect.width / 2);
      const deltaY = clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(deltaX, deltaY);
      const influence = Math.max(0, 1 - distance / 54);
      const rippleInfluence = Math.max(0, 1 - distance / 88);

      if (shouldRipple && rippleInfluence > 0) {
        const rippleLift = 0.20 + rippleInfluence * 0.70;
        glyph.style.setProperty("--cosmic-ripple-lift", `${rippleLift}px`);
        glyph.style.setProperty("--cosmic-ripple-settle", `${rippleLift * 0.22}px`);
        glyph.style.setProperty("--cosmic-ripple-delay", `${Math.round(distance * 1.65)}ms`);
        rippleGlyphs.push(glyph);
      }

      if (influence <= 0) {
        glyph.classList.remove("is-reacting");
        glyph.style.removeProperty("--cosmic-character-x");
        glyph.style.removeProperty("--cosmic-character-y");
        glyph.style.removeProperty("--cosmic-character-turn");
        glyph.style.removeProperty("--cosmic-character-scale");
        return;
      }

      glyph.style.setProperty("--cosmic-character-x", `${deltaX * influence * 0.022}px`);
      glyph.style.setProperty("--cosmic-character-y", `${deltaY * influence * 0.028 - influence * 1.8}px`);
      glyph.style.setProperty("--cosmic-character-turn", `${deltaX * influence * 0.035}deg`);
      glyph.style.setProperty("--cosmic-character-scale", String(1 + influence * 0.085));
      glyph.classList.toggle("is-reacting", influence > 0.12);
    });

    if (shouldRipple && rippleGlyphs.length) {
      target.querySelectorAll(".planet-details__cosmic-character.is-rippling")
        .forEach((glyph) => glyph.classList.remove("is-rippling"));
      target.getBoundingClientRect();
      rippleGlyphs.forEach((glyph) => glyph.classList.add("is-rippling"));
      lastRippleAt = now;
      lastRippleX = clientX;
      lastRippleY = clientY;
    }
  }

  function populate(details) {
    title.textContent = details.name;
    classification.textContent = details.classification;
    breadcrumb.textContent = details.breadcrumbTail
      ? `Milky Way Galaxy · Solar System · ${details.breadcrumbTail}`
      : "Milky Way Galaxy · Solar System";
    relationLabel.textContent = details.relationLabel;
    writeCoreField("mass", details.massRelative);
    writeCoreField("size", details.sizeRelative);
    writeCoreField("diameter", details.diameter);
    writeCoreField("distance", details.distance);
    writeCoreField("orbital", details.orbital);
    writeCoreField("relation", details.relationValue);
    Object.keys(advancedFields).forEach((key) => writeAdvancedField(key, details[key]));

    sources.hidden = !details.scienceUrl;
    if (details.scienceUrl) {
      nasaSource.href = details.scienceUrl;
      nasaSource.setAttribute("aria-label", `Open NASA Science facts for ${details.name}`);
    }
    advanced.open = false;

    resetCosmicText();
    activeCosmicTarget = null;
    layer.querySelectorAll("[data-cosmic-text]").forEach(prepareCosmicText);
  }

  function show(bodyOrName, context = {}) {
    const details = resolveDetails(bodyOrName, context);
    if (!details.name) return false;

    if (closeTimer) clearTimeout(closeTimer);
    if (revealFrame) cancelAnimationFrame(revealFrame);
    closeTimer = null;
    revealFrame = null;
    previouslyFocused = document.activeElement;
    activeBodyName = details.name;

    // Unhide the non-interactive layer before preparing glyph spans. The
    // backdrop and card remain transparent until their reveal classes are
    // applied, so this does not produce a visual flash.
    layer.hidden = false;
    populate(details);

    layer.classList.remove("is-closing");
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-planet-details-open");
    open = true;
    dispatchPanelState(true, details.name);

    revealFrame = requestAnimationFrame(() => {
      layer.classList.add("is-open");
      revealFrame = requestAnimationFrame(() => {
        layer.classList.add("is-card-visible");
        card?.focus({ preventScroll: true });
        revealFrame = null;
      });
    });
    return true;
  }

  function hide({ restoreFocus = true } = {}) {
    if (!open && layer.hidden) return;
    if (closeTimer) clearTimeout(closeTimer);
    if (revealFrame) cancelAnimationFrame(revealFrame);
    revealFrame = null;
    open = false;
    resetCosmicText();
    activeCosmicTarget = null;
    layer.classList.remove("is-open", "is-card-visible");
    layer.classList.add("is-closing");
    layer.setAttribute("aria-hidden", "true");

    closeTimer = setTimeout(() => {
      layer.classList.remove("is-closing");
      layer.hidden = true;
      document.body.classList.remove("is-planet-details-open");
      dispatchPanelState(false, activeBodyName);
      activeBodyName = null;
      closeTimer = null;
      if (restoreFocus && previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    }, 360);
  }

  function getCosmicTargetFromPointerEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof Element && node.matches?.("[data-cosmic-text]")) {
        return card?.contains(node) ? node : null;
      }
    }
    const element = event.target instanceof Element ? event.target : null;
    const target = element?.closest?.("[data-cosmic-text]") ?? null;
    return target && card?.contains(target) ? target : null;
  }

  const handleCosmicPointer = (event) => {
    const target = getCosmicTargetFromPointerEvent(event);
    if (!target) {
      resetCosmicText();
      activeCosmicTarget = null;
      return;
    }
    animateCosmicText(target, event.clientX, event.clientY, performance.now());
  };

  // Capture the pointer before any nested modal control can stop bubbling.
  // This keeps the character field reliable over generated glyph spans,
  // headings, fact cards, links, and future nested controls.
  card?.addEventListener("pointerover", handleCosmicPointer, { passive: true, capture: true });
  card?.addEventListener("pointermove", handleCosmicPointer, { passive: true, capture: true });

  card?.addEventListener("pointerleave", () => {
    resetCosmicText();
    activeCosmicTarget = null;
  });

  layer.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-planet-details-dismiss], .planet-details__close")) {
      event.preventDefault();
      hide();
    }
  });

  layer.addEventListener("keydown", (event) => {
    if (!open && !layer.classList.contains("is-closing")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hide();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      card?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, { capture: true });

  return Object.freeze({
    show,
    hide,
    isOpen: () => open || layer.classList.contains("is-closing"),
    hasDetailsFor: (bodyOrName) => Boolean(getBodyName(bodyOrName)),
  });
}

// Compatibility export for older callers that still use the previous name.
export const createPlanetDetailsPanel = createCelestialDetailsPanel;

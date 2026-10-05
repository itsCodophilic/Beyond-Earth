# Beyond Earth — the final file

This is the last working note for this run of the project. The project notes keep the same text as `claude/the-final-file.md`; the audit it came from is `claude/whats-left-october-2026.md`.

**Written:** 5 October 2026, after the owner committed rounds 1–11 (git head `e57bb8d "New Celestial Bodies"`). Parts 1 and 2 were then done the same day and committed to the device folder; they are not committed to git.

**Standing rules, still in force:**
- No git commits.
- Never write `asteroidBelt.js` or `spaceEnvironmentConfig.js`.
- Every number carries its provenance in a comment.
- No backticks inside `/* glsl */` literals.
- Do not introduce lag.

**Out of scope, by the owner's instruction:** the space-events redesign (the Orrery) and any new events.

---

## Part 1 — Small things noted along the way: done

1. **Amber band near 43 AU — fixed** (`scene/outerBoundaries.js`, `main.js`).
   - **Cause:** the boundary markers are sized for the system view. Each is a band about 31 units wide, which is 2–8 px from 5,000–11,000 units out. Near the Kuiper Belt the camera can sit within a hundred units of the termination-shock marker, and the band then filled the screen.
   - **Fix:** each fragment now works out how wide the band is on screen where it is drawn, and fades it out between 10 and 28 px. The material is patched with `onBeforeCompile`, with uniforms `uMarkerHalfWidth` and `uMarkerProjScale`; the latter is updated in `updateOuterBoundaries`.
   - The markers also join the guides that space mode and the events hide (`ecliptic marker` added to `SOLAR_EVENT_GUIDE_NAMES`). The shells stay.
   - **Measured:** camera 60 units above the termination-shock marker, looking down. The markers covered 40.6% of the screen before and 0.00% after. At the system view they still draw (0.7% of the screen). In space mode 0 of 4 are visible, and all 4 come back when it ends.
2. **Jupiter's gossamer ring grabbing the mouse — reduced** (`planets/jupiter/jupiterRings.js`).
   - The Thebe ring's pick field now ends at 200,000 km instead of 226,000 km.
   - Its grains are weighted inward (`Math.pow(random(), 1.8)`), so three quarters lie inside 187,000 km. The removed tail was sky with nothing visible to point at.
   - That is 62% of the Thebe field and 32% of the two gossamer fields together. The tail is still drawn and still described on the card.
   - **Measured:** field outer edge is 2.798 Jupiter radii, which is 200,000 / 71,492 km.
3. **Itokawa's bald Muses Sea — fixed** (`tools/small-body-textures/build-small-body-textures.py`, map regenerated).
   - The pond is finer, not brighter or emptier (Miyamoto et al. 2007; Yano et al. 2006).
   - Its feature now keeps 62% of the coarse relief (was 34%), carries 1.5× the fine grain, is lifted 5% rather than 13%, and is blurred 3 px rather than 4.
   - The new per-feature `keep` and `fines` parameters default to the old values, so the other bodies that use `smooth` are unchanged.
   - `meanLinear` went from 0.2322 to 0.2324.
4. **Haumea's and Quaoar's rings fade with distance — done** (`scene/planetFactory.js`, `updateDwarfRingProximity`).
   - Same rule as the Centaurs, counted in ring radii: full below 10, gone above 55, and past that hidden along with their pointer annuli.
   - **Measured through the real update function:** at 7 ring radii, full; at 30, 0.58; at 80, hidden.
5. **Dead code and files — cleaned.**
   - Removed from `planetDetailsPanel.js`: the `asteroidRoster.js` import, `asteroidClassCode`, `asteroidClassRoster`, the hidden "Where to next" section and its JS, and the unused `[data-travel-to]` handler.
   - 36 orphan CSS rules removed from `cinematic-ui.css`.
   - `asteroidRoster.js` and `uz224.jpg` moved to `_to_delete/`.
   - `applySunPerformanceProfile` no longer exists (it became `setSunPerformanceProfile`, which is called), so nothing to do there.
   - **Owner:** empty `_to_delete/` by hand.

## Part 2 — Known compromises: decided

1. **Ceres and the Centaurs on the asteroid size curve — kept, on purpose.**
   - The dwarf curve would draw Chariklo at 0.026 units (from 0.309) and Echeclus at 0.007. That is below the camera's 0.05-unit near clearance, so it could not be inspected.
   - Arrokoth and every other small body are also on the asteroid curve.
   - Ceres lives in the frozen `asteroidBelt.js`.
   - The real fix is one curve for every body, which means re-scaling the belt.
2. **Vesta / Pallas / Hygiea / Psyche surfaces, Kirkwood gaps and families — still blocked** by the frozen `asteroidBelt.js`. Vesta's Dawn map is ready. Route it through `DWARF_ALBEDO` / `DWARF_TERRAIN` when the freeze is lifted.
3. **Light the eye cannot see — done for the aurorae** (`planetDetailsPanel.js`).
   - Mars, Jupiter, Saturn and Uranus have a new dossier row, "Aurora · light your eyes cannot see". It says which instruments and which band (ultraviolet / infrared H₃⁺) the drawn aurora comes from, and how faint any visible-light version is.
   - Earth's aurora is visible light, so Earth has no row.
4. **Left out on purpose, unchanged:** Camilla's moons, Chaos's two lobes, Varuna's possible moon.

## Part 3 — Bodies and populations not built (later)
- Real New Horizons surfaces for Nix, Hydra, Kerberos and Styx.
- Real surfaces for the photographed mid-sized moons:
  - Saturn: Phoebe, Hyperion, Janus, Epimetheus, Pan, Atlas, Daphnis, Telesto, Calypso, Helene, Polydeuces, Methone
  - Jupiter: Amalthea
  - Neptune: Proteus, Nereid

  These need images.
- More Centaurs: Nessus, Asbolus, Bienor, Hylonome, plus a 5–30 AU population.
- A near-Earth asteroid population.
- Neptune's Trojans.
- The solar wind and the heliosheath as their own objects.
- Spacecraft.
- Magnetospheres and radiation belts, as labelled diagrams.
- Tidal locking, the Laplace resonance, seasons and formation, shown rather than stated.

## Part 4 — Checks only the owner's Mac can run
- A production `vite build`.
- KTX2/Basis texture compression (about 1.9 GB → about 480 MB of graphics memory).
- One visible-tab startup timing.

---

## What to test (parts 1 and 2)
1. **Amber band.**
   - Fly to Quaoar or Makemake (about 43 AU) and look down onto the ecliptic. There should be no wide amber or yellow band; the boundary shells still show.
   - Zoom all the way out: the four boundary rings still show as thin lines.
   - Turn on space mode: the rings go, and they come back when you turn it off.
2. **Jupiter.** Fly to Jupiter and sweep the mouse across the sky around it.
   - The gossamer ring card should appear only over the ring's visible inner part, not far out in empty sky.
   - Hovering the main and halo rings still works.
   - Clicking Jupiter still opens its card.
3. **Itokawa.** Fly to Itokawa and look at the waist. It should be fine gravel rather than a blank, bright, blurred disc.
4. **Haumea and Quaoar.** Fly to each: the rings show at full strength. From the system view they should not glow.
5. **Dossier.**
   - Open the card for Mars, Jupiter, Saturn and Uranus, then "Explore scientific details": a new "Aurora · light your eyes cannot see" row.
   - Earth's card has no such row.
   - Open an asteroid's card (for example Bennu) and a Kuiper zone's card. Both open normally, with nothing missing and no console errors.
6. **Build.** Run `npm run build` once on the Mac (the session cannot).

**Already verified headless:** syntax and GLSL gates clean on the device (111 files); frozen files untouched; no page errors.

# Beyond Earth — the final file

This is the last working note for this run of the project. The project notes keep the same text as `claude/the-final-file.md`; the audit it came from is `claude/whats-left-october-2026.md`.

**Written:** 5 October 2026, after the owner committed rounds 1–11 (git head `e57bb8d "New Celestial Bodies"`). Parts 1 and 2 were then done the same day and committed to the device folder; they are not committed to git.

**Standing rules, still in force:**
- No git commits.
- Never write `asteroidBelt.js` or `spaceEnvironmentConfig.js`.
- Every number carries its provenance in a comment.
- No backticks inside `/* glsl */` literals.
- Do not introduce lag.

Part 5 (the aurorae as an eye sees them, and the ultraviolet view) was added later the same day, after the owner committed parts 1 and 2 (git head `aff956e "Enhancements"`). It is in the device folder, not committed to git.

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

## Part 5 — The aurorae as an eye sees them, and the ultraviolet view: done

The owner's question: are the aurorae of Mars, Jupiter, Saturn and Uranus visible to a human eye, or only in ultraviolet? Answer: their bright shapes are ultraviolet (and infrared) images. Visible-light aurora has been photographed only on Mars (Perseverance, March 2024, faint green) and Jupiter (Galileo night side, 1997), and measured on Saturn (Cassini, pink low down, purple at 1,000–1,500 km; Dyudina et al. 2016). Uranus's aurora has never been detected in visible light at all.

1. **Eye view is now the default** (`graphics/planetAurora.js`).
   - Each of the four planets' aurora shells draws at its true faintness in its visible colours. Brightness × 0.06 for Mars, 0.05 for Jupiter and Saturn, 0.035 for Uranus.
   - Colours: Mars green (Perseverance); Jupiter red-to-violet, drawn like Saturn's because Galileo saw it in one band only and its colour was not measured; Saturn pink → purple (Cassini); Uranus a very faint white-pink, drawn although never detected, as the owner asked.
   - Earth is unchanged.
   - New uniforms `uSpectrum`, `uEyeLevel`, `uEyeColorA`, `uEyeColorB`. Switching between eye and ultraviolet sets one uniform and recompiles nothing (`setAuroraSpectrum`).
2. **"See it in ultraviolet"** (`ui/planetDetailsPanel.js`, new `scene/ultravioletView.js`, `main.js`, `css/cinematic-ui.css`).
   - A violet button in the dossier, under the "Aurora · light your eyes cannot see" row (Mars, Jupiter, Saturn, Uranus only).
   - It closes the dossier and changes the whole frame:
     - the planet is redrawn as an ultraviolet camera sees it — a skin built from its own map. Mars goes dark with bright caps and limb; Jupiter and Saturn lose band contrast and get dark polar hoods; Uranus goes nearly blank;
     - all four aurorae go to full ultraviolet brightness;
     - every pixel is shown in one false colour, violet, by a layer blended in `color` mode. It keeps brightness and replaces hue, and the compositor does it, so nothing is redrawn;
     - all guides and the HUD go.
   - **Held still:** clicks, drags, wheel, touch and keys are stopped before anything else in the page sees them. The only ways out are Escape and "Back to visible light".
   - **Cost:** one extra 128×64 sphere with a one-texture shader. The planet's own surface stops drawing meanwhile (`colorWrite`/`depthWrite` off), so the frame is no heavier than normal.
   - **Fixed during testing:** the first version left the surface drawing under the skin. At this scene's depth range the two fought, and the coloured surface broke through in patches. The surface is now switched off while the skin is on.
   - **Measured headless:**
     - Eye mode: the four planets' aurorae at `uSpectrum` 0 with the levels above. Ultraviolet view: all at 1. After exit: back to 0.
     - 0 of 43 guides visible in the view, 29 of 43 after exit (as before).
     - Wheel, drag, click, double-click and keys during the view: the camera only finished its own approach (drift 2.7 units in 6 s with no input, 2.6 with input). The same wheel after exit moved it 20 units.
     - Skin added on entry and removed on exit; no page errors.

## Part 6 — The ultraviolet view, redone from the owner's notes: done

From `Prompts.md` and the reference images in `uvmode/`. Not committed to git.

**What the reference images are** (identified, then copied):
- **Mars 1–4:** MAVEN IUVS, 2016 and 2022–23. Rock is dark olive to tan; clouds, dust, haze and the CO₂ cap are white; ozone is magenta over the winter pole (NASA, "MAVEN Mission Gives Unprecedented Ultraviolet View of Mars").
- **Jupiter 1–3:** Hubble WFC3, released November 2023. Three ultraviolet filters (F225W blue, F275W green, F343N red). Bands are blue, lavender and pink; the Great Red Spot is dark blue because high haze absorbs ultraviolet; the poles have red-brown haze.
- **Saturn 1–3:** Hubble WFPC2 (E. Karkoschka), 2003, ultraviolet and blue. Pastel bands, a green pole, golden rings. Files 1 and 3 are the same image.
- **Uranus 1–2:** neither is ultraviolet.
  - 2 is Hubble NICMOS near-infrared (1997–98).
  - 1 has no source I could find and may be an artwork.
  - Uranus is nearly featureless in ultraviolet. The disc is drawn the way Hubble's 2012 aurora image shows it: pale cyan (Voyager 2) with the aurora as white spots (ESA/Hubble opo1221).

**Changes:**
1. **No more violet over everything.**
   - Each planet gets its own false colour, built from its own map in the skin shader (`UV_LOOK` in `scene/ultravioletView.js`): a six-colour palette following brightness (Mars, Jupiter) or latitude (Saturn, Uranus).
   - Plus the features ultraviolet picks out:
     - Jupiter's Great Red Spot, found in the map at −20°, 135°;
     - polar haze on Jupiter, ozone on Mars, a bright cap on Uranus;
     - Mars's ice caps and broken white cloud;
     - a lit haze at the limb.
   - Saturn's rings stay golden, as in the Hubble image.
2. **The sky goes black.**
   - Hidden: the gas clouds, zodiacal light, dust motes, nebula and cluster sprites, and the flares of the cool stars (Arcturus, Capella, Rigil Kentaurus, Betelgeuse, Aldebaran, Antares, Pollux).
   - Hot stars stay.
   - All of it comes back on exit.
3. **Aurora colours in the view** (`uvA`/`uvB` in `graphics/planetAurora.js`):
   - Jupiter and Saturn: blue-violet to white;
   - Uranus: white;
   - Mars: pale blue-white.
   - The card says plainly that ultraviolet has no colour and this is false colour.
   - `uvGain` lifts Uranus (×1.9) and Mars (×1.2) in this view only.
4. **The camera faces the aurora.**
   - It looks down on the auroral region from about 45° from the lit side, with the terminator in view; for Mars it is turned into the night.
   - Spiral-mode shells are centred on their own pole.
   - Distance is about 4–5 planet radii, within the usual clearance.
5. **Turning is allowed, nothing else.** Drag or the arrow keys turn the camera round the planet. Clicks, hover, wheel and travel are still stopped.
6. **A smaller card** (330 px) that says why the view changed. It also has a "Drag or use the arrow keys to turn" hint and the exit button.
7. **"Aurora · UV mode" in the HUD row** (new `ui/auroraUvMenu.js`).
   - A menu of the four planets; choosing one flies there and opens the view.
   - "Borealis" means northern only, and Mars's aurora is southern, so the label says "Aurora".
8. **Fixed: the info card opening, and "Escape lands me on Moshup".**
   - Presses on the view's card, including "Back to visible light", went on to the scene's window handlers. A press on the planet behind opened its card; a press on empty space left the planet for the previous one.
   - The card now keeps its presses.
   - The Escape keyup and auto-repeat after leaving are swallowed too.
   - The dossier refuses to open while the view is up.
9. **Exit is instant.** The HUD hides and returns without a fade, and there is no tint layer to lift.

**Measured headless:**
- The menu lists the four planets, and choosing Jupiter opens the view.
- 41 sky objects hidden in the view, 0 after exit.
- A drag turned the camera (direction x 0.44 → 0.21); the wheel did not zoom; 4× ArrowRight turned it (0.45 → 0.14).
- Clicking the planet did not open the dossier.
- "Back to visible light" and Escape both leave the view with Jupiter still focused.
- No page errors.

## Part 7 — Aurora in the board, Saturn's rings, Uranus, stronger aurorae: done

Not committed to git.

1. **"Aurora · UV mode" moved from the HUD to the board** (`ui/celestialBoard.js`).
   - A violet pill beside "N moons" for Mars, Jupiter, Saturn and Uranus.
   - It closes the board and flies to the planet. Once the camera has arrived, it opens the planet's card at a new aurora section. The card freezes the scene, so opening it earlier would stop the flight.
   - The HUD control and `ui/auroraUvMenu.js` are gone. The file was moved to `_to_delete/` on the device.
2. **The card's aurora section** (`ui/planetDetailsPanel.js`), on all four planets, above "Explore scientific details". It has three headings — "How the aurora happens", "At both poles?" and "Why ultraviolet" — and the "See it in ultraviolet" button. It replaces the older "light your eyes cannot see" row.
   - **Mars:** no global magnetic field, so no polar aurora. Discrete aurora forms over the magnetised southern crust, diffuse aurora covers the whole night side in solar storms, and proton aurora lights the day side (Schneider et al.; arXiv 2209.15229).
   - **Jupiter:** both poles at once, powered by Io's plasma plus the solar wind. The northern oval is more lopsided (Juno).
   - **Saturn:** both poles, driven by the solar wind, with Enceladus plasma.
   - **Uranus:** both magnetic poles, which lie far from the spin poles (Voyager 2 in 1986; Hubble STIS 2011–14, Lamy et al.).
3. **Saturn's rings in the view** (`createUltravioletRings`).
   - The particle rings are swapped for a banded disc coloured after the same Hubble 2003 image:
     - C ring dark blue-grey;
     - B ring cream to peach-orange;
     - Cassini Division near-empty;
     - A ring cream, with the Encke Gap.
   - Boundaries come from `saturnRings.js`.
   - The planet's shadow falls across the rings, and the unlit face is dimmer.
   - The particle rings come back on exit.
4. **Uranus redrawn in far ultraviolet.**
   - Near ultraviolet looks like the visible view, which is why nothing changed before. Its aurora has only been imaged in far ultraviolet, where the disc reflects little sunlight.
   - So the disc is now dark blue-grey with a faint hydrogen rim, and the visible-light haze shell is switched off in the view.
5. **Stronger aurorae in the view** (`uvGain`, and the new `uvDayLift`, in `graphics/planetAurora.js`):
   - Jupiter ×2.0, Mars ×2.4, Saturn ×1.3, Uranus ×3.0.
   - The sunlit side no longer hides them, except mostly on Mars, whose aurora is a night-side glow.
   - Default (eye) brightness is unchanged.
6. **Framing:** a little wider — 5.2 to 6.0 planet radii — so the whole disc and its polar aurora fit beside the card.

**Measured headless:**
- The board shows four aurora pills.
- Jupiter's pill flew there and opened the card at the aurora section. Earth's card has no section.
- **Saturn:** the UV rings are added and the particle fields hidden; after exit the UV rings are gone and the particles are back.
- **Uranus:** the haze shell is hidden in the view and restored after.
- Arrow keys and drag still turn the camera. No page errors.

## Part 8 — Rings for all three, and Uranus redone again: done

Not committed to git.

1. **Ultraviolet rings for Saturn, Jupiter and Uranus.** One banded disc per planet replaces its particle rings in the view, with the planet's shadow across it (`RING_LOOKS` in `scene/ultravioletView.js`).
   - **Saturn:** as in Part 7.
   - **Jupiter:** I couldn't find a published ultraviolet image of the rings, so they follow the rings' spectra.
     - The main ring is red in visible and near-infrared light, so it is dimmer at short wavelengths: a dim warm grey.
     - The halo is neutral to blue and made of finer dust, so it holds up: a faint blue-white.
     - The gossamer rings are barely there.
   - **Uranus:**
     - The narrow rings are very dark (about 2 % albedo) and grey, so they are drawn as faint grey lines, with epsilon the strongest. Hubble's 2022 ultraviolet aurora images show "a faint ring".
     - The mu ring is blue, from fine dust shed by the moon Mab, so it is drawn faint blue.
     - The nu ring is red, so it is fainter still and warm (de Pater et al. 2006, Science 312, 92).
2. **Uranus follows Hubble's October 2022 ultraviolet aurora images** (ESA/Hubble heic2503, released 2025):
   - a blue disc with a slightly darker collar;
   - a white haze cap over the north pole;
   - a faint grey ring;
   - the aurora as blue-purple glows (`uvA` violet, `uvB` pale blue).
   - The aurora's place is backed by JWST (January 2025; Tiranti et al. 2026): two bands near the magnetic poles, far from the spin poles, with a dimmer gap between them.
   - The card's "Why ultraviolet" text is updated to match.

## What to test (part 8)
1. **Jupiter in UV:** a dim warm-grey main ring with a faint bluish haze inside it, and no particle ring.
2. **Uranus in UV:**
   - a blue disc, with the white cap if the north pole faces you (turn to find it);
   - thin grey rings and a faint blue outer ring;
   - violet-blue aurora patches.
   - After leaving, the normal rings and colours are back.
3. **Saturn:** unchanged from Part 7.

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

## What to test (part 5)
1. **Eye view.**
   - Fly to Mars, Jupiter, Saturn and Uranus. Each aurora should be barely there — you may need to look hard at the poles (Mars: the night side).
   - Earth's aurora is as bright as before.
2. **The button.**
   - Open Jupiter's card → "Explore scientific details" → under the aurora row, "See it in ultraviolet".
   - Earth's card has no button.
3. **The ultraviolet view.**
   - The whole screen turns violet: the planet, its moons, the rings, the stars and the Milky Way.
   - Jupiter's disc goes paler with soft bands; the aurora rings at the poles are bright.
   - The HUD, cards and orbit lines are gone; a panel at bottom right explains what you see.
4. **The lock.** While in the view:
   - scroll, drag, click a moon, double-click, and press arrow keys or W;
   - nothing should move, open or highlight.
5. **Leaving.**
   - Escape brings everything back: the colours, the HUD, the orbit lines, and the faint eye aurorae.
   - Do it again and leave with the "Back to visible light" button instead.
   - After leaving, scroll and drag work normally.
6. **Other planets.** Repeat with Saturn (the aurora ring shows at the pole), Mars (the dark disc with a bright limb) and Uranus (an almost blank disc).
7. **Frame rate.** It should be the same in and out of the view.

## What to test (part 6)
1. **HUD.** "Aurora · UV mode" sits in the top row, and its menu lists Mars, Jupiter, Saturn and Uranus. Pick Jupiter:
   - the camera flies there and turns to look down at the north pole;
   - blue/pink bands, a dark blue Great Red Spot and a red-brown polar hood;
   - a blue-violet aurora at the pole;
   - a black sky with few stars.
2. **Turning.** Drag and use the arrow keys: the planet turns. The scroll wheel does nothing, and clicking the planet or a moon opens nothing.
3. **Leaving.**
   - Click "Back to visible light": you are still at Jupiter, and no info card opens.
   - Enter again and press Escape once: you are still at Jupiter, not at the previous body.
   - Press Escape again: it now leaves Jupiter as usual.
4. **Saturn:** pastel bands, golden rings, a blue-violet aurora ring at the pole.
5. **Mars:**
   - olive and tan rock on the lit side, magenta ozone at the south pole;
   - blue-white aurora patches on the night side.
6. **Uranus:** a pale cyan disc with white aurora spots away from the poles. They are small; turn to find them.
7. **The info card route still works:** a planet's card → "See it in ultraviolet".
8. **After leaving:** the nebulae, the HUD and the orbit lines come back at once.

## What to test (part 7)
1. The HUD row no longer has "Aurora · UV mode".
2. Open All bodies. Mars, Jupiter, Saturn and Uranus each have a violet "Aurora · UV mode" pill next to their moon count.
3. Press Jupiter's pill: the board closes, the camera flies to Jupiter, and Jupiter's card opens at "Aurora · UV mode". It should say how the aurora happens, whether it lights both poles, and why it is shown in ultraviolet.
4. In the card, press "See it in ultraviolet": the aurora at the pole should be clearly brighter than last time.
5. Saturn: the rings are cream and peach with a dark blue inner ring, and the planet's shadow falls across them. After leaving, the normal particle rings are back.
6. Uranus: a dark disc with a faint blue rim, and bright white aurora spots. After leaving, Uranus looks normal again.
7. Mars: blue-white aurora patches on the night side in the south, brighter than before.
8. Earth's card has no aurora section.

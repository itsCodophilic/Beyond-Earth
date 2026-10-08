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

## Part 9 — Ring shadows, everywhere: done

Not committed to git.

1. **In the normal view, every ring system now takes its body's shadow** (new `graphics/ringShadow.js`, hooked in `planetFactory.js` and `smallBodies.js`).
   - This covers Saturn, Jupiter, Uranus and Neptune, the rings of Haumea and Quaoar, and Chariklo's and Chiron's.
   - **How:** one patch works for every ring material, the hand-written particle shaders and three's `PointsMaterial` alike. The shader's own `main` is renamed and wrapped. The new vertex `main` turns `gl_Position` back into a view-space point and asks whether the line from it to the Sun (at the origin) passes through the body. The fragment multiplies its colour by the answer.
   - **Cost:** a few operations per particle and nothing per pixel; the uniforms are set in `onBeforeRender`.
   - The shadow keeps 10 % of the light, and its edge is softened over 3 % of the radius.
   - **Measured:** from behind each body, the shadow darkens 2.8 % of the screen at Saturn, 6.8 % at Jupiter, 0.5 % at Neptune and 0.4 % at Haumea.
   - At Uranus it is 0.03 %. That is right for now: Uranus's pole points close to the Sun this decade, so its rings face the Sun and lie mostly outside the planet's shadow. It is the same reason they are rarely eclipsed near solstice.
   - No shader errors.
2. **Jupiter's ultraviolet rings no longer look broken.**
   - The first version drew the shadowed arc as a dark film over the stars.
   - A dust ring in shadow mostly fades instead (`glow` 0.65), so it runs on through the shadow as a dim band.
   - Saturn's dense rings keep a dark band (`glow` 0); Uranus's are in between (0.5).
   - The ultraviolet view already shadowed Uranus's rings.

**Aurorae on bodies in the scene that are not drawn (researched, not built):**
- **Neptune:**
  - ultraviolet hints from Voyager 2 (1989);
  - infrared H₃⁺ aurora confirmed by JWST (June 2023 data, published 2025, Nature Astronomy), in the southern mid-latitudes (30–60° S), where its tilted field puts the auroral zone.
- **Jupiter's moons (Io, Europa, Ganymede, Callisto):**
  - oxygen aurorae, in ultraviolet from Hubble;
  - in visible light, faint red and green oxygen plus sodium and potassium, seen from Keck while the moons were in Jupiter's shadow (2023);
  - Io's is the brightest; Ganymede's two ovals are evidence for its underground ocean.
- **Venus:** a faint green oxygen glow, with no global magnetic field.
- **Mercury:** an X-ray aurora where solar-wind electrons hit the bare surface (BepiColombo, 2023).
- **Comet 67P:** a far-ultraviolet aurora from solar-wind electrons in its coma (Rosetta, 2020).
- **Triton:** possible ultraviolet emission from electrons out of Neptune's magnetosphere (Voyager 2) — not settled.
- **Not on the list:** the Moon, Pluto and Charon have no aurora detected.

## What to test (part 9)
1. **Saturn:** fly behind the planet (to its night side) and look back. A dark band, the planet's shadow, lies across the rings behind it.
2. **Jupiter (normal view):** the faint rings dim where they pass behind the planet.
3. **Jupiter (ultraviolet):** the ring runs on through the shadow as a dimmer band, with no dark patch hiding the stars.
4. **Neptune, Haumea and Chariklo:** the same dimming behind the body, and nothing else changed.
5. **Frame rate:** unchanged at Saturn.

## What to test (part 10)
1. **All bodies:**
   - The new filter "UV mode · aurora" lights Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and 67P.
   - Each has an "Aurora · UV mode" pill.
   - In Jupiter's moon board, Io, Europa, Ganymede and Callisto each have an aurora button on their card.
2. **Each pill or button:** the camera flies there and the card opens at the aurora section; "See it in ultraviolet" opens the view. Check:
   - **Neptune:** a blue disc and a cyan aurora band in the south.
   - **Venus:** a blue-white ultraviolet cloud face, with a faint aurora on the night side.
   - **Mercury:** a grey disc and a teal X-ray glow on the dawn edge.
   - **Io:** two bright spots at the equator, on the Jupiter-facing and far sides.
   - **Europa:** a patchy glow.
   - **Ganymede:** blue ovals.
   - **Callisto:** a faint haze.
   - **67P:** a violet coma round the nucleus.
3. **Eye view:** Io's aurora is very faint, and the others are almost invisible. Mercury's and 67P's are not drawn at all.
4. **Ring shadows:** at Saturn, Jupiter, Uranus, Neptune, Haumea, Quaoar, Chariklo and Chiron, the part of the ring in the planet's shadow is darker but still visible. Check this in both the normal and the ultraviolet view.

## What to test (part 11)
1. **Aurorae look like glow, not a second surface:**
   - Mars: wait for the storm surge in the normal view.
   - Venus, Mercury, Jupiter, Saturn, Uranus, Neptune, Io, Europa, Ganymede and Callisto: check each in UV.
   - The night side shows the planet's own surface with a soft glow over it.
2. **Mercury's aurora** is violet-blue.
3. **67P in UV:** a soft violet glow around the nucleus, with no cage.
4. **Saturn in UV:** the rings are still made of particles, now peach, cream and blue.
5. **Jupiter, both views:** the ring passing through Jupiter's shadow is dimmer but still visible, not broken.
6. **Ganymede in UV:** Io, Europa and Callisto in the distance stay as normal.

## What to test (part 12)
1. **Jupiter in UV:** the aurora glows only round the north pole. Turn to the night side: it shows the same bands, dimmer, with no glow or lines across it.
2. **Venus and Mars in UV:**
   - Venus: a soft glow along the night-side limb only.
   - Mars: glowing patches in the south, on the night side.
   - Neither should have long lines across the planet.
3. **67P in UV:** a still violet glow, with nothing pink moving as you turn it.
4. **Saturn:** unchanged.
5. **Uranus, Neptune and the four big moons:** same check as Jupiter — the aurora only where it belongs.

## What to test (part 13)
1. **Venus, Mars, Uranus and Neptune in UV, plus Mars's storm glow in the normal view:** soft patches of light, with no curved lines running across them.
2. **The four big moons in UV:** the same.
3. **67P in UV:** an even blue-violet glow over and around the nucleus, with no pink edge as it turns.
4. **Jupiter and Saturn:** still as you liked them, with curtains in their polar spirals.

## What to test (part 14)
1. **Europa and Callisto in UV:** a thin ring of light round the edge of each moon. Turn them: the surface on the face, day and night side, looks the same as in the normal view, only coloured for UV.
2. **Every other body:** unchanged from the last round.

## Part 10 — Aurorae for eight more bodies, a "UV mode" filter, softer shadows: done

Not committed to git.

1. **New aurorae** (new `graphics/extraAurorae.js`, colours in `graphics/planetAurora.js`). These use the same shells as the giants: barely there to the eye (or not drawn at all where no eye could see them), and full strength in the ultraviolet view.
   - **Neptune:** a partial band across 30–60° S, where JWST found it in infrared (June 2023 data; Melin et al. 2025), and a faint northern counterpart. Cyan in the view, as in JWST's image.
   - **Io:** the two equatorial spots, facing towards and away from Jupiter, plus a faint limb glow. The shell is turned every frame to face Jupiter. To the eye: red, green and blue, the brightest of the moons.
   - **Europa:** a patchy oxygen glow over the whole disc.
   - **Ganymede:** two auroral ovals at about ±43°, blue in the view, as in Hubble's image.
   - **Callisto:** a faint, diffuse glow.
   - **Venus:** a diffuse night-side glow; to the eye, a faint green.
   - **Mercury:** an X-ray glow on the dawn side at the surface, turned every frame to stay at dawn. Drawn only in the view, and the card says it is X-rays.
   - **67P:** a far-ultraviolet coma glow about 1.8 nucleus radii out. Drawn only in the view.
   - **Triton:** left out, because its aurora is unconfirmed.
2. **Ultraviolet looks for each** (`UV_LOOK`):
   - Neptune: Hubble's blue with white clouds, from the JWST composite;
   - Venus: Mariner 10's blue-white ultraviolet clouds with dark absorber streaks;
   - Mercury: dim grey, so the X-ray glow shows;
   - Io: sulfur dark, SO₂ frost bright (new `whiteness` option);
   - Europa, Ganymede and Callisto: dim greys;
   - 67P: no skin.
   - Neptune's rings get ultraviolet bands: dark, reddish dust, so dim warm grey.
   - The visible-light cloud and haze layers of Venus and Neptune are switched off in the view.
3. **Cards:** every new body's card has the aurora section — how it happens, at both poles?, and why ultraviolet.
4. **Finding the bodies:** moons are built a few at a time after the opening, so the view and the board pill find any body by name. Travelling there builds a moon that isn't built yet, and its aurora is attached before the view switches on.
5. **The board:**
   - a new filter, **"UV mode · aurora"**. It lights every chip with an aurora view, and Jupiter for its moons;
   - the "Aurora · UV mode" pill on Mercury, Venus, Neptune and 67P (Mars, Jupiter, Saturn and Uranus already had one);
   - an "Aurora · UV mode" button on the moon card of Io, Europa, Ganymede and Callisto.
6. **Shadows on rings, in every mode:**
   - The shadowed arc now keeps 24 % of its light (was 10 %), in its own colour, as in Saturn's ultraviolet view.
   - Dust rings in the ultraviolet view keep at least half their opacity there.

**Measured headless:**
- All eight shells are attached; Mercury's and 67P's are hidden outside the view.
- The filter lights the right chips; the pills, and the moon card button for Ganymede, are present.
- Io's aurora pill flies there and opens the card at its aurora section.
- The ultraviolet view opens on Neptune, Ganymede, Io, Venus, Mercury and 67P.
- No page errors.

## Part 11 — The owner's eight observations (Prompts.md): done

Not committed to git.

1. **"The back side does not match the front" (points 1, 2, 3, 5, 6, 7) — one cause, in the shared aurora shader** (`graphics/planetAurora.js`).
   - Its brightness came from two noise fields at 8×28 and 22×58 cells, which drew a hard, blotchy pattern.
   - Spread over a night side (Mars's storm aurora, Venus, the moons) or a polar cap, it read as a second surface painted on the planet, not as light above it.
   - Now there is one slow, large-scale variation, the arcs of the oval, and thin rays inside the band, and the latitude noise is smoothed.
   - Every aurora's place, colour and timing are unchanged.
   - Earth's aurora does not use this shader and is untouched.
2. **Mercury's aurora** is violet-blue (`uvA` 0x8a6bff, `uvB` 0x7f9cff).
3. **67P** — rechecked: its aurora is real (Galand et al. 2020, Nature Astronomy; the first aurora found at a comet).
   - The sphere shell looked like a cage. A coma has no surface, so it is now a soft violet glow fading outwards from the nucleus, on a camera-facing sprite that swells slowly.
4. **Saturn's rings in UV stay particles.**
   - The banded disc is gone. Every ring particle keeps its own brightness and takes its band's false colour, through the same shader patch as the shadow (`setRingUltraviolet` in `graphics/ringShadow.js`).
   - The same applies to Jupiter, Uranus and Neptune.
   - Saturn's band hues are stronger: peach-orange B ring, cream A ring, blue C ring.
5. **Shadowed ring arcs stay visible** in both modes:
   - shadow floor 32 % for Saturn, 50 % for Jupiter, 40 % for Uranus, 45 % for Neptune, 35 % for the small bodies' rings;
   - set in `planetFactory.js`; `smallBodies.js` uses the 32 % default.
6. **Only the body in view switches to ultraviolet.** Previously every aurora body switched, so distant moons lit up too.

**Measured headless:**
- UV view on Saturn, Jupiter, Venus, 67P and Ganymede; in each case only that body's aurora is switched.
- Saturn's particles show peach, cream and blue against grey-white in visible light.
- 67P is a soft halo; Ganymede's band is smooth.
- No page errors.

## Part 12 — Aurorae kept to their own regions: done

Not committed to git.

1. **Why the far side still looked different** (Jupiter, Venus, Mars):
   - The shell's diffuse part was spread over the whole sphere (`mix(band, 1.0, diffuse)`). Jupiter's polar fill (22 %) and Mars's storm glow therefore lit the far side of the planet too, in long arcs.
   - In the ultraviolet view, `uvGain` and `uvDayLift` made that bright.
   - Now the diffuse glow reaches a few band-widths from its own oval (`regionBand` in `graphics/planetAurora.js`).
   - Arcs and rays are drawn only on the oval itself; the rest of the glow is smooth.
   - The broad night-side glows of Venus, Europa and Callisto still cover their discs, but more softly. Venus no longer gets a dayside lift, and its gain is 1.2. Europa's and Callisto's faces are dimmer (the glow sits at their limbs), with a dayside lift of 0.5.
2. **The skin's night side** keeps 8 % of its light (was 3 %), so it reads as the same surface in shadow.
3. **67P:** in the view, its visible-light coma, tails and vents are hidden. They were the pink patterns sliding over the glow as it turned. The ultraviolet halo replaces them. The `hide` list now matches at any depth in the body.

**Measured headless:**
- Jupiter's aurora is at the pole only, and its night side shows the same bands, dimmer.
- Venus has a soft glow at the night limb.
- Mars's aurora is confined to the southern night side.
- 67P shows a halo with nothing moving across it.
- No page errors.

## Part 13 — No more "watermelon" stripes; 67P's glow without the pink edge: done

Not committed to git.

1. **The stripes** (`graphics/planetAurora.js`).
   - The arcs, the rays and the shell's ridges were all `sin(longitude × k)`: stripes running pole to pole.
   - Inside a full spiral round a pole (Jupiter, Saturn) they read as curtains, and they stay there.
   - Every other aurora — Mars, Venus, Uranus, Neptune, the moons and Jupiter's polar fill — is now a smooth glow with slow, large-scale variation. Its ridges and rays are off and its arcs come from smooth noise (`raysOn`, set when `spiralStrength` ≥ 0.95).
2. **67P** (`graphics/extraAurorae.js`).
   - The glow is a flat card through the comet's centre. With depth testing, the half of the nucleus behind the card was tinted and the front half was not, which made a pink edge that slid round as the comet turned.
   - Depth testing is now off, so the glow lies evenly over and around the nucleus, as the coma surrounds it.
   - It is also blue-violet (0x6f86ff) rather than lavender, which read as pink over grey rock.

**Measured headless:**
- Venus, Mars, Uranus and Neptune show soft glows with no stripes.
- Jupiter's and Saturn's spiral curtains are unchanged.
- 67P has an even blue-violet glow over the nucleus.
- No page errors.

## Part 14 — Europa and Callisto: the glow at the limb only: done

Not committed to git.

- **Europa:** the aurora is not the whole moon. Its emission comes from the thin oxygen atmosphere and is brightest round the limb (Hubble; Roth et al. 2016). It was drawn over the face as well, which looked as if the surface itself glowed.
- **Callisto:** the same. Its night-side face glowed and no longer matched the day side.
- **The fix:** both are now a ring of light at the limb, and the face — day and night side — keeps its own surface. This uses `faceOnVisibility: 0` and a new `limbGlowStart: 0.5`.
- **Other bodies untouched:** `limbGlowStart` defaults to 0.03, the value every other aurora always had, so their shaders are byte-for-byte the same.
- The view's card text and the dossier's "At both poles?" for both moons now say it is the atmosphere that glows, not the surface.

**Measured headless:** Europa and Callisto show a limb ring with an unchanged face. No page errors.

**Later the same round: the descriptions spell it out** (the owner: "highlight this in the description"). Europa's and Callisto's cards ("How the aurora happens", "At both poles?") and their ultraviolet-view text now say:
- **Why not at the poles:** neither moon has a magnetic field of its own, so Jupiter's field makes its whole thin atmosphere glow.
- **Why a ring:** the glow is seen as a ring at the edge because your line of sight runs along the gas there.
- **Europa:** brightest on the dusk side (Hubble, Roth et al. 2016; confirmed in visible light by de Kleer & Brown 2018).
- **Callisto:** only ever measured as one combined light (Keck, 2023), so where it is brightest is not yet known.

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
8. Earth's card has no aurora section. (Changed in part 8: Earth now has one.)

## Part 8 — Where and how, for every aurora
The owner asked for every body with an aurora to say where and how it happens, Earth included. Text only; nothing visual changed on any planet.

- Earth has an aurora section now. It covers how the solar wind's stretched magnetotail snaps and fires electrons down the field lines. It says where: oval rings at about 65–75° magnetic latitude around both poles (borealis and australis), widening towards the equator in storms, about 100–300 km up. It also says what you would see: green and red oxygen, blue and purple nitrogen.
- Earth's aurora is visible light, so its section is headed "Aurora · visible light", its third heading reads "What you would see", and it has no "See it in ultraviolet" button.
- The board shows an "Aurora" pill beside Earth's moon count, without "UV mode". Earth stays out of the "UV mode · aurora" filter.
- The card heading "At both poles?" is now "Where it happens" on every body. Every text under it names a place:
  - Mars: Terra Sirenum and Terra Cimmeria, 30–60° S, on the night side.
  - Jupiter: rings round both magnetic poles, with the moon footprints just outside them.
  - Saturn: 70–80° in both hemispheres.
  - Uranus and Neptune: around their tilted magnetic poles, well away from the spin poles.
  - Io: equatorial spots.
  - Europa and Callisto: all around, in the atmosphere.
  - Ganymede: 40–50° rings.
  - Venus: the night side.
  - Mercury: the dawn-side surface.
  - 67P: the coma.
- Files: `ui/planetDetailsPanel.js`, `ui/celestialBoard.js`, `main.js` (the aurora-info handler accepts Earth).

## What to test (part 8)
1. Open All bodies: Earth has a violet "Aurora" pill. Press it. The camera returns to Earth, and the card opens at "Aurora · visible light", with the sections "How the aurora happens", "Where it happens" and "What you would see". There is no ultraviolet button.
2. Press Mars's "Aurora · UV mode" pill. "Where it happens" names Terra Sirenum and Terra Cimmeria, and the ultraviolet button is still there.
3. Spot-check Jupiter, Saturn, Uranus, Neptune, Io, Europa, Ganymede, Callisto, Venus, Mercury and 67P. Each card says where its aurora is.
4. Nothing looks different on any planet, in either view.

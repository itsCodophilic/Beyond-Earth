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
- ~~More Centaurs, a near-Earth asteroid population, Neptune's Trojans, the solar wind and the heliosheath, spacecraft, magnetospheres, tidal locking, the Laplace resonance and seasons~~ — done in Part 15.
- ~~How the Solar System formed~~ — done in Part 16, with the other planets' Trojans, Dziewanna and the Kirkwood gaps.
- **Still blocked:** real textures for Nix, Hydra, Kerberos, Styx and the Rank 6 moons need images (the image hosts are blocked from the build environment); Vesta/Pallas/Hygiea/Psyche surfaces and gaps in the 3D belt need `asteroidBelt.js` unfrozen.

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

## Part 15 — Populations, spacecraft, magnetospheres and the solar wind, how it works: done
The owner asked for "everything at once" of what Part 3 still listed. Nothing on the existing planets changed; the new layers are off until asked for, except the population clouds and the spacecraft, which are always drawn.

**Populations** (`scene/smallBodies/populationCatalogue.js`, `populationClouds.js`)
- 1,038 more Centaurs, 891 near-Earth asteroids (all 38 known Atiras, plus the 30 Atens, 427 Apollos and 396 Amors about 1 km or larger, H < 17.75, apart from the ones already drawn individually) and 42 Neptune Trojans, each on its real JPL orbit, moved on the graphics card (one draw per family).
- Nessus, Asbolus, Hylonome and Bienor as full bodies, with colours from Peixinho 2012 and shapes from their measured sizes.
- Hovering Neptune's L4 or L5 shows a band with a card, like Jupiter's camps.

**Spacecraft** (`scene/spacecraft.js`, `spacecraftCatalogue.js`, `spacecraftPaths.js`)
- Voyager 1 and 2, Pioneer 10 and 11, New Horizons, Parker Solar Probe, Europa Clipper, JUICE, Lucy and Psyche, at today's position from JPL Horizons.
- The path already flown is solid; the route still to fly is dashed.
- Each can be focused and has a card. The readout says "spacecraft track (JPL Horizons)".
- Past 40 AU each is placed against the drawn heliosphere, so the Voyagers are outside the drawn heliopause and New Horizons is inside the drawn termination shock, as in reality. Juno is left out: NASA has not said whether it still operates.

**The heliosheath and the solar wind** (`scene/outerBoundaries.js`, `scene/solarWind.js`)
- The heliosheath is a hover band of its own, between the termination shock and the heliopause.
- The solar wind is 6,000 particles plus eight Parker-spiral field lines out to 10 AU. Fast above 25° latitude, slow near the equator; it slows, reddens and bends tailward in the heliosheath and stops at the heliopause. Off until switched on from the board.

**Magnetospheres** (`graphics/magnetospheres.js`)
- Mercury, Earth, Jupiter, Saturn, Uranus, Neptune and Ganymede: bow shock, magnetopause, tail, belts and plasma tori, with field lines, labelled. Sizes come from spacecraft measurements and are scaled with each planet's moons, so Io's torus sits on Io's orbit.
- Switched on from the planet's card ("Show its magnetosphere") or the board. The camera pulls back to fit it. Labels appear only when the diagram is big enough to read, are kept on screen, and step aside when two would overlap.

**How it works** (board, filter "How it works")
- Nine explanation views: Centaurs, near-Earth families, Neptune's company, spacecraft (with a 1972–2033 replay), magnetospheres, the solar wind, tidal locking, the Laplace resonance and seasons.
- Each has a "show it in the scene" button that closes the board and lights the thing up. A note at the top right says what is on and has its own Hide button.

**Files:** new — the six above plus `ui/explainerView.js`, `ui/explainers/{common,populations,spacecraft,fields,mechanisms}.js`, `ui/sceneLayerChips.js`. Changed — `smallBodies.js`, `centaurCatalogue.js`, `outerBoundaries.js`, `distanceFromEarth.js` (spacecraft readout label), `celestialBoardData.js`, `celestialBoard.js`, `boardGlossary.js`, `planetDetailsPanel.js`, `main.js`, `binary-system.css`, `cinematic-ui.css`.

## What to test (part 15)
1. **Board → "How it works" filter.** Open each of the nine views. Check that pictures animate, the mode buttons switch, and no text overlaps or runs out of its box.
2. **Spacecraft.** In the spacecraft view, press "Replay 1972 – 2033"; the probes should bend round Jupiter and Saturn. On the board's "Spacecraft" filter, click Voyager 1. The camera travels there, and the card shows "Launch and flybys", "What still works" and "Where its position comes from" (not "Gravity"). The distance readout says "spacecraft track".
3. **Dashed future paths.** Focus Lucy or Europa Clipper: the route ahead is dashed, the route behind solid.
4. **Magnetospheres.** Open Jupiter's card and press "Show its magnetosphere". The card closes, the camera pulls back, and the shells, belts, Io torus and field lines appear with readable labels. "Hide" in the top-right note removes it. Repeat for Earth, Saturn, Uranus (tilted), Neptune, Mercury and Ganymede. When you scroll far out, the labels should fade away instead of piling up.
5. **Solar wind.** From the solar-wind view, press the scene button, then scroll out to the whole system. Particles should stream out, faster at the poles. Watch for spiral lines in the ecliptic and reddening near the edge. "Hide" switches it off.
6. **Populations.** From the Centaurs, near-Earth or Neptune views, press "Light them up". The right family brightens for 45 seconds (or until "Done"). Hover near Neptune's orbit 60° ahead of and behind Neptune to see the L4/L5 bands.
7. **The heliosheath.** Hover between the termination shock and the heliopause: its own card appears, and both shells light up.
8. **New Centaurs.** Search or travel to Nessus, Asbolus, Hylonome and Bienor. Nessus should look reddest. Bienor should be elongated.
9. **Performance.** With everything switched on, scrolling should feel as smooth as before. The clouds are drawn on the graphics card, and the wind and diagrams cost nothing while off.

## Part 16 — Everything left except space events: done
The owner asked for everything still pending, except space events. All of it is either built here or blocked for a reason listed at the end.

1. **Every planet's Trojans** (`populationCatalogue.js` `PLANET_TROJANS`, `populationClouds.js`, `smallBodies.js`).
   - Each Trojan rides in its own planet's frame, as Neptune's do:
     - Venus: 2013 ND15.
     - Earth: 2010 TK7 and 2020 XL5.
     - Mars: the 17 shown stable — 2 at L4, plus Eureka and 14 more at L5.
     - Uranus: 2011 QF99 and 2014 YX49.
   - Elements are from JPL SBDB, 10 October 2026.
   - Uranus's two were taken out of the Centaur cloud (now 1,036), so they are not drawn twice.
   - Venus, Mars and Uranus join `CO_ORBITAL_PLANETS` (Standish elements).
   - Mars's L4 and L5 camps have hover bands with cards, like Neptune's.
   - New board view, **"Every planet's Trojans"**: one mode per planet, with the planet held still at the top. Each Trojan is shown with the loop it traces over a year. Includes a "Light them all up" button.
   - **Measured:** after loading, each camp sits on its own side of its drawn planet. Mars L5 points are 61–88° behind Mars, Mars L4 56–74° ahead, Earth's 12° and 62° ahead.
2. **Dziewanna** (`tnoCatalogue.js`, its own Arrokoth-relief map `dziewanna.jpg`, `kuiperBelt.js` member list).
   - Size 470 km, albedo 0.25 (Herschel, Pál et al. 2012); 7.07 h rotation; red (g′−r′ 0.80).
   - JPL orbit solution 12; in Neptune's 2:7 resonance.
3. **Kirkwood gaps & asteroid families** (new `ui/explainers/belt.js`, board, "How it works").
   - A histogram of all 861,399 numbered asteroids by orbit size, from 88 SBDB count queries.
   - The 4:1, 3:1, 5:2, 7:3 and 2:1 gaps are marked, plus the Hildas gathering at 3:2.
   - An animation of why: a 3:1 asteroid passes Jupiter at the same two places every time.
   - The eight largest families, drawn as soft regions on an orbit-size vs tilt chart (Nesvorný et al. 2015).
   - The 3D belt is unchanged (`asteroidBelt.js` stays frozen), and the view says so.
4. **How the Solar System formed** (new `ui/explainers/formation.js`): six stages — cloud, disc, Jupiter, rocky worlds, giants move, settled.
   - A log-time clock shows where each stage sits.
   - Dates are the measured ones: CAIs 4,567.30 Myr (Connelly 2012), Jupiter's core about 1 Myr (Kruijer 2017), Mars 2–4 Myr, the gas gone by about 4 Myr (Wang 2017), the Moon-forming impact, the early giant-planet instability (Nesvorný 2018), the 4.4 Gyr zircons.
5. **Magnetosphere note** now says it is a diagram — "it gives off no light you could see" (the `not-covered.md` band rule).

**Still blocked:**
- Real textures for Nix, Hydra, Kerberos, Styx and the Rank 6 moons need source images. The image hosts are blocked from here, so the owner has to supply them.
- `asteroidBelt.js` (frozen) blocks Vesta, Pallas, Hygiea and Psyche surfaces, and gaps or families in the 3D belt.
- `vite build`, KTX2 compression and a visible-tab timing run only on the owner's Mac.

## What to test (part 16)
1. **Board → "Every planet's Trojans"** (in the inner planets column, or the "How it works" and asteroid filters).
   - Click Venus, Earth, Mars, Uranus and Neptune in turn. Each planet stays at the top with its Trojans' loops round the 60° points.
   - Venus's single loop is huge; Mars's are small and clustered behind it.
   - "Light them all up" closes the board and lights every camp. The top-right note names all five planets.
2. **Mars's camps in the scene.** Fly to Mars and zoom out until its orbit is visible. Hover about 60° ahead of and behind Mars along its orbit: a card appears ("Mars's Trojans · L4 / L5") and that camp brightens.
3. **Board → "Kirkwood gaps & asteroid families"** (asteroid belt column).
   - "1 · The count" shows the histogram with deep notches at the dashed lines and a spike at the Hildas.
   - "2 · Why the gaps": the orange asteroid's rings pile up at two spots, while the blue one's spread all round.
   - "3 · The families": eight labelled blobs, with the gaps cutting through.
4. **Board → "How the Solar System formed"** (Sun column). Step through all six modes. Check that the bar at the bottom moves to the right span, and that nothing overlaps.
5. **Dziewanna.** Search for it on the board and fly there. It should be a slightly reddish, slightly elongated world, with a card that says 2:7 resonance and 470 km.
6. **Centaurs** still light up as before (1,036 now).
7. **Smoothness:** no change expected. Five tiny point clouds were added.


## Part 17 — Prompts.md, round 38: done

**Moved to the space events, as "Coming soon"** (`spaceEventsDashboard.js`, `COMING_SOON`):
- How the Solar System formed, The solar wind, Magnetospheres and Why there are seasons are listed, disabled, under the event list.
- Their first versions were taken out of the site. The code and full implementation notes are kept in `docs/archive/space-events-coming-soon/` (README.md says how each worked, for the redesign).

**Near-Earth families, redesigned** (the "sparkling" points are gone):
- 20 real rocks (`scene/smallBodies/nearEarthFamilies.js`): Atiras — Atira (with its moon), ʼAylóʼchaxnim, 2021 PH27; Atens — Aten, Ra-Shalom, Hathor; Apollos — Apollo (with moon), Icarus, Toro, Nereus, Castalia, Eger, Daedalus, 1989 JA (with moon); Amors — Ganymed, Don Quixote, Ivar, Florence (two moons), Betulia, 1986 DA. Elements, sizes, albedos and rotations from JPL SBDB (10 October 2026), each card citing its sources.
- Surfaces by type: C dark rubble (Bennu relief), S cratered rock with dust ponds (Eros/Itokawa), M metal (1986 DA: metalness 0.85, roughness 0.4, shallow scoops), E bright enstatite, D dark (Don Quixote); Atiras baked (Ida relief). Shapes by family: varied Apollos with binaries, big cratered Amors, small fast Atens.
- Hover or click any near-Earth rock (also Eros, Bennu, Apophis…) and its family's orbits light: 891 real paths (`familyOrbits.js`).
- Four board views (inner column): "In space" (the real rocks rendered with hard light on black, `rockPortraits.js`), "Their orbits", composition chips (rock, metals, water & clays, organics, volatile gases — hover one), a "Misconception · Not a belt" note, fly-to rows, and "Show their paths in space".

**Every planet's Trojans as bodies** (`planetTrojans.js`): Venus 1, Earth 2, Mars 17, Uranus 2 — textured, clickable, with cards. A camp lights (ring + name on each member) from the board, by hovering Mars's camp bands, or by focusing any member. Neptune's 42 stay points.

**Fixes:** Eurybates' moon ring only shows while Eurybates or Queta is focused, and Queta is labelled; the board's Sun dot is white; Kirkwood is labelled as the belt's structure and "Show the gaps in our belt" marks the real lanes on the drawn belt (`kirkwoodOverlay.js`); Dziewanna uses the supplied map; Nessus redrawn from the supplied image; Bienor (and Asbolus, Hylonome) have cratered maps; the Space Dictionary pulses during the tour; "How it works" filter removed; spacecraft removed; the heliosheath is listed on the board and flies there.

**Cost:** 148 small-body meshes, 724,000 triangles (was ~595,000); textures 512 × 256, ~1.3 MB for all 26 new maps. The point clouds dropped from ~1,990 to ~1,080.

## What to test (part 17)
1. **Space events → bottom of the list:** four greyed "(coming soon)" items; their buttons do nothing.
2. **Board → inner column → "The Apollos · near-Earth family"** (then Atiras, Atens, Amors):
   - "1 · In space": the rocks turn, lit from the left, night sides black; names and types under each.
   - "2 · Their orbits": the family's sheaf of orbits, the drawn rocks moving.
   - Hover each composition chip: the line underneath changes.
   - The orange "Misconception · Not a belt" box is at the top right.
   - Click a row (e.g. Florence) → flies there and the card opens.
   - "Show the Apollos' paths in space" → closes the board, zooms out over the Sun and draws the orbits; "Done" removes them.
3. **In the scene:** fly to Ganymed, 1986 DA (metal shine on the lit side), Atira and Florence (moons go round them). Hover any near-Earth rock from afar: its family's paths light faintly.
4. **Board → "Every planet's Trojans":** click Eureka / 2010 TK7 / 2013 ND15 / 2011 QF99 rows → each flies to a real body with a card. "Mars's camps" row → Mars with 17 rings and names. Focusing Eureka lights its whole camp.
5. **Eurybates:** open Mars or Jupiter — no stray ring. Fly to Eurybates — Queta's ring and name appear.
6. **Kirkwood:** board → Kirkwood → "Show the gaps in our belt": dashed rings on the belt, labels spread round it.
7. **Smoothness:** fly round the inner Solar System; it should feel as before.

## Part 18 — Prompts.md observations, round 38 second pass: done

1. **Queta not always highlighted** (`smallBodies.js` `updateMoonView`). A moon's ring and name show only while its parent or the moon is focused, and fade away once the orbit is smaller than about 18 px across on screen — zoom out and they go.
2. **The board resets the journey** (`main.js` `resetSceneForBoard`). Opening All bodies switches off every layer the board turned on and clears the Back history. Choosing something travels from where you are, with nothing to go back through. Closing the board without choosing zooms all the way out to the Solar System.
3. **Heliosheath hoverable in the scene** (`outerBoundaries.js`). Its band was 17 units wide on a 2,600-unit heliosphere (85 → 120 AU is only 43 units on the scene's distance curve), so it was 2–3 px wide. The band is now the whole gap between the two rings and never narrower than 26 px on screen, and it wins where it overlaps the scattered disk or the detached objects.
4. **Bodies to test:** `docs/bodies-to-test.md` lists every named body drawn, as tick-boxes, with the new groups marked.
5. **Kirkwood gaps:**
   - "Show the gaps in our belt" now holds the view. You can turn and zoom in, but not zoom out or click away; Escape releases it.
   - The board lists every family on the chart with a fly-to: Vesta, Flora (and Gaspra), Nysa, Polana, Eunomia, Koronis (and Ida), Eos, Themis and Hygiea.
   - Flora, Nysa, Polana, Koronis, Eos and Themis are new bodies (`familyNamesakes.js`), with JPL SBDB elements, NEOWISE sizes and albedos, and textured maps.
6. **Escape clears board layers** (`sceneLayerChips.js` `hideAll`). The first Escape removes every note (Hide / Done) and its layer together. The next Escape leaves the body as before.
7. **Every Trojan listed and clickable:**
   - Neptune's 42 Trojans are now bodies too (`planetTrojans.js`): 64 Trojans in all, plus Jupiter's six named ones.
   - "Every planet's Trojans" lists all 70 at the bottom right; "Neptune's Trojans" lists its 42.
   - On both diagrams, hovering a dot names it, and clicking flies there.
   - Camp lighting and "Light them up" are removed.
   - Uranus's two now carry plain names (2011 QF99, 2014 YX49).

**Cost:** 196 small-body meshes, 800,000 triangles at most. The 90 new bodies skip drawing while under half a pixel (`cullTiny`), so Neptune's 42 cost nothing from the inner system, and vice versa. The point clouds are now only the Centaurs (one draw call).

## What to test (part 18)
1. **Eurybates:** fly there and Queta's ring and name show. Scroll out a long way and they fade out. Fly to Jupiter: no Queta ring.
2. **Board reset:** fly to Io, then Jupiter, then open All bodies and close it. You should zoom out to the Solar System, not go back to Io. Fly to Mars from the board, then press Escape: you leave Mars straight away.
3. **Heliosheath:** zoom out until the heliosphere is in view, tilted (not edge-on). Hover between the termination-shock and heliopause rings: "The heliosheath" card shows and both shells light.
4. **Kirkwood:** board → Kirkwood → "Show the gaps in our belt". Scrolling out does nothing, scrolling in works, and dragging turns the view. Escape removes the rings and the note and frees the view. Back on the board, try each family row.
5. **Escape:** after any "Show ... in the scene" button, press Escape once. The top-right note and its layer both go.
6. **Trojans:** board → Every planet's Trojans → Neptune. Hover the dots (each is named) and click one: you fly to it. Check that the list at the bottom right has all of them.
7. **Smoothness:** fly round the inner and outer Solar System. It should feel as before.

## Part 19 — Every near-Earth asteroid, as rocks you meet: done (38,422 of 42,712)

- **Data:** the owner downloaded the JPL list in the browser (`webresponse/`, 5 of 6 files). This session's network cannot reach JPL. `tools/neo-catalogue/build-neo-catalogue.mjs` turns it into `public/assets/data/near-earth-asteroids.json`: 38,422 rows, 3.4 MB, about 0.9 MB compressed, fetched 4 s after the scene starts. The 36 already drawn as detailed bodies (Eros, Apophis, Bennu…) are left out, so 38,386 are stamped. The last 4,290 Apollos (`6.json`) are pending: NASA's server was returning errors.
- **Drawing** (`scene/smallBodies/nearEarthSwarm.js`):
  - Six rock shapes made with the scene's own sculptor and surface maps — rubble pile, potato, spinning top, two lobes, cratered lump, metal — each stamped up to 240 times.
  - Each rock gets its own size (measured, or from its brightness), turn, spin, and colour by type.
  - Each rides its real orbit on the scene's conic, like every other small body.
- **Shown only near you:** a rock appears from 3 px across and grows to full size at 8 px. At most the 240 largest on screen are drawn, and nothing is tested at all when the camera is beyond every rock's reach. No dots, ever.
- **Hover and click:** the 16 largest on screen carry hit targets. Each opens a card from the JPL row: name, family, size (measured, or from brightness), type, rotation, and how close its path comes to Earth's orbit. You can fly to and focus any of them; hovering one lights its family's orbits.
- **Cost:** about 0.7 ms of CPU per frame near Earth's orbit (measured in Node, 38,422 rows), 0 in the outer system. On the GPU, 6 instanced draw calls.

### Also this pass (Prompts.md)
- `docs/bodies-to-test.md` now lists **every named body: 684** — 192 bodies and 492 moons, by board column, with the moons named. Regenerate with `node scripts/list-bodies.mjs`.
- **Trojans by column:** "Trojans of Venus, Earth & Mars" sits in the inner planets column, and "Trojans of Uranus & Neptune" in the giants column. The duplicate "Neptune's Trojans" card is gone; it showed the same 42. Trojan rows are listed with their planet: Neptune's had fallen into the Plutinos column.

## What to test (part 19)
1. Open the site and wait a few seconds. Fly to Apophis or Earth and look around: a handful of small rocks near you, of different shapes, sizes and colours, slowly turning, with nothing that looks like twinkling dots.
2. Hover one: its card names it (e.g. "2007 WC5 · Aten") and its family's orbits light. Click it: you fly there and its card shows its size, type and closest approach.
3. Zoom out to the whole system: no rocks are drawn. Fly back in: they reappear.
4. Board → inner column → "Trojans of Venus, Earth & Mars"; giants column → "Trojans of Uranus & Neptune". The Plutinos column no longer lists Neptune's Trojans.
5. Smoothness near Earth's orbit should feel as before.

## Part 20 — Fly straight to any near-Earth rock; Trojan lists per planet: done

1. **Every rock listed on the board** (`explainerView.js` `searchList`, `nearEarth.js`). Each family page has a new list, **"Every Aten — fly to any of them"**, with every member from JPL, largest first, 40 at a time ("Show more"), and a search box. Click a name and you fly straight to that rock; it is held drawn while you go (`nearEarthSwarm.js` `pinRockByName`).
2. **Names in space** (`spotlightFamily`). "Show the Apollos in space — paths and the 20 largest, named" draws the family's orbits and puts names on its 20 largest rocks, wherever you are. Click a name to fly there. Escape or Done removes both.
3. **Trojan lists follow the chosen planet** (`explainerView.js`, `populations.js`). Click Earth and the list shows Earth's 2; Venus shows its 1, Mars its 17, Uranus its 2 and Neptune its 42.

## What to test (part 20)
1. Board → "The Atens" → scroll down the right side: "Every Aten — fly to any of them". Type "Khufu" and click it: you fly to Khufu, and its card opens.
2. On "The Apollos", press "Show the Apollos in space…": the orbits appear with 20 names (Zeus, Heracles, Sisyphus, Cadmus, Wilson-Harrington…). Click one and you fly there. Escape clears it.
3. Board → "Trojans of Venus, Earth & Mars": click Earth, Venus and Mars in turn; the list matches. The same for "Trojans of Uranus & Neptune".

### Part 20, follow-up fixes
- **"Show more" did nothing:** it did add rows, but it redrew the whole list, so the screen still showed the first 40 and the button jumped out of sight. Now the new rows are added below, the view scrolls to them, and the button says "Show 40 more · 80 of 3,469 shown".
- **Rocks looked detached from the yellow paths:** those paths are the family's 891 largest members, and a smaller rock is on none of them. Now any rock you hover, click, fly to, or see named shows its own orbit, bright in its family's colour, on exactly the path it rides. The family's paths dim to 35% meanwhile (`nearEarthSwarm.js` `drawOrbits`, `familyOrbits.js`).

## Part 21 — Every near-Earth asteroid in one searchable table: done

"Show more" is gone. Each family page now has **"See all 3,469 in a table"** above its list (the list itself keeps the 40 largest and its search box). The button opens a full screen over the board (`src/js/ui/nearEarthTable.js`):

- **Only the family you came from** ("Every Aten", 3,469 rows; Apollos 19,983; Amors 14,907; Atiras 38). There are no "All" or other-family buttons.
- **Search** by name or designation ("Khufu", "2024 YR4", "99942").
- **Columns:** name, size (* = from brightness, not measured), type, how close its path comes to Earth's orbit, nearest–farthest from the Sun, its year, its day. Click a heading to sort by it; click again to reverse. Rows with nothing on record stay at the bottom.
- **Click a row** to fly to that rock. "Back to the Atens" returns to the family page.
- **Cost:** only the ~25 rows on screen exist in the page; they are redrawn as you scroll. Opening the Apollos (19,983 rows) is instant.

Also fixed: closest-approach distances. The catalogue kept MOID to 4 decimal places (15,000 km steps) and wrote 0 both for "no value" and for paths within 7,500 km. It now keeps 6 places (150 km) and writes -1 for "no value" (135 rows). Under one Moon-distance the table and the rock's card give kilometres: 2014 AA, which hit the Atlantic in 2014, reads "under 1,000 km".

## What to test (part 21)
1. Board → "The Atens" → "See all 3,469 in a table". The table shows only Atens, largest first (Amun, 3.3 km).
2. Scroll fast to the bottom: no lag, and the rows keep up.
3. Type "khufu": one row. Click it: you fly to Khufu.
4. On "The Apollos" table, click "Path comes within" to sort by it: 2014 AA and others at "under 1,000 km". Click it again to reverse.
5. "Back to the Atens" returns to the family page; Escape closes the board as before.

### Part 21, follow-up: paths that go through their rocks
- **Why they looked detached:** every path was drawn as straight pieces, and a straight piece cuts inside the curve. The family paths had 72 pieces an orbit and missed the curve by up to 7 scene units; a rock is drawn 0.02–0.09 units in radius. The rock's own path had 160 pieces and missed by one to four rock radii. Close up, a path also passed nearly through the camera, and one long piece from behind the camera to beyond the rock was dropped, so the line stopped short of the rock.
- **The rock's own path** (`nearEarthSwarm.js` `drawOrbits`) is now built from the rock: one point exactly on it, the next half a radius away, the pieces growing outwards. It is rebuilt each time the rock has moved two of its radii. Measured: the path passes through the rock's centre; flown to Zeus, the line runs into and out of the rock on screen.
- **The family paths** (`familyOrbits.js`) are spaced by eccentric anomaly and split wherever a piece misses the curve by more than 0.25 units (was 6.97). 116,000 pieces for all four families, built while the scene loads. Close to a focused member (under 120–240 units) they fade out, and the rock's own path is the one you see.

## What to test (part 21, follow-up)
1. From the Apollo list or table, fly to Zeus or Khufu. The bright path goes through the rock, on both sides.
2. Press "Show the Apollos in space", then click a name: the same, and the faint family paths fade as you arrive.
3. Zoom back out: the family paths come back.

## Part 22 — Family view you can click, and craters on every near-Earth rock: done

1. **"Show the Apollos in space" now clears the way** (`main.js`, `nearEarthSwarm.js`). While a family's paths are shown:
   - every other orbit line (planets, named asteroids, comets…) is hidden and cannot be hovered, as in space mode (`setGuideSuppression("near-earth-family")`). They come back with Done or Escape.
   - the 20 named rocks win the pointer first, on their ring **or their name**. Before, they are far below a pixel at that view and the size floors turned them away, so the pointer fell through to the orbit lines behind.
   - Measured headless: hovering the ring and the name of Cuno, 2000 UV13 and 1993 BW3 picked each rock. Clicking the name "Heracles" flew to Heracles. Hovering empty space found no orbit. After Escape, all 191 orbit lines were back.
2. **Craters on every near-Earth rock** (`tools/binary-surface-lab/build-neo-maps.mjs`, same generator as the binaries' maps).
   - The six stamps that draw all ~38,000 rocks have their own crater maps (colour + normal, 1024 × 512): a rubble pile, three cratered (one two-lobed), one with Mathilde-like giant craters, and the metal one with shallower craters. Before, they used the named rocks' grain maps, which have no craters, and the sculpted craters were mostly lost at the stamps' low resolution.
   - The twenty named family rocks keep their colour maps and gain crater normal maps (512 × 256), so the Sun lights crater rims and floors.
   - About 9 MB more to download, loaded through the existing one-at-a-time texture queue.

## What to test (part 22)
1. Board → "The Apollos" → "Show the Apollos in space…". Only the Apollo paths and the 20 names remain. Hover a name: the rock's card appears; click it: you fly there.
2. Press Escape (or Done): the planets' and other orbits come back.
3. Fly to Zeus or Khufu (stamped rocks) and to Toro or Ganymed (named ones): craters show, best near the terminator.

### Part 22, follow-up: only the family answers, and closing the view closes everything
- **Only that family's rocks respond** while "Show the … in space" is on (`main.js` `nearEarthFamilyView`). The Hildas, the Trojan camps, the belt, planets and every other body are passed over by hover and click, and a click on empty space does nothing (before, it flew into the region behind the pointer). Measured: a 336-point hover sweep of the Apollo view found only Apollo rocks.
- **The visited rock loses its ring and name** while you are on it (`nearEarthSwarm.js`), so its name is shown only once, on its card.
- **Escape, Done or Hide closes all of it:** the paths, the names, the rock's card, and the visit. The camera returns to the whole Solar System, with no "back" into the view.

## Part 23 — Centaurs in their real colours, as rocks you meet: done

The owner: Centaurs are not sparkling blue, and in the normal view they were nearly invisible.

- **Real colours** (`centaurSwarm.js` `centaurLook`). Centaurs are either neutral grey or red, with almost nothing between (the colour bimodality; Tegler & Romanishin 1998, 2003; Peixinho et al. 2003, 2012; review Peixinho et al. 2020). Almost none of the 1,036 has a measured colour, so each is given one:
  - Red, with a chance that falls with orbital tilt: 55% below 10°, 35% to 25°, 15% above. This follows Tegler et al. 2016 (red Centaurs have lower inclinations), but no single body is measured. The result is 367 red and 669 grey.
  - Red at B−R 1.8, grey at 1.2, converted as `centaurCatalogue.js` converts the measured ones, with saturation pushed 1.6× as for class colours (`mainBeltCatalogue.js`). Taken literally, the red rendered olive.
  - Dark albedos: red 0.10, grey 0.055 (Bauer et al. 2013; Duffard et al. 2014).
- **Dots** (`populationClouds.js`). Each dot has its own Centaur's colour, warm grey or orange-red, not icy blue.
  - **At rest there are no dots at all** (third pass). The owner asked whether they should be visible at all, and in reality they should not: a Centaur is a dark body 10–200 km across, 5–30 AU out, and even Chiron is about magnitude 18–19 from Earth, far below what an eye can see. The near-Earth asteroids are treated the same way. Each Centaur appears only as its rock when you come near (below).
  - **"Light them up"** shows them as dots in their colours, as a way of seeing where the population is.
- **Rocks up close** (the near-Earth stamp machinery, `nearEarthSwarm.js` with a profile). Each Centaur grows in as a cratered rock in its colour as you approach, exactly where its dot was. The dot fades out as the rock appears. Rocks are sized from H at their albedo (10–200 km), and lit for their own distance from the Sun as named bodies are.
- **Hover and click** a Centaur rock: a card with its orbit, size, colour group and how it was chosen. It shows its own orbit line, and you can fly to it.
- **Names:** `CENTAUR_ELEMENTS` has no names, so cards say "Centaur 6" until the JPL list is supplied as `public/assets/data/centaurs.json`.
- **Cost:** about 1,000 rows on the near-Earth machinery's sliced refresh, a fraction of a millisecond. The dots cost what they did.

## What to test (part 23)
1. Zoom out to the whole system: no Centaur dots. Board → "The Centaurs" → "Light them up": grey and orange-red dots appear between Jupiter and Neptune; Done removes them.
2. Fly out past Saturn and drift through the region: grey and orange-red cratered rocks appear as you near them; hover one for its card.
3. Board → "The Centaurs" → "Light them up": still lights the population.
4. Near-Earth rocks behave as before.

### Part 23, follow-up: Jupiter's Trojans and the Hildas, the same rule
- **Depends on distance at rest** (`resonantSwarms.js`). A typical Jupiter Trojan is magnitude 15 or fainter even from Earth. The L4 and L5 clouds and the Hilda triangle (5,600 statistical dots) are:
  - **invisible from far away**, while Jupiter's orbit is under 500 px across;
  - **faint** (opacity 0.16) **close in**, near the Sun or among the inner planets, once Jupiter's orbit is 1,400 px or more; eased between;
  - **bright** while you hover their region (with its card) or after lighting them from the board.
  - Before, they were drawn at 0.42 at every distance. Measured: off from the wide view; 0.16 at Mars.
- **"Light them up in the scene"** is a new button on the board's "Jupiter's Trojans & Hildas" page (`jupiterCompanyView.js`, `main.js`). It lights all three, with a note; Done or Escape clears them.
- The named Trojans and Hildas (Hektor, Patroclus, Eurybates, Hilda…) are bodies and are unchanged. The main asteroid belt (`asteroidBelt.js`) is frozen and unchanged.

## What to test (part 23, follow-up)
1. Zoom out to the inner system: no glowing Trojan or Hilda clouds around Jupiter's orbit.
2. Hover about 60° ahead of or behind Jupiter: that cloud appears with its card. Move away and it goes.
3. Board → "Jupiter's Trojans & Hildas" → "Light them up in the scene": all three appear. Escape removes them.

### Part 23, follow-up: the main belt, a little dimmer from afar
- `asteroidBelt.js` stays frozen and untouched. Its pebble population draws every pebble at least 1.1 px wide at opacity 0.84, so from far out it read as a solid bright ring. A new `beltDistanceDimming.js` scales that one opacity from outside, by how large the belt is on screen:
  - full (0.84) when the belt is 1,200 px across or more, at or near it;
  - 35% when it is 300 px or less, with the whole system in view;
  - eased between.
- Measured: 0.29 from the wide view, 0.84 at Ceres. The belt's rocks, boulders and hover are unchanged.

## What to test (belt and Trojans)
1. Zoom far out: the belt is a dimmer ring, and the Trojans and Hildas are not drawn.
2. Fly in towards the Sun or Mars: the belt comes back to full, and the Trojan clouds and Hilda triangle appear faintly.
3. Hover 60° ahead of or behind Jupiter: that cloud brightens with its card.

### Part 23, follow-up: board actions leave the body you were on
- **The bug:** while viewing a body (e.g. Echeclus), pressing a board button that is not a body — "Light them up" for the Centaurs, or the new one for Jupiter's Trojans & Hildas — lit the layer but left the camera on that body.
- **Now** (`main.js`, show-in-scene) every such button frames what it shows, from above the Sun, leaving the body:
  - Centaurs: 32 AU of the drawn system.
  - Trojans & Hildas: Jupiter's orbit with room for the clouds.
  - The Kirkwood gaps and the near-Earth families already did this.
- Measured: focused on Echeclus, then "Light them up in the scene" on the Jupiter page: focus moved to the Sun and the camera pulled back, with all three clouds lit.
- **Trojans and Hildas at rest from afar:** a faint 0.07 (was off), rising to 0.16 close in, as the owner asked ("slightly visible").

## Part 24 — Real spacecraft maps for Earth, the Moon, Jupiter and Mercury; Venus and Uranus as an eye sees them: done

The owner: Earth, the Moon and Jupiter "do not seem realistic as per space", then the same for Mercury, Venus and Uranus. The maps were downloaded by the owner into `images/` (this build cannot reach NASA's servers) and prepared by `tools/planet-textures/prepare-planet-maps.py`. All are public domain.

- **Earth.**
  - **Map:** NASA Blue Marble Next Generation, July 2004 (4096 × 2048). Plain deep-blue oceans; the old map had bathymetry shading that read as pale turquoise seas.
  - **Ocean sheen:** a roughness map made from it (water 0.8, land 0.92). Earth is now on MeshPhysicalMaterial with half the default specular (water reflects ~2%), which removes a grey glare that covered the sunlit ocean.
  - **Clouds:** much thicker. About two-thirds of Earth is cloud-covered at any time; the deck's opacity, threshold and curve were all changed (`earthVisuals.js`). Night-side clouds are now dark (they were drawn 70% grey).
  - **Air:** a faint deep-blue veil over the whole day side, as in every whole-Earth photograph.
- **Moon.**
  - **Map:** NASA CGI Moon Kit 2025 LROC colour map, 2k (was the 2019 1k).
  - **Brightness:** colour 0.22 linear brings the map's mean (0.51) to the Moon's albedo of 0.11. MeshPhysicalMaterial at a quarter of the default specular: the fixed 4% specular had been adding a flat grey that kept the Moon pale whatever its colour (measured: colour 0.02 still rendered mid-grey).
  - **Relief:** cut from 5% to 1.6% of the radius, so the limb is round and no longer lumpy.
- **Jupiter.**
  - **Map:** Cassini's global map (PIA07782, December 2000).
  - **Shader:** shown as it is (texture strength 1, procedural detail 0). The procedural layer had drawn wavy contour bands, a violet pole and no Great Red Spot.
  - **Ultraviolet view:** its Great Red Spot marker moved to the new map (latitude −21°, longitude 132°).
- **Mercury.**
  - **Map:** MESSENGER's global mosaic (PIA16298, 5 km/pixel), shown as it is, with a faint warm tint and the polar no-data rows filled.
  - **Removed:** the shader's invented features — a "Caloris" tint in the wrong place, six blue-white "hollow" blobs, noise and random flecks.
- **Venus.** No global visible-light photograph exists; in visible light it is a bright, nearly featureless pale yellowish-white (Bond albedo 0.76). The three cloud layers are now pale cream (were tan to brown), the ultraviolet Y-wave is barely visible (0.04, was 0.11), and the limb glow is warm white (was orange).
- **Uranus** (follow-up). It already had Voyager 2's pale, almost featureless cyan, but its methane-haze shell was unlit, so the night hemisphere showed as a flat grey-green disc and the day side looked washed out.
  - **Haze** (`uranusVisuals.js`): now follows the Sun.
  - **Night side** (`planetFactory.js`): dark (0.03, was 0.075), and the haze rim only where it is sunlit.
  - **Limb:** darkened by about a quarter, as in Voyager's images.
  - **North polar cap:** the bright cap Hubble (2022) and JWST (2023) show, made distinct.

### Part 24, follow-up: Mercury and Jupiter showed no surface on the owner's machine
- They rendered here, so the cause was found by elimination. The two maps that failed were the only ones not a power of two (3601 × 1801 and 3060 × 1530) and the largest. A bundled map that misses the loader's 6.5 s limit is silently replaced by the procedural fallback.
  - **Both maps:** now powers of two. Jupiter is 4096 × 2048 (0.76 MB); Mercury is 2048 × 1024 (0.83 MB, file `mercury-messenger-2k.jpg`).
  - **Loader** (`loadTextures.js`): bundled maps now get 15 s, since the loader waits for them anyway.
  - `public/textures/mercury-messenger-3k.jpg` on the device is unused and can be deleted.
- Verified headless from four sides each: Mercury shows MESSENGER's cratered terrain on its sunlit side, Jupiter Cassini's bands and the Great Red Spot, and Uranus a cyan day side with a dark night side.
- `main.js` gains a debug-only `window.__setCameraYaw` (with `?bodyDebug=1`), used for these checks.

## What to test (part 24)
1. **Earth:** deep blue oceans with a soft sheen toward the Sun, heavy swirling white cloud, a thin blue limb, a dark night side.
2. **Moon:** grey, not white; dark maria on the near side; a round edge.
3. **Jupiter:** the real Cassini bands, festoons and the Great Red Spot.
4. **Mercury** (turn to the sunlit side): grey cratered MESSENGER terrain with no blue blobs.
5. **Venus:** a pale cream ball.
6. Each planet's ultraviolet view still opens and looks as before.

### Part 24, follow-up: a thin line where the map wraps
The owner saw "a very very thin line" on the planets, as if two images met end to end.
- **Cause 1, the shaders (the visible line).** Earth's clouds and the Mercury, Jupiter, Venus-cloud and Saturn shaders wrapped the map coordinate themselves with `fract()`. At the seam that coordinate jumps from 1 back to 0 inside a single pixel. The GPU reads the jump as the whole map squeezed into that pixel, so it samples that column from the smallest mip level, which draws a one-pixel line along the date line. The maps already repeat across the seam, so `fract()` is simply removed (`earthVisuals.js`, `planetFactory.js` twice, `jupiter.js`, `saturn.js`).
  - **Measured on a test sphere:** the step across the seam was 42 grey levels on Earth with `fract()` and 0.7 without; on Jupiter, 21 and 0.6.
- **Cause 2, the maps.** Several maps' left and right edges did not match. On BMNG Earth, the edge columns differed by 4.3 levels against 0.6 between neighbouring columns; Jupiter 2.0 against 0.6; the cloud map 6.0 against 4.0.
  - **New helper:** `prepare-planet-maps.py` gains `wrap_resize`, which pads each map with columns from its opposite side before resampling, then spreads any remaining step over 24 columns.
  - **Jupiter:** Cassini's duplicate 3,601st column is dropped first.
  - **Earth's cloud map:** feathered in place.
  - **Edge mismatch now:** Earth 0.6, Jupiter 1.5 (JPEG noise), Moon 1.3, Mercury 3.2 (its neighbouring columns differ by 15), clouds 0.9.

### Part 24, follow-up: Jupiter's sunlight
The owner asked for a check of the sunlight on Jupiter. The light model drawn on Jupiter was wrong in three ways:
- **Night side:** it kept 11% of daylight, so the bands showed on the night side.
- **Day side:** it added a constant 0.13 everywhere, so the disc barely darkened toward the limb.
- **Glows:** its terminator was blurred across half a hemisphere (−0.15 to 0.35), and both the bluish limb scatter and the haze shell glowed around the dark limb too.

Spacecraft views (Cassini 2000, Juno) show a black night side and a strongly limb-darkened disc. `jupiter.js` now does the following:
- **Light:** Lambert, wrapped by 0.06 for the haze.
- **Brightness:** the sub-solar point is as bright as before (1.03); the night side is 0.012.
- **Glows:** the limb scatter and the haze shell follow the Sun.
- **Distance:** the scene exposes each planet for its own daylight, as a camera would. Jupiter's real sunlight, 1/27 of Earth's (5.2 AU, inverse square), is therefore not applied to its brightness, as for every other planet.
- **Verified headless from four sides:** dark night side, crisp terminator, limb darkening; the day side is unchanged in brightness.

### Part 24, follow-up: Venus beneath its clouds (radar)
The owner sent NASA's orange Magellan globe of Venus and chose to keep the true cream clouds by default and add a view beneath them.
- **What the image is:** a radar map, not a photograph. Magellan (1990–1994) mapped about 98% of the surface by radar. The orange was added by NASA after the Venera 13 and 14 landers' photos.
- **Venus's card:** gains a "Beneath the clouds · radar" section (orange) that says this, with a **See beneath the clouds** button.
- **The view** (`scene/venusRadarView.js`):
  - **Hidden:** the cloud deck and the atmosphere shell.
  - **Shown:** the radar map already in the scene (`venus-surface-2k.jpg`), lit evenly as a radar image is: emissive 0.72 on a 0x262626 base, chosen by eye against the owner's image.
  - **A note says what is shown, and the clouds return when any of these happens:**
    - its **Clouds back** button;
    - Escape;
    - travelling to another body;
    - opening the ultraviolet view.
- **Verified headless:**
  - The card section appears for Venus only.
  - The view shows the deep-orange radar globe from both sides.
  - Clouds back restores the cream cloud ball.
  - No console errors.

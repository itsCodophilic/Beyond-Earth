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

## Part 25 — Space events as a carousel; the four "coming soon" events built; last and next dates
The owner reviewed three live prototypes (`prototypes/space-events-concepts.html`) and chose **C, the Cosmic carousel**. They also asked to build the four "coming soon" events and to show when each event last happened and when it can next happen.

### The panel (`ui/spaceEventsDashboard.js`, `ui/eventVignettes.js`, `css/space-events.css`)
- **Layout:**
  - A centred sheet with one event large: an animated 2D preview of what it is, its place, kind and family tags, and the summary.
  - **Last happened / Next** dates (below).
  - A fold-out "Why it happens · how often", which includes the accuracy note.
  - A **Go watch it** button.
  - Underneath, a curved 3D ring of all 24 cards, each with its own small animation.
- **Order:** the ring runs as a journey: formation, the Sun, then outwards world by world, then the visitors from other stars, then deep sky.
- **Controls:**
  - It turns by itself every 7 s until touched.
  - Arrows, the ‹ › buttons, a swipe, or a click on a card turn it. Clicking the front card plays it.
  - Search narrows the ring.
- **A moon not built yet** (Io, Enceladus, Triton, the Moon) offers "Fly to Saturn first" instead of failing.
- **Cost:** drawing runs only while the panel is open, for the preview and the cards within four places of the front.

### The four new events (`scene/events/systemProcesses.js`)
| Event | Where | Runs | What you see |
|---|---|---|---|
| How the Solar System formed | Sun, framed to ~45 AU | 58 s | The cloud collapses into a disc; the snow line; Jupiter's core opens a gap; the gas clears; rocky embryos merge (with the Moon-forming flash); the giants migrate and scatter the icy disc into the Kuiper Belt and Trojans; today's system fades in |
| The solar wind | Sun, framed to the heliopause | 40 s | The first wind leaves as a front: slow, warm-coloured from the equator, fast, whiter-blue from the poles. Parker spirals to 10 AU. The wind slows, reddens and bends tailward at the drawn termination shock and heliopause, with Voyager crossing dates |
| A magnetic shield in a storm | Earth, side-on | 36 s | True-scale Shue magnetopause (10 Re) and bow shock, field lines, Van Allen belts and aurora ovals, with solar wind flowing round them. A CME pushes the stand-off to 6.6 Re; the aurorae spread to 58° and brighten, then everything relaxes |
| Why there are seasons | Sun, framed to Earth's orbit | 36 s | A diagram Earth with its axis tipped 23.44°, always pointing the same way, goes round one year. It slows at each solstice and equinox, shows the tropics and polar circles, and reads out the date and the Sun's overhead latitude. It marks perihelion (January, northern winter) |

- **Stage captions:** each event tells its steps on the event card (new `setStage`, which takes the summary's place while it runs).
- **The veil** (new `setVeil` in `main.js`):
  - **Formation and seasons:** every planet, belt, moon system and orbit line is hidden until the end, so no planet exists before it forms and there is no second Earth. Each object's visibility is put back exactly when the veil lifts.
  - **Magnetosphere:** only the Moon is hidden, because it is drawn at 3.15 Re, inside a true-scale magnetopause.
- **Camera:** the shot zoom limit went from 30 to 60, so the system-wide events fit.
- **Fixes on the way:**
  - Event labels now ignore the scene's fog; distant labels were grey ghosts.
  - A label whose text grows now gets a fresh texture (the WebGL texture-size error).

### Last happened / Next (round 43, the owner)
Every event shows when it last happened and when it can next be expected, as of October 2026. Examples:
- **Eclipse:** last on 12 Aug 2026; next an annular on 6 Feb 2027 and a total on 2 Aug 2027.
- **Geomagnetic storm:** 11–12 Nov 2025 (Kp 9−); before that, May 2024 (G5).
- **Jupiter flash:** 28 Aug 2023.
- **Saturn:** no confirmed impact flash yet; the 5 July 2025 candidate was not confirmed.
- **Uranus:** its solstice is in April 2030.

Sources are listed above the `TIMELINE` table in `spaceEventsDashboard.js`. These dates go out of date and need revisiting.

### Verified headless
- **Panel:** desktop and phone widths; filter; the travel button for a moon not built yet.
- **Events:** each new event at several points:
  - formation at six points;
  - the solar wind and the magnetosphere at three each (on a later re-check, the magnetosphere at two);
  - the seasons at two.
- **Veil:** it hid the 37 non-Sun world children and restored them afterwards.
- **Console:** no errors after the fixes.

## Part 26 — Prompts.md improvements (round 44)
1. **Seasons: Earth no longer as big as the Sun.**
   - **Size:** the diagram Earth is 3.2% of the orbit radius (was 8.5%). It is still enlarged, and a label says so (true size is about 1/109 of the Sun across).
   - **Orbit:** drawn as the real ellipse (e = 0.0167, Sun at a focus, perihelion at 102.94°), which looks like a circle. A label gives the 147.1–152.1 million km range.
   - **View:** seen from as high as the camera allows (pitch 1.1), so the circle is less foreshortened.
   - **Labels:** the equinox labels now have two lines like the solstices, so all four read at the same size.
   - **Note for the owner:** the elongated look was the viewing angle. Northern winter comes when Earth is *closest* to the Sun (early January).
2. **2I/Borisov and 3I/ATLAS labels no longer pile up.** New `declutterLabels` (in `interstellarPassages.js`):
   - Each frame, every label is tried at its anchor, then a label-height down, then up, and so on, until its on-screen box is clear. It eases to the chosen place.
   - Milestones keep their places; the moving date and farewell labels give way.
   - Also used for the solar-wind labels.
3. **The carousel loops.**
   - The ring's angle comes from an unwrapped turn counter that always moves the short way round, so 24 → 1 is one step forward.
   - Checked: 1 → 24 is +15°, and 24 → 1 → 2 is 0° then −15°.
4. **The Space events panel resets like All Bodies.**
   - **Opening it:** clears the layer notes and the Back history.
   - **Closing it without choosing:** zooms all the way out to the Solar System.
   - **Choosing an event or "Fly to … first":** travels from where the camera is.
5. **The solar wind, rebuilt as a streaming gas.**
   - **Drawing:** soft overlapping puffs for the density and short moving streaks for the flow, all moved on the GPU. No drawn field lines.
   - **The spiral:** it forms by itself. Each parcel flies radially from a source that turns with the Sun (25.38 days), the garden-sprinkler effect (Parker 1958).
   - **Streams:**
     - slow wind (400 km/s) from four streamer-belt streams near the solar equator;
     - fast wind (750 km/s) from the polar coronal holes.
   - **Speed:** it accelerates near the Sun (r = v(t − τ(1 − e^(−t/τ))), τ = 0.4 d), then coasts, thinning as it spreads.
   - **Boundaries:** at the drawn termination shock it slows to a third, heats (redder) and bends tailward. It fades at the heliopause.
   - **Clock:** days = 0.594 (e^(7.2p) − 1), so the first quarter of the event is the first ~3 days and the end is ~800 days.
   - **Camera:** the event moves it (new `api.setZoom`, honoured only while an event runs on the focused body): close on the Sun (3.6×), out through the planets (15×), then to the heliopause (54×).
   - **Captions:** they say plainly that the wind does not slow on the way out; it coasts and thins until the termination shock.

## Part 27 — Seasons ellipse; the Galactocentric View (round 45, Prompts.md)
### Seasons: the orbit drawn elongated
- **What changed:** the owner asked for an orbit with one side close and one side far. Drawn true (e = 0.0167) the shape cannot be seen, so the orbit is now drawn **exaggerated about 27×** (e = 0.45). That puts the Sun well off-centre, with the near side close and the far side far, the way textbooks draw it.
- **Honesty:**
  - The true orbit stays as a faint ring, and the label says the shape is exaggerated.
  - A dashed long axis runs through the Sun.
  - The closest point (~3 January, northern winter) and the farthest (~4 July, northern summer) are labelled from the start.
  - Labels are decluttered.

### The Galactocentric View (major feature; the owner chose the name, all three scales and a top-bar switch)
- **Where:** a new **Galactocentric View** switch in the top bar (`index.html`, `#galacto-toggle`).
- **Module:** `scene/galactocentricView.js`, styled in `css/galactocentric.css`, wired up in `main.js`.
- **The panel:** along the bottom, with three steps as tabs. Escape, ×, or the switch returns to the Solar System.
  1. **The Solar System in motion** (in the scene).
     - **Camera:** it goes to the Sun and stands side-on to its direction of travel (towards Cygnus: ecliptic longitude 347.3°, latitude +59.6°, so the planets' plane is tipped ~60°).
     - **Motion:** the Solar System runs 10× faster. Every planet leaves a trail that drifts back as the Sun flies on, so the trails become corkscrews.
     - **Speed:** shown about 20× slower than real (the label says so). At the real 7.7:1 ratio, a turn never fits on screen.
  2. **Round the Milky Way** (its own scene).
     - **The galaxy:** a painted four-armed disc with 22,000 stars that turn on a flat rotation curve, and the Galactic Centre (Sgr A*).
     - **The Sun:** it goes round the 8.2 kpc orbit, one galactic year (~230 Myr) every 30 s, bobbing 80 pc every 66 Myr (drawn 10× taller). It shows a running clock in millions of years and galactic years. Drag to turn, wheel to zoom.
  3. **The Milky Way moves too** (its own scene).
     - **Galaxies:** the Milky Way with the Magellanic Clouds, and Andromeda (77° inclined) with M33.
     - **Approach:** they close at 110 km/s (time runs a billion years per 10 s, looping after 4 billion), with a running clock and distance. The panel says there is an even chance of a merger within 10 billion years (Sawala et al. 2025).
     - **Group motion:** an arrow shows the Local Group's ~620 km/s against the cosmic microwave background, towards Hydra–Centaurus. Galaxies are drawn 4× larger than their separation.
- **Sources:** listed in the module header — NASA (230 km/s), GRAVITY 2019 (8.178 kpc), Frisch 1998 (66 Myr, 80 pc), Bennett & Bovy 2019 (20 pc), Sawala et al. 2025 (Nature Astronomy), the CMB dipole.
- **Cost:**
  - **Off:** nothing.
  - **Step 1:** nine trail lines.
  - **Steps 2 and 3:** a small scene drawn *instead of* the Solar System.

## Part 28 — Round 46 (Prompts.md)
1. **The Galactocentric View is in the tour.**
   - **The step:** a new step, "See it all from the Milky Way", after Space Mode. It unlocks only the Galactocentric switch.
   - **Leaving the step:** the view is switched off when the tour moves on.
   - **Step count:** the events step now says twenty-four.
2. **Space Dictionary in the tour:** while the board is open, the step brings back the spotlight. Its ring sits on the Space Dictionary button and its outer shadow darkens everything else, as the veil does on other steps. It is re-measured once the board has opened.
3. **Nothing in space can be clicked while the view is on.**
   - **Pointer input:** a full-screen layer takes every pointer in all three steps. In step 1 it hands drags and the wheel to the Solar System camera, so the scene can still be turned and zoomed.
   - **Top bar:** every other control is disabled, and so is the wordmark.
4. **A smaller panel:**
   - **Size:** up to 520 px wide, at most 46% of the screen height, and translucent.
   - **Content:** short copy, with the detail folded under "More".
   - **Short screens:** keep only the tabs, the title and the counter.
5. **Step 1 shows real motion.**
   - **Streaming stars:** streaks flow past along the direction of travel in two layers, the far one slower for depth.
   - **Live counter:** the distance travelled since the view was switched on, at the real 230 km/s.
   - **Corkscrews:** the trails remain.
6. **Step 3, simpler.**
   - **Removed:** the arrow and the Local Group labels.
   - **Now:** the Milky Way ("you are here") and Andromeda, a dotted line between them with the distance written on it, and a timeline in the panel from now to the first close pass (+4.5 billion years).
   - **Approach:** 110 km/s, speeding up (van der Marel et al. 2012). The panel adds the 2025 even-chance caveat.
   - **Group motion:** shown only by distant galaxies drifting past behind, and said in one line under "More".
7. **The intro's title card.**
   - **The log:** now headed "System initialisation · Heliocentric frame", without the name.
   - **The title:** after the log, BEYOND EARTH rises from the bottom of the screen to its middle like a film title, letter by letter. The O fills with light and the other letters fade.
   - **The fall:** the light gathers to a point and drops slowly off the bottom. The gate's point of light then descends from the top as before, so it reads as one fall across a cut.
   - **How it runs:** CSS only, cued by classes, so there is no per-frame work. Reduced motion shortens it.

## Part 29 — Round 47 (Prompts.md)
1. **The third Galactocentric step (Andromeda / Local Group) is removed.** Two steps remain, and the tour text was updated to match.
2. **Step 1 reworked: "The Sun is moving".**
   - **Copy:** simpler wording.
   - **Streaks removed:** the falling streaks (which read as rain) are gone.
   - **The Sun's tail:** a chain of glows flows back from the Sun along its path, scrolling continuously, so the Sun is the thing seen moving.
   - **The sky:** the scene's own sky is set aside during the step. A star sphere centred on the camera turns about the camera's right-hand axis (0.045 rad/s), so the whole background slides downwards in an endless loop while the Sun heads upwards. The sky comes back on leaving the step.
   - **Kept:** the corkscrew trails and the live distance counter.
3. **Intro title card reworked.**
   - **Timing:** the title now starts after six log lines, so it rises while the universe is still being built.
   - **The rise:** BEYOND EARTH rises slowly (4.8 s) from the bottom, all letters together. It is solid (no blur), huge (up to 14rem) and thin: Jost 200 from Google Fonts, linked in `index.html`, falling back to the system sans.
   - **The O:** not filled. It has a single dot at its centre.
   - **The zoom:** after a second, the view zooms into the O about that dot until the dot is the gate's 6 px point of light. The letters and the O's ring fade as they go past the edges.
   - **The fall:** that point falls slowly off the bottom, and the gate's point descends from the top as before.
   - **How it runs:** CSS transitions plus one inline transform, so there is no per-frame work.

## Part 30 — Round 48: intro pacing, the O's dot, the camera drift
- **The log runs in full again.** The title waits for every line (25+) instead of starting after six.
- **Timing variables:** the timings live at the top of `src/js/ui/introSequence.js`, in seconds (larger is slower). Defaults:

  | Variable | Default | What it times |
  |---|---|---|
  | `riseSeconds` | 10 | BEYOND EARTH rising |
  | `holdSeconds` | 1.5 | the word at rest |
  | `approachSeconds` | 5 | the camera drifting towards the O |
  | `diveSeconds` | 5 | diving into the dot |
  | `fallSeconds` | 3 | the particle falling |

- **The dot is at the O's true centre.** It is measured from the glyph's own ink box (canvas `measureText` from a zero-size baseline probe), in the font actually in use. Before, it used the letter's line box and sat high. Checked: the dot lands at the ink centre to under a pixel.
- **The camera move is two beats.**
  1. **Drift:** the whole word slides so the O comes to the middle of the screen, while the view closes in (2.2×), with an ease-in-out.
  2. **Dive:** an accelerating zoom about the dot until it is the gate's 6 px particle. The other letters fade first, then the O's ring.
- **Then:** the particle falls, and the gate's point of light descends from the top.

## Part 31 — Round 49: diving through the O
- **The O no longer just disappears.** During the dive, its ring keeps growing, slowly at first and then faster, so the view passes into the O on the way to the particle.
- **The fade comes last.** The ring fades only in the last third of the dive, as it sweeps past the edges of the screen, and is gone as we arrive at the particle. The other letters still fade early.
- **The particle is its own element from the dive on.** It takes over the dot at the same spot, so the word can zoom far past the screen while the particle grows only to the gate's 6 px. Its halo comes up as we arrive, and then it falls as before.
- **New variable:** `TITLE_RING_GROWTH`, at the top of `src/js/ui/introSequence.js`, default 8. It sets how much the ring grows during the dive, on top of the drift's 2.2×; 8 brings the ring to about twice the screen width as it fades (a design choice). A bigger value makes the ring rush past sooner; a smaller one keeps it in view longer. The dive's length is still `diveSeconds`.
- **Checked** in the fast harness: the ring's width over the dive went 303 → 408 → 722 → 1200 → 1778 px, its opacity stayed 1 until about 60% of the way through, and the particle held at 6 px.

## Part 32 — Round 50: a smooth system-initialisation log
- **Why it stuttered:** the universe is built on the main thread, and a few steps are long solid blocks: the worlds, the Moon and satellites, the shader compile, and the first frames. Each log line used to be added by a timer, and no timer can fire during a block. So the log stopped dead three or four times, then caught up. Each new line also pushed the whole log up a row in one jump, and the lines' blur and colour fades were main-thread work as well.
- **Lines are booked onto a steady beat.** Every real milestone goes into the page as soon as the browser can take it, with its arrival booked for its slot, 0.4 s apart (`LINE_SPACING_MS`). A line is never shown before its milestone happens.
  - Three things are delayed animations: the line's fall-in, the log's glide upward, and the previous line dimming as the next arrives.
  - They use only transform and opacity, so the compositor plays them on its own thread. Lines already booked keep arriving on the beat while the main thread is busy.
  - Milestones come faster than the beat, so there are always lines in hand when a long block starts.
- **The log is a fixed window.** Lines fill from the top, below the faded edge. Once the window is full, the track glides up, so old lines drift out through the fade instead of jumping.
- **main.js:** a paint-yield (`yieldPastPaint`) runs before each world is built and before the shader compile. Each booked line reaches the screen before the next long block. This costs about one frame per world, which the log's pacing hides.
- **Checked** in headless Chromium: all 35 lines were booked exactly 0.4 s apart, in order, straight through the 2.6 s block after Varuna (headless timing) and the compile. The log glides as it fills, the title card follows, and there were no errors. Compositor smoothness itself can't be filmed headless.

## Part 33 — Round 54: sound, starting with the log's tick
- **New: `src/js/audio/soundscape.js`.** It runs one Web Audio graph for the whole visit, with every sound going through a master gain.
  - Sounds are booked on the audio clock rather than started by timers, so they land on time even while the main thread is busy building.
  - `SOUND_CUES` lists the seven cues from `docs/music-prompts.md`. A cue with no file yet is `null` and stays silent, so each sound goes live as soon as its file name is added.
  - Each cue records measured `start`/`accent` points and a `gain`.
  - The on/off choice is remembered between visits (localStorage, guarded).
- **A "Begin" screen opens the visit.** Browsers play no sound before a click, and the log ticks before any other click.
  - The screen offers **Begin**, with a note "Sound on · best with headphones", and **Begin without sound**.
  - The universe keeps building behind it. The log starts on the click, its lines booked from that moment and never before their milestone.
  - The log waits until the tick is decoded, so the first line has its tick.
- **The tick (`public/audio/tick.mp3`, from Suno).** It is 0.48 s long. Measured with ffmpeg at 5 ms resolution: two faint pre-clicks, the main hit at 0.09 s (−3 dBFS), and a tail below −40 dBFS by about 0.34 s.
  - One tick is booked for every log line. Its main hit lands 120 ms after the line starts falling in (`TICK_ON_LINE_MS`), as the line becomes visible.
  - The last line, "Universe stable", plays the same tick a fifth higher until a real `tickFinal` file exists.
- **The log is on the beat: 500 ms a line (was 400).** That is one line per beat at 120 BPM, the journey's tempo, and the tick rings out fully between lines. `LINE_SPACING_MS` sets the pace. The 35 lines now take about 17.5 s.
- **The other cues are wired to their moments and are silent until their files exist:**
  - title rise: when the word starts rising;
  - focus: when the drift towards the O starts;
  - fall: when the particle falls;
  - ripple loop: when the particle settles, until the click;
  - wind-up: on the click;
  - boom: exactly 5.3 s after the click, on the detonation;
  - journey: on the opening's first frame, fading out when the journey ends.
- **Sound on/off controls.** During the intro there is a small "Sound on/off" pill at the bottom right. In the app there is a **Sound** switch in the control row: three bars that sway while sound is on and lie flat when it is off, glyph-only on narrow screens.
- **Fixed on the way:** `intro.css` defined `@keyframes intro-spark` twice, and the spiral's version silently replaced the blink, so the log's live marker never blinked. The blink is now `intro-blink`.
- **Checked** in headless Chromium: the Begin screen renders. After the click, all 35 ticks were booked exactly one per line, 500 ms apart, each starting 11–28 ms after its line, which matches the intended 30 ms lead-in within measurement jitter. The last tick is pitched a fifth up, the controls read "Sound on", and there were no page errors.

## Part 34 — Round 55: the title sound and the O's tone
- **Music 2, `public/audio/riser-2.mp3`** (Suno, 11.44 s). Played forwards, it is a short swell into a braam hit at 1.9 s with a 9 s fading tail: loud at the start, the opposite of the brief ("low at first, loud when BEYOND EARTH is at the centre").
  - **It is played backwards** (`reverse: true`). The tail becomes a 9.5 s crescendo from −43 dBFS up to the hit, now at 9.545 s (measured on the reversed samples), followed by the original swell decaying over about 1.9 s.
  - It is booked so the peak lands the moment the word comes to rest, which is the end of `riseSeconds`. If the rise is set shorter than the build-up, the sound starts part-way in, so the peak still lands on time.
  - To hear it forwards, set `reverse: false` and `accent: 1.9` in `SOUND_CUES`.
- **The rise is now even.** The easing changed from `cubic-bezier(0.2, 0.62, 0.25, 1)` (90% of the way by 5 s) to `cubic-bezier(0.35, 0.1, 0.35, 1)`: 36% at 3 s, 72% at 5 s, 92% at 7 s and 99% at 9 s. The word visibly travels the whole time and reaches the centre on the peak.
- **Music 3, `public/audio/O-1.1-Slow-0.5x.mp3`** (the 0.5× take, 12.68 s). It was chosen over the 6.4 s normal take, whose whole arc is too short for the 10 s move. Measured in 0.25 s windows:
  - a click at 0 s, skipped (`start: 0.25`);
  - a slow rise (−40 → −21 dB RMS) under the 5 s drift;
  - a loud, bright plateau under the 5 s dive;
  - its fall exactly where we reach the particle. There it is ended on the audio clock with a 250 ms fade.
  - It plays at gain 0.45 because the plateau peaks near 0 dBFS and it is meant to be a soft tone.
- **The player gained:** reversed playback (cached per file), `alignLate` (start part-way in so an accent still lands on time) and `until`/`fadeOutMs` (an end booked on the audio clock).
- **Checked** in a harness with the real timings:
  - The rise started at 4614 ms, and the title sound was booked at 5069 ms, so its peak lands at 14 614 ms: exactly the end of the 10 s rise.
  - The focus tone started with the drift at 16 063 ms (offset 0.25 s) and was stopped at 26 082 ms, 19 ms after the dive's end.
  - No errors.

## Part 35 — Round 56: the fall
- **Music 4, `public/audio/Falling-3.mp3`** (Suno, 10.01 s), under the 9.8 s fall: the particle drops for 3.0 s, the screen is dark for 0.6 s, and the point of light descends from the top for 6.2 s.
- **Measured** in 0.25 s windows:
  - a click at 0 s, skipped (`start: 0.25`);
  - a swell to about −15 dB RMS by 1.75 s, held to 5.5 s;
  - a long decay: −30 dB at 8 s, −45 dB at 9 s, silent by 9.75 s;
  - its pitch steps down from about 588 Hz to about 220 Hz around 6 s.
- **How it fits:** started 0.25 s in when the particle starts to fall, it fades out just as the point of light settles at the centre (9.8 s), so it plays whole, with no cut. Gain 0.6: it peaks at −6.2 dBFS and is meant to be soft.

## Part 36 — Round 57: the waiting loop, unbroken from the fall
- **Music 5, `public/audio/ripple-4.mp3`** (Suno, 11.20 s). Measured at 10 ms resolution:
  - 0–2.8 s: a steady low tone (about −19 dB RMS, fundamental ~74 Hz, a low D);
  - then four double beats, with first hits at 2.865, 4.95, 7.05 and 9.13 s, each followed by a second hit about 0.3 s later. That is one every ~2.09 s, half a breath of the particle (4.2 s);
  - then a fade from 9.5 s.
- **No break after the fall (the owner's ask).** The loop is booked when the particle starts to fall, not when it lands.
  - Its opening tone fades in over 2 s under the fall's fading tail.
  - Its first beat lands the moment the point of light settles: fall + 0.1 s + `BLACKOUT_MS` + `DESCENT_MS` after the fall begins. `BLACKOUT_MS` and `DESCENT_MS` are now module constants for this.
- **Then only the beats repeat, until the click.** The loop region is 2.80–7.00 s: two beats, exactly one breath (4.2 s) long, with both ends in the tone before a beat.
  - The player bakes the seam away (`loopFade`): the loop's last 0.3 s is blended, with an equal-power curve, into the 0.3 s before `loopStart`.
  - Offline, the jump at the wrap measured 0.0057, smaller than the file's own largest sample-to-sample step there (0.0084), so the seam is inaudible.
  - On the click it fades out over 0.3 s, into the wind-up.
- **Checked** in a harness: the fall started at 6842 ms, and the loop was booked at 13 777 ms with loop 2.8–7 s, so its first beat falls at 16 642 ms. The gate reported arrival at 16 681 ms (the class lands a frame or two after the animation ends). The loop stopped on the click, and there were no errors.

## Part 37 — Round 58: ticks, lines and glides on one clock
- **Reported:**
  - ticks sometimes came before their lines;
  - the newest line's highlight vanished;
  - the log stuck low and didn't glide up until the last line;
  - it felt laggy.
- **Cause:** the ticks were booked on the audio clock, which keeps time whatever the page is doing. The lines, their glide and the dimming used *delays*, which only start counting once the browser draws the frame. When a block of building held a frame up, that batch's visuals slid later by the length of the block while its ticks stayed put. Glides and dims from different batches then overlapped out of order: the log stuck, then jumped, and the highlight was dimmed before the next line arrived.
- **Fix: one absolute clock** (`introSequence.js`). Every animation is booked by `startTime` on the page clock, the same clock the ticks use:
  - each line's entrance, now a Web Animation with the same keyframes and per-keyframe easing as before;
  - the log's glide;
  - the previous line's dimming and its live marker.

  Booking takes two frames. On frame A the lines go into the page, hidden. On frame B, once A has been drawn, everything is booked at least 200 ms ahead (`BOOK_LEAD_MS`), so the bookings reach the compositor before their moment. If a block delays drawing, nothing drifts: each piece is simply where it should be at that moment.
- **Other changes:**
  - The 50 ms timer fallback for flushing is gone: it could flush just before a block. A timer is used only when the tab is hidden.
  - Lines no longer each carry `will-change`.
  - `main.js` now yields two painted frames before the shader compile, so the last lines are placed and booked before that long block.
- **Checked:**
  - **Harness with simulated building blocks** (0.9–2.5 s), Begin clicked early: all 25 ticks fell within 8 ms of their lines, the lines were exactly 500 ms apart (one 1.3 s wait where the backlog ran dry during a block), and the 13 glides went in order, 500 ms apart, ending at −310 px.
  - **The real app:** 35 lines and 35 ticks, every tick exactly on its line (0 ms), and no errors.

## Part 38 — Round 59: the wind-up (6a)
- **`public/audio/6a.mp3`** (Suno, 5.09 s). Measured with 0.1 s loudness, plus the spectrum and stereo every 0.25 s:

  | Time in the file | What it is |
  |---|---|
  | 0.0–0.3 s | a bright sparkle (~10 kHz) |
  | 0.4–0.6 s | a deep "whomp" (40–64 Hz, peaks +2 dBFS) |
  | 0.7–1.5 s | a wide low swirl (left/right correlation down to −0.5) |
  | 1.5–2.6 s | a rising, brightening whoosh: the spin-up, loudest at 2.6 s |
  | 2.7–3.7 s | darker and falling: the pull-in |
  | 4.0–4.5 s | a thin held tone at ~588 Hz: the charge |
  | 4.55 s | cut to silence, with a small blip at 5.0 s |
- **Synced by speed.** At 0.9× (`rate: 0.9`, 1.8 semitones lower) each part lands on its beat on the page, which are wind-up to 3.2 s, collapse to 4.6 s and charge to 5.3 s:
  - the spin-up peak at 2.9 s;
  - the pull-in over 3.0–4.1 s;
  - the charge tone over 4.4–5.0 s;
  - the cut at 5.06 s, leaving a breath of silence before the expansion at 5.3 s.
- **Ending:** the intro ends it on the audio clock at 5.25 s with an 80 ms fade, which drops the trailing blip.
- **Player:** gained `rate`, the playback speed per cue.

## Part 39 — Round 60: the wind-up is now 6a-1
- **`public/audio/6a-1.mp3`** (Suno, 4.81 s) replaces `6a.mp3`, which is deleted at the owner's request. Measured:

  | Time in the file | What it is |
  |---|---|
  | 0.1–0.6 s | a quiet spark, a thin glint at ~1.99 kHz |
  | 0.6–1.0 s | a fast swell (a swell, not a hit) into a deep swirl at 40–56 Hz, peak −2.2 dBFS at 1.03 s |
  | 1.0–2.0 s | the spin-up: brightening (300 Hz → 1 kHz) and widening (left/right correlation down to −0.58) |
  | 2.4–3.3 s | a second, darker surge |
  | 3.4–4.8 s | a long fall away (−16 → −36 dB) over a faint ~660 Hz glint |
- **Synced at 0.95×.** The surge ends at 3.5 s, near the end of the wind-up (3.2 s). The fall away runs 3.6–5.06 s, under the collapse and charge. The expansion follows at 5.3 s.
- **Ending:** the intro fades its last 0.2 s, ending at 5.05 s. That covers the file's abrupt last sample, which was at −30 dB.

## Part 40 — Round 61: the expansion (6b), on the white
- **`public/audio/6b.mp3`** (Suno, 13.09 s). Measured with 0.1 s loudness plus a 50 ms spectrum around the burst:
  - a long slow build, from −56 dB at 0.6 s to −11 dB by 4.8 s;
  - then the burst: the highs (above 3 kHz) climb 30 dB from 4.95 s to a bright crest at 5.70–5.75 s;
  - a deep, loud body from 5.80 s to about 6.4 s (peaks +2.9 dBFS);
  - then a long settle: −30 dB at 9 s, −45 dB at 10.3 s, silent by 12.5 s.
- **Synced to the white.** On the page the blowout starts at the end of the collapse (click + 4.6 s), peaks 0.7 s later (click + 5.3 s), and the journey takes over at the peak.
  - Only the burst is used (`start: 5.05`, where its brightening begins).
  - It is booked so its crest (`accent: 5.75`) lands on the white's peak, so its swell rises with the white. It has a 250 ms fade-in.
  - Its settle carries on under the journey's first seconds. The slow build is left out, because the wind-up already fills that time.
- **A limiter on the master output.** Several Suno files peak above 0 dBFS, and cues overlap at the hand-offs. A `DynamicsCompressor` (−3 dBFS threshold, 20:1, 3 ms attack) catches only those peaks.
- **Checked** in a harness:

  | Event | Time (ms) | From the click |
  |---|---|---|
  | click | 16 105 | — |
  | wind-up started | 16 102 | at the click |
  | waiting loop faded | — | 0.3 s |
  | 6b started (offset 5.05 s) | 20 709 | 4.60 s |
  | 6b's crest | 21 409 | — |
  | white peak (`resolve()`) | 21 410 | — |
  | wind-up ended | 21 179 | 5.07 s |

  The crest lands 1 ms from the white's peak, and there were no errors.

## Part 41 — Round 62: "Where It Stopped" (6c) and the journey paced by its song
- **6c, `public/audio/6c.mp3`** (Suno, 13.21 s). It rises from −46 dB to a plateau of about −10 dB RMS at 4–6.5 s, then settles to silence by 13 s. Its notes are D, F♯ and A, a D major chord.
  - It starts 6 s into the journey, so it swells at the end of the Big Bang, settles through "Where It Stopped" (12–20 s), and hands over to the song.
- **The song, "The Journey"** (Suno, 224.36 s). The owner wanted as much of it as possible, with slower travel if needed.
  - **The edit:** `public/audio/journey-edit.mp3`, 139.97 s, made with ffmpeg; the original is untouched. It cuts 44.489 → 128.917 s (84.43 s removed), joined with a 1 s equal-power crossfade.
  - **How the cut points were found:** by searching for the best match over ±2 s around each point, using chroma (0.81), pulse (onset correlation 0.43) and loudness (1.3 dB apart). The 0.28 s pulse carries straight through the join.
  - **What's in the edit:** the bass enters at about 12 s, the climax runs about 57–97 s, the breakdown about 98–121 s, the final swell rises at 122.0 s, and it fades from 136.2 s.
- **The pictures follow the song's clock** (`main.js`, `journeyStep`).
  - The first 20 s (Big Bang and "Where It Stopped") run at their own pace.
  - On reaching the Multiverse, the song starts. From then on, the opening is moved each frame to where the song says it should be: `JOURNEY_SONG_FROM_MS + pacedJourneyMs(song position)`. At most 0.25 s is caught up per frame.
  - The song position is taken as heard, with output latency subtracted. If there's no song (no file or no audio context), the same pacing runs off frame time instead.
- **The pace.** `JOURNEY_PACE = 67000/121000 ≈ 0.554`, easing in from full speed over 2 s. It is solved so "Our Star" begins on the final swell (122.0 s). The other acts then land at these points in the song:

  | Act | Song time | Where in the song |
  |---|---|---|
  | Our Universe | 13.6 s | just after the bass enters |
  | Laniakea | 57.0 s | the climax begins |
  | The Milky Way | 78.7 s | inside the climax |
  | The Orion Arm | 100.3 s | the breakdown |
  | Our Star | 122.0 s | the final swell |
  | Arrival | 136.5 s | as the song fades |

  Every act now takes about 1.8× as long (captions about 7.2 s a line), and the whole opening runs about 160 s instead of 97.5 s.
- **Code changes:**
  - `cosmicIntro.js` exposes `elapsedMs`;
  - the soundscape handle gained `state` and `position()`;
  - new cues `settle` (6c, gain 0.6) and `journey` (gain 0.85).
- **Checked:**
  - In the app, seeked with `?introFrom=19.3`: 6c started, then `journey-edit.mp3` started as the Multiverse began, the Multiverse rendered with its caption, and there were no errors.
  - The act-to-song mapping above was solved and checked numerically.
  - Real-time pacing can't be watched headless (the renderer runs at about 0.3 fps).

## Part 42 — Round 63: no gap between the burst and the song
- **Reported:** silence between 6b and 6c.
- **Cause:** 6b's settle is gone about 4.5 s after the white's peak. The journey starts 2–3 s after the peak, and 6c only began 6 s into it.
- **6c now carries the sound from the burst all the way to the song**, in two parts:
  - **`settleHold`** starts 0.3 s after the white's peak. Its swell rises under 6b's settle, then its plateau is held for as long as needed: a loop of 4.20–7.32 s, found by search (spectral match 0.87, both ends at −12.5 dB), with the seam blended over 0.5 s.
  - **`settleTail`** (6c from 7.32 s) is crossfaded in over 1.5 s once "Where It Stopped" has been on screen for 7 s (journey 19 s), and it carries on under the song.
- **The song's quiet opening is lifted.** The piano intro sits at about −30 dB until the bass enters at 12 s, so the song starts at 2× its gain and eases back to its own level by 12 s (`envelope: [[0, 2], [12, 1]]`, a new cue field).
- **Measured** on a mix of the real files, from the click to 48 s, in 1 s windows: the wind-up, the burst, then a steady −18 dB bed. Through the hand-off to the song it eases to −23…−27 dB, then rises as the bass enters. There is no hole anywhere. The first attempt released 2 s earlier without the lift and left a 1 s hole at −44 dB.
- **Checked** in the app (`?introFrom=19.3`, which seeks the journey to 19.3 s):
  - the hold started 0.3 s after the white's peak, with a 7.32 s looped buffer;
  - it was released on the first journey frame past 19 s, and the tail started with it;
  - the song started at the Multiverse;
  - no errors.

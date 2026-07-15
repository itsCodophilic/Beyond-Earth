# Earth-Referenced Distance Readout

The bottom travel instrument has two modes.

## Free journey

While the user scrolls, it reports the camera journey as:

> You are at [distance] from Earth

The rendered Solar System is intentionally compressed, so the scroll path uses a smooth cinematic distance scale rather than treating one Three.js unit as a fixed number of kilometres. The readout progresses through kilometres, astronomical units, and light-years.

## Celestial focus

When a planet, the Sun, the Moon, or an asteroid is clicked:

- the page's vertical journey is locked;
- the scrollbar is hidden;
- wheel, touch-scroll, Page Up/Down, Home, End, and arrow-key page scrolling cannot change the journey;
- the original scroll position and camera journey progress are saved;
- Earth displays `0 km from Earth`;
- the Moon displays NASA's average Earth–Moon distance;
- the Sun displays one astronomical unit;
- planet distances are calculated from Earth using JPL semi-major axes and the angular positions currently shown in the scene;
- asteroid distances use their physical heliocentric AU metadata;
- closing focus restores the exact view and scroll position from before the click.

The focused values are consistent with the project's current simulated orbital arrangement. They are not a live JPL Horizons ephemeris for the present date.

## Numerical references

- BIPM SI Brochure: 1 au = 149,597,870,700 m exactly.
- NASA Moon Facts: average Earth–Moon distance = 384,400 km.
- JPL Solar System Dynamics, Approximate Positions of the Planets: semi-major axes for Mercury through Neptune.

## Distance interpretation update

Focused-planet values are **neither the closest nor the farthest possible distance**. They represent the current angular arrangement inside the Beyond Earth simulation, scaled with JPL semi-major axes.

For clarity, the HUD now also displays an **Approx. orbital range** derived from JPL semi-major axes and eccentricities. It combines planetary perihelion/aphelion distances with Earth's perihelion/aphelion distance. These values are useful physical envelopes, but they are not a live date-specific JPL Horizons ephemeris.

Example for Uranus:

- Current displayed value: depends on the current scene angle.
- Approximate Earth-separation range: about 17.3–21.1 AU.
- Equivalent range: about 2.58–3.16 billion km.

The AU and light-year text in the HUD is interactive. Selecting either unit opens a short accessible explanation without changing the camera or celestial focus.


## Celestial-body verification coverage

- Earth is the zero-distance reference.
- The Moon uses the average Earth-Moon separation.
- The Sun uses one astronomical unit as the average Earth-Sun separation.
- All eight planets use JPL approximate planetary orbital elements.
- Ceres, Vesta, Pallas, Hygiea, and Psyche use named small-body orbital elements.
- Generated main-belt asteroids, collision-family members, and Jupiter Trojans use their own simulated semi-major axis and eccentricity. They are explicitly labelled as generated/simulated objects rather than real catalogued asteroids.
- Ring meshes are visual parts of their parent planet, so clicking a ring resolves to that planet's Earth-referenced distance.
- The minimum/maximum line is an approximate orbital envelope, not a live date-specific ephemeris.

## Distance readout usability update

- AU and light-year labels are rendered as visible hyperlink-style controls with an information glyph.
- The range wording now reads: **Estimated nearest–farthest distance from Earth as both bodies orbit**.
- A glowing information button on the readout explains the active measurement basis. Its text changes for camera travel, Earth, average reference distances, planets, verified small bodies, generated asteroids, and scene-scaled fallbacks.
- Opening any distance explanation freezes the scroll-driven camera journey and restores the same position when closed.
- The information panel captures wheel and touch scrolling so the underlying Earth-distance readout cannot change while an explanation remains open.
- Unit buttons are no longer recreated every animation frame when their displayed text has not changed, improving click reliability and reducing DOM work.

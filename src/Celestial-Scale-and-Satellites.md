# Celestial Scale and Satellite Architecture

## What changed

This build separates three concepts that should never share one number:

- **physical diameter** — real kilometres used in cards and Earth comparisons
- **visual radius** — compressed cinematic size used by Three.js
- **orbit radius** — compressed scene distance used by the camera journey

A literal Solar System scale would make the Sun engulf the inner scene and make
most moons and asteroids sub-pixel. The implementation therefore preserves the
correct ordering and relative hierarchy, then compresses extreme differences.

## Shared scale source

`js/config/celestialScale.js` is now the single source for:

- planet and Sun diameters
- Earth-relative diameter ratios
- Earth-relative volume ratios
- visual planet radii
- orbit expansion
- Moon visual-size conversion
- asteroid visual-size conversion
- reusable card comparison text

## Planet scale

Earth remains the visual reference at radius `1.25`.

Rocky planets use one compression curve, giant planets use another, and the Sun
uses a deliberately stronger but still non-literal radius. The Sun is now much
more dominant while Mercury's orbit remains outside the visible plasma layers.

## Asteroid scale

Named bodies such as Ceres, Vesta, Pallas, Hygiea, and Psyche use their stated
physical diameters. Procedural and instanced rocks convert their generated
kilometre diameters through the same asteroid-specific compression curve.

This preserves the hierarchy:

`Ceres > Vesta/Pallas > Hygiea > Psyche > ordinary belt rocks > pebbles`

without making kilometre-scale rocks impossible to click.

## Satellite system

`js/planets/satellites/satelliteSystem.js` provides one reusable builder for:

- Mars: Phobos, Deimos
- Jupiter: Io, Europa, Ganymede, Callisto
- Saturn: Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus
- Uranus: Miranda, Ariel, Umbriel, Titania, Oberon
- Neptune: Proteus, Triton, Nereid

The builder shares sphere geometry and procedural surface resources, combines
orbit guides per planetary system, and gives every major moon independent:

- physical diameter
- Earth-relative size comparison
- orbit radius and speed
- click target
- focus distance
- information-card metadata
- Earth-distance basis inherited from its parent planet

Earth's existing Moon builder remains intact and now uses the same scale helpers.

## Information card

A reusable `Size vs Earth` row is inserted by `main.js` without requiring a new
HTML file. It works for the Sun, planets, major moons, named asteroids, and
procedural asteroid rocks.

## Scientific references

The implementation uses NASA/JPL planetary and satellite physical parameters as
its scientific basis. Visual radii and scene orbit radii remain intentionally
compressed for interaction and storytelling.

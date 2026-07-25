# Saturnian hero-moon surface assets

This folder contains the mapped surface assets used by the dedicated Titan, Mimas, and Iapetus render paths.

## Titan

The Titan albedo, height, and roughness maps are original procedural assets made for Beyond Earth from the multi-angle Titan reference supplied with the source-update request.

- `titan-albedo.jpg`: Cassini/VIMS-style false-colour terrain reconstruction.
- `titan-height.jpg`: low-amplitude broad relief only.
- `titan-roughness.jpg`: restrained diffuse variation beneath the atmospheric layers.

Titan's golden photochemical haze, cloud veil, and night-side limb are rendered separately in Three.js.

## Mimas

- `mimas-albedo.jpg` is derived from NASA/JPL-Caltech/Space Science Institute's Cassini global map, **PIA17214**.
- `mimas-height.jpg` and `mimas-roughness.jpg` are conservative derived data maps for local bump and roughness variation.
- The global map source is a simple cylindrical projection, which makes it appropriate for a Three.js sphere texture.
- The major Herschel relief is not faked only with a photograph: the factory rebuilds the basin, raised wall, terraces, and central peak directly in geometry.

NASA source:
`https://science.nasa.gov/resource/mimas-global-map-june-2017/`

NASA Mimas overview used for the geometry proportions:
`https://science.nasa.gov/saturn/moons/mimas/`

## Iapetus

- `iapetus-albedo.jpg` is an original seamless reconstruction based on the supplied Cassini leading/trailing hemisphere reference and NASA's **PIA11690** description.
- `iapetus-height.jpg` and `iapetus-roughness.jpg` contain restrained procedural crater and terrain variation.
- The surface factory separately models the large impact basins, slightly flattened global shape, and broken equatorial mountain chain.

NASA sources:
`https://science.nasa.gov/saturn/moons/iapetus/`
`https://science.nasa.gov/resource/global-view-of-iapetus-dichotomy-2/`
`https://science.nasa.gov/resource/eyes-on-iapetus/`

## Scientific-artistic boundary

These assets are optimized for a compressed interactive solar-system scene. Mapped albedo follows spacecraft observations, while small-scale relief away from well-constrained features is a deterministic reconstruction rather than a claim of complete measured global topography.

## Enceladus

- `enceladus-albedo.jpg` is derived from NASA/JPL-Caltech/Space Science Institute's Cassini global map **PIA14937**.
- `enceladus-height.jpg` and `enceladus-roughness.jpg` are conservative derived maps for local relief and ice roughness.
- Geometry separately rebuilds the four south-polar tiger-stripe fracture zones.
- The south-polar plume is rendered as animated, light-scattering water-ice particles. It does not add a point light and therefore does not make Enceladus a self-luminous body.

NASA sources:
`https://science.nasa.gov/resource/map-of-enceladus-december-2011-unannotated/`
`https://science.nasa.gov/missions/cassini/cassini-at-enceladus-a-decade-plus-of-discovery/`

## Tethys

- `tethys-albedo.jpg` is derived from NASA's Cassini global map **PIA14931**.
- Derived height and roughness maps preserve the mapped crater and canyon detail.
- Geometry separately models the broad, relaxed Odysseus impact basin and an approximately concentric, broken Ithaca Chasma arc.

NASA sources:
`https://science.nasa.gov/resource/map-of-tethys-june-2012/`
`https://science.nasa.gov/saturn/moons/tethys/`

## Dione

- `dione-albedo.jpg` is derived from NASA's Cassini global map **PIA12814**, with restrained colouring informed by **PIA18434** and the supplied two-sided references.
- Geometry rebuilds the trailing hemisphere's wispy terrain as braided canyons and raised icy walls rather than painted lines.

NASA sources:
`https://science.nasa.gov/resource/map-of-dione-october-2010/`
`https://science.nasa.gov/resource/color-map-of-dione-2014/`
`https://science.nasa.gov/resource/wispy-terrain-on-dione-2/`

## Rhea

- `rhea-albedo.jpg` is derived from NASA's Cassini/Voyager global map **PIA14928**.
- Geometry adds a dense deterministic crater population, two large subdued basins, and restrained fractured terrain.

NASA sources:
`https://science.nasa.gov/resource/map-of-rhea-march-2012-unannotated/`
`https://science.nasa.gov/saturn/moons/rhea/`

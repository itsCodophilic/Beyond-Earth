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

## Ymir

- `irregular-reference/ymir-reference-source.png` preserves the transparent user-supplied visual reference used for this implementation.
- `ymir-albedo.jpg` is a cleaned and de-lit seamless 2:1 colour wrap derived from an interior surface region of that image. The black/transparent background and fixed photographic lighting are not wrapped onto the mesh.
- `ymir-height.jpg` and `ymir-roughness.jpg` are restrained derived maps used for local rocky relief and light response.
- The factory samples the source image's alpha contour into a latitude-by-latitude 3D loft, preserving its high left crown, upper saddle, smaller right lobe, and irregular lower outline.
- The detailed body is explicitly a reference-directed artistic reconstruction; NASA's available Ymir observations do not provide a resolved global surface map at this level.

NASA physical/orbital overview:
`https://science.nasa.gov/saturn/moons/ymir/`

NASA Cassini raw-image resource:
`https://science.nasa.gov/resource/ymir/`


## Paaliaq

- `irregular-reference/paaliaq-reference-source.png` preserves the cleaned user-supplied visual reference used for this implementation.
- `paaliaq-albedo.jpg` is a seamless 2:1 rocky colour wrap derived from that frame, with the watermark strip and background excluded from the final body texture.
- `paaliaq-height.jpg` and `paaliaq-roughness.jpg` are restrained derived maps used to reinforce the object-scale relief already carried by the geometry.
- The factory uses a closed volumetric asteroid mesh with a broad rounded left shoulder and a restrained rightward taper. The source silhouette is not extruded, preventing thin spikes or bird-like profiles during rotation.
- The detailed body is a reference-directed artistic reconstruction; currently available public observations do not provide a resolved global map of Paaliaq at this level.

Reference note:
User-supplied image, combined with published Paaliaq orbital / size constraints.

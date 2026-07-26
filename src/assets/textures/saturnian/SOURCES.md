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

## Tarvos, Ijiraq, Suttungr, Kiviuq, Mundilfari, and Albiorix

- Each moon has a preserved `*-reference-source.png` supplied by the user and a
  cleaned `*-albedo.jpg` created specifically for this project.
- The albedo maps remove the source backgrounds, watermarks, fixed lighting,
  and silhouettes. They are neutral, seamless 2:1 colour wraps so the project
  Sun controls the visible day and night sides.
- Geometry is not inferred from flat colour alone. The factory separately
  rebuilds the six supplied silhouettes as closed volumetric meshes: Tarvos's
  broken wedge, Ijiraq's flattened potato, Suttungr's oblate cap, Kiviuq's
  offset heart/pear mass, Mundilfari's twin-shouldered upright rock, and
  Albiorix's pinched asymmetric lobes.
- Deterministic geometry adds actual crater bowls, raised rims, pitting,
  large-scale rubble relief, and Mundilfari's fine fluted wrinkles, ensuring
  the surface remains three-dimensional when dragged and inspected.
- These distant moons have not been globally imaged at the displayed
  resolution. All six are clearly treated in the interface and code as
  reference-directed artistic reconstructions, not measured global maps.

Reference note:
Six user-supplied visual references, combined with the project's existing
Saturn catalogue and family/orbit presentation.

## Skathi, Erriapus, Siarnaq, Thrymr, Narvi, Methone, Aegir, Bebhionn, and Bergelmir

- The nine user-supplied pictures are preserved as
  `irregular-reference/*-reference-source.png`.
- Each corresponding `*-albedo.jpg` is a project-made, seamless 2:1 colour
  wrap. Source backgrounds, labels, watermarks, silhouettes, and fixed
  photographic shadows are excluded so the scene's solar light creates each
  moon's day/night divide.
- Closed volumetric geometry separately reconstructs the visible shape cues:
  Skathi's broken egg-like crown, Erriapus's sloped boulder, Siarnaq's
  cratered near-globe, Thrymr's subdued ring basin, Narvi's blocky scarp and
  deep basin, Aegir's jagged upright shard, Bebhionn's squat grooved boulder,
  and Bergelmir's densely cratered eroded wedge.
- Methone retains its smooth Cassini-constrained ellipsoidal geometry and now
  uses the supplied pale surface direction as a neutral ice wrap.
- Albiorix's earlier large per-vertex lobe offsets were replaced with a
  closed radial sculpt. This preserves its asymmetric contact-like form
  without folded triangles or background-visible seams while rotating.
- Except for Methone's spacecraft-constrained gross shape, these distant
  irregular moons do not have resolved global maps matching this detail.
  Their displayed surfaces are explicitly reference-directed artistic
  reconstructions, not measured topography.

Reference note:
Nine user-supplied visual references, combined with the project's existing
Saturn catalogue and orbital-family presentation.

## Bestla, Farbauti, Fenrir, Fornjot, Hati, Hyrrokkin, Kari, and Loge

- The eight user-supplied pictures are preserved as
  `irregular-reference/*-reference-source.png`.
- Each `*-albedo.jpg` is a project-made seamless 2:1, neutrally lit surface
  wrap derived from the corresponding visual direction. Backgrounds, text,
  watermarks, silhouettes, and photographed shadows are excluded so Saturn-
  system sunlight remains responsible for the visible day/night boundary.
- Closed, seam-normal-welded geometry independently reconstructs the supplied
  silhouette cues: Bestla's huge but sealed cavern-like bowls, Farbauti's dark
  double lobes, Fenrir's cratered near-globe, Fornjot's raised shoulder, Hati's
  flattened slab, Hyrrokkin's rusty basins, Kari's smooth pale pebble, and
  Loge's asymmetric twin-basin body.
- These tiny distant moons do not have resolved global maps at this detail.
  Their surfaces and exact silhouettes are reference-directed artistic
  reconstructions, not measured topography.

Reference note:
Eight user-supplied visual references, combined with the project's existing
Saturn catalogue and orbital-family presentation.

## Skoll through Geirrod reference set

- Nineteen user-supplied visual references cover Skoll, Surtur, Jarnsaxa,
  Greip, Tarqeq, Gridr, Angrboda, Skrymir, Gerd, S/2004 S26, Eggther,
  S/2004 S29, Beli, S/2004 S27, Gunnlod, Thiazzi, S/2004 S17, Alvaldi, and
  Geirrod. Preserved copies use the `*-reference-source.png` suffix.
- The runtime does not wrap those photographs directly. Corresponding
  `*-albedo.jpg` files are project-made, seamless 2:1, neutrally illuminated
  maps. Backgrounds, labels, stock watermarks, fixed shadows, silhouettes, and
  empty-space gaps are excluded so the scene's Sun creates the real day/night
  boundary.
- Every named body uses a sealed volumetric sculpt with its own axes, crater
  population, relief, and defining silhouette. Tarqeq's memorable face-like
  reading is produced geologically by paired brow ridges and eye grooves, a
  central ridge, cheek bulges, and a shallow lower basin; no human face is
  painted onto its texture.
- The remaining unresolved Saturnian catalogue stays performance-friendly in
  InstancedMesh fields. Four deterministic closed geometry families—battered
  pebble, contact-lobed rock, rubble slab, and tapered shard—replace the former
  single generic icosahedron while retaining low draw-call cost.
- These distant moons have not been globally resolved at the displayed
  resolution. Their colours, small-scale terrain, and exact shapes are
  reference-directed artistic reconstructions, not measured global maps.

Reference note:
Nineteen user-supplied visual references, combined with the project's Saturn
catalogue and the existing family/orbit presentation.

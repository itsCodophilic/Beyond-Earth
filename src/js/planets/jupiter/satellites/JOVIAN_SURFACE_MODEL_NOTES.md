# Jovian Moon 3D Surface Model

This source keeps the project's 115-entry JPL orbital catalogue while separating visual certainty into evidence tiers.

- **Spacecraft-resolved:** Io, Europa, Ganymede, Callisto, Metis, Adrastea, Amalthea and Thebe use characteristic shape, colour and terrain rules informed by spacecraft observations.
- **Photometrically constrained:** Himalia and several large named irregular moons use measured/estimated size, low albedo, colour class and dynamical-family structure.
- **Dynamical-family reconstruction:** unresolved small moons receive deterministic individual 3D fragments. Their exact shape and craters are not claimed as observed.

Key public sources used for the model:

- NASA Jupiter moons: https://science.nasa.gov/jupiter/jupiter-moons/
- NASA individual moon pages: https://science.nasa.gov/jupiter/jupiter-moons/all-jupiter-moons/
- JPL satellite mean elements: https://ssd.jpl.nasa.gov/sats/elem/
- JPL satellite physical parameters: https://ssd.jpl.nasa.gov/sats/phys_par/

The renderer uses vertex-sculpted geometry rather than flat image decals. Craters are cut into the radius of the mesh with a raised rim and central peak where appropriate, so their shadows and silhouettes change as the moon rotates. Galilean moons receive smooth high-detail relief; irregular moons use asteroid-like geometry, family colour, crater variation, closer focus framing and deterministic individual morphology.

Resolved geology is deliberately different for each world:

- **Io:** calderas, volcanic paterae, sulphur-rich plains and mountain relief; artificial impact craters are disabled because volcanism rapidly renews the surface.
- **Europa:** a nearly spherical, young ice shell with reddish lineae, narrow double ridges, chaos terrain and only a few impact scars.
- **Ganymede:** older dark cratered regions blended with brighter grooved terrain and broad tectonic ridges.
- **Callisto:** the most densely cratered Galilean surface, including overlapping bowl craters and a large multi-ring impact basin.
- **Metis and Adrastea:** irregular collision-shaped silhouettes without invented individually resolved craters.
- **Amalthea and Thebe:** strongly irregular inner moons with large crater, hill and valley relief.

For unresolved irregular moons, crater fields are plausible family-level reconstructions rather than maps of observed named features. Their deterministic seeds make every object repeatable and visually individual while keeping that scientific limitation explicit.

## v5 inspection and performance architecture

The earlier v4 implementation generated maximum-detail geometry for all 115 moons during startup and rendered every one when Jupiter was selected. That was scientifically richer internally, but wasteful at screen sizes where most moons were only a few pixels across.

v5 uses two real 3D levels:

- **Preview 3D:** every moon keeps a unique deformed, lit, faceted or smooth mesh while orbiting Jupiter.
- **Inspection 3D:** only the selected moon is promoted to dense geometry with amplified physical relief, a procedural bump map, and a dedicated inspection light. The previous moon is returned to its preview mesh and its temporary GPU resources are disposed.

At high quality, the approximate all-moon preview triangle budget drops from roughly 957,000 triangles in v4 to roughly 28,000 triangles in v5. Selecting a Galilean moon promotes only that body to about 21,780 triangles and a 384 × 192 procedural relief map. That is dense enough for curved crater bowls and ridges in close-up while avoiding the original Jupiter-focus lag.

## v6 spacecraft-mosaic Galilean surfaces

The four Galilean hero moons now use local global spacecraft mosaics instead of procedural line and crater colour fields:

- **Io:** NASA/JPL/USGS PIA09257 Galileo–Voyager colour basemap.
- **Europa:** USGS Voyager–Galileo SSI global mosaic, mapped to its pale ice and reddish-brown lineae character.
- **Ganymede:** a cylindrical global map assembled by Björn Jónsson from NASA Voyager and Galileo imagery.
- **Callisto:** USGS Galileo–Voyager global map, mapped to the moon's dark ancient terrain and bright impact markings.

The previous great-circle line generator and clean procedural crater rings are disabled for these four bodies. Their real image mosaics now provide the visible terrain identity in both preview and inspection modes. Local derived height and roughness maps add only restrained lighting relief; they are not presented as authoritative elevation products. Shared texture caching prevents the maps from being regenerated or reloaded every time inspection mode changes.

Full texture provenance and attribution are recorded in `public/assets/textures/jovian/SOURCES.md`.

## v7 image-directed irregular reference surfaces

Callirrhoe, Thyone and Pasithee now use dedicated reference-derived 3D surface sets. The supplied screenshots were treated as visual direction rather than pasted decals: labels, stars, black backgrounds, fixed shadows and object silhouettes were removed before their colour character and local terrain were rebuilt as seamless 2:1 albedo, height and roughness maps.

Each moon also receives an individually sculpted silhouette:

- **Callirrhoe:** compact dark potato-like body with one fuller shoulder and a softly clipped end.
- **Thyone:** pale peach-and-cream rounded fragment with restrained facets and weathered mineral provinces.
- **Pasithee:** tall top-heavy pear form with an offset cap, shallow neck, broad centre, tapered lower point and strongly corrugated grey regolith.

These remain explicitly labelled reference-directed artistic reconstructions because spacecraft have not resolved the exact shapes or mapped surfaces of these small irregular moons.


## v8 Arche, Helike, Kore, Herse, Eirene and Philophrosyne

Six further outer moons now receive dedicated full albedo, height and roughness sets plus individual silhouettes:

- **Arche:** compact angular red impact fragment with a raised crown, clipped face, dark pits and granular ruby/rust regolith.
- **Helike:** tall hooked crescent with a deep real geometry cavity, rounded rear shell, lower inward hook and warm brown-beige marbling.
- **Kore:** intentionally planet-like near-sphere with cool blue-grey plains and a dense but restrained crater field.
- **Philophrosyne:** compact dwarf-moon-like olive-brown globe with broad weathered terrain, impact bowls and dusty golden rims.
- **Herse:** homogeneous dull light-red D-type potato fragment; the palette deliberately avoids saturated or multi-coloured patches.
- **Eirene:** jagged porous Carme-family fragment with a dominant lobe, raised shard, missing notch, heavy cratering and dusty muted-red regolith.

The four supplied screenshots are used as shape, palette and terrain direction rather than pasted directly around the meshes. Fixed shadows, star fields, labels and silhouettes are excluded from the texture maps so Jupiter-system lighting remains physically responsive. Herse and Eirene follow the user-supplied composition, colour and expected-structure guidance. Every one remains labelled as a reconstruction because no close spacecraft surface map exists for these tiny moons.


## v9 Eupheme, Pandia and Ersa

Three additional moons now use dedicated reference-derived albedo, height and roughness maps plus individually controlled silhouettes:

- **Eupheme:** warm pale-ochre, nearly spherical and densely cratered, with one dominant physically recessed broken-rim basin.
- **Pandia:** pale dwarf-moon-like body that transitions from a smooth rounded hemisphere into a clipped, churned and rubble-rich fracture face.
- **Ersa:** softly rounded lavender-blue-grey moon with smoother weathered plains and only restrained shallow craters.

The screenshots provide palette, terrain and silhouette direction only. Black space, fixed shadows, stars, captions and image outlines are excluded from the seamless maps so the bodies continue to react to the Jupiter-system lights. All three remain clearly described as artistic reconstructions because spacecraft have not mapped these tiny moons in close detail.

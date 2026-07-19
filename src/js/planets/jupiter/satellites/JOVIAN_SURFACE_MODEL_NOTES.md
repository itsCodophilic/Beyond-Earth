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

Full texture provenance and attribution are recorded in `src/assets/textures/jovian/SOURCES.md`.

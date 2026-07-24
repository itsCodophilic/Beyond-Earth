# Galilean Moon Texture Sources

These local textures replace the earlier purely procedural hero-moon colour maps.
They are resized and lightly processed for real-time WebGL rendering.

## Io

- Source mosaic: **PIA09257 – Io from Galileo and Voyager missions**
- Producer: NASA/JPL/USGS
- Source page: https://commons.wikimedia.org/wiki/File:Io_from_Galileo_and_Voyager_missions.jpg
- Status: United States government / NASA public-domain material
- Local processing: reference-grid removal, 2:1 texture reprojection, colour and contrast balancing, derived subtle relief and roughness maps

## Europa

- Source mosaic: **Europa Voyager–Galileo SSI global mosaic**
- Producer: U.S. Geological Survey / Planetary Data System / Tammy Becker
- Source page: https://commons.wikimedia.org/wiki/File:Europa_Voyager_GalileoSSI_global_mosaic.jpg
- Status: United States government public-domain material
- Local processing: polar-edge crop, visible-colour mapping based on the spacecraft image character, and derived subtle relief and roughness maps

## Ganymede

- Source mosaic: **Map of Ganymede by Björn Jónsson**, assembled from NASA Voyager and Galileo imagery
- Source page: https://commons.wikimedia.org/wiki/File:Map_of_Ganymede_by_Bj%C3%B6rn_J%C3%B3nsson.jpg
- Attribution requested by the map author: **Created by Björn Jónsson from NASA Voyager and Galileo imagery**
- Local processing: 2:1 resize, restrained colour/contrast balancing, and derived subtle relief and roughness maps

## Callisto

- Visual reference: the user-supplied crater-saturated Callisto image
- Local reconstruction: an original seamless 2:1 albedo map matching its dark
  brown-grey terrain, dense bright ejecta, pale basins, and cool mineral hints
- Supporting maps: subtle height and roughness textures locally derived from
  the new albedo reconstruction for real-time WebGL lighting
- Accuracy note: this is a reference-directed visual reconstruction rather than
  an authoritative global digital elevation model

The height maps are intentionally subtle visual aids derived from the source mosaics. They are not claimed to be authoritative global digital elevation models.

## Irregular-moon reference reconstructions

The `irregular-reference/` directory contains original, seamless 2:1 albedo
textures for Lysithea, Ananke, Leda, Chaldene, Harpalyke, Kalyke, Iocaste,
Erinome, Isonoe, Praxidike, Themisto, and Megaclite.

- Method: generated as clean texture assets from the user's supplied visual
  direction, then resized to 1024×512 and optimized for real-time WebGL.
- Intended use: surface colour and broad markings only. Existing procedural
  height and roughness maps continue to create the physical relief and lighting.
- Accuracy note: most of these distant moons have not been resolved into global
  spacecraft maps. These assets are visual reconstructions, not observational
  global mosaics and not authoritative geology.
- Copyright hygiene: the supplied screenshots are not embedded in the project;
  black backgrounds, baked lighting, labels, and watermarks were excluded.

## Post-Praxidike collage reconstructions

The `collage-reference/` directory contains original seamless albedo maps for
the clear post-Praxidike references: Autonoe, Hermippe, Aitne, Eurydome,
Euanthe, Euporie, Orthosie, Sponde, Kale, Mneme, Aoede, Thelxinoe, Carpo,
Eukelade, Hegemone, Dia, Cyllene, Kallichore, S/2010 J 2, and S/2010 J 1.

- The source collage is used only as visual direction for colour, mineral
  markings, and broad texture character.
- Labels, black space, fixed lighting, silhouettes, and blurry source pixels
  are not copied into the texture maps.
- A later set of clearer individual references replaced the blurred Hegemone,
  Dia, Cyllene, and Kallichore thumbnails. Aitne's albedo and asymmetric
  two-lobed geometry were rebuilt from its clearer reference; Thelxinoe kept
  its accepted colour wrap but received a new rounded concave silhouette;
  Eukelade's wrap was revised to a very pale dusty-red and lilac-grey balance.
- Cyllene intentionally follows the nearly spherical, red-banded rocky visual
  supplied by the user. That treatment is visual direction, not a claimed
  spacecraft-resolved global map.
- These tiny moons are unresolved; every map remains an artistic
  reconstruction wrapped over the project's independent 3D relief, roughness,
  sunlight, and night-side rendering.

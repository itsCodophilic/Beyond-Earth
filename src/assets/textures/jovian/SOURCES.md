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

- Source mosaic: **Callisto USGS global map**, based on Galileo and Voyager data
- Producer: USGS Astrogeology Science Center
- Source page: https://commons.wikimedia.org/wiki/File:Callisto_USGS_global_small.jpg
- Status: USGS public-domain material
- Local processing: polar-edge crop, restrained visible-colour mapping, and derived subtle relief and roughness maps

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

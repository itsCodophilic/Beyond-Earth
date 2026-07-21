# Mimas and Iapetus implementation

Both moons now use the same dedicated hero-moon architecture as Titan and Jupiter's resolved Galilean moons.

## Mimas

### Mapped surface

- 2048×1024 NASA Cassini-derived albedo map
- 1024×512 bump and roughness maps
- Water-ice colour treatment with bright crater walls and darker crater floors

### Geometry-level Herschel crater

The Herschel crater is rebuilt in the sphere geometry instead of relying on a flat texture:

- approximately one-third of Mimas' diameter
- deep bowl
- raised outer wall
- terraced inner wall
- prominent central peak
- subtle anti-Herschel fractures on the opposite hemisphere

The remaining surface receives a deterministic population of smaller bowl-shaped craters.

## Iapetus

### Bright-dark dichotomy

- coal-brown, slightly reddish Cassini Regio across the leading low/mid latitudes
- bright cream/gray water-ice terrain across the trailing hemisphere and polar regions
- irregular transition rather than a clean half-and-half split
- large basin-scale features and smaller crater population

### Equatorial ridge and shape

- slightly flattened global silhouette
- narrow mountain chain following the equator
- broken/segmented ridge rather than a continuous smooth ring
- relief scaled to remain visible without becoming a Saturn-like ring or artificial belt

## Integration

- `saturnianMoonFactory.js` owns the mapped surfaces and geometry relief.
- `saturnianMoonCatalog.js` contains their evidence, structure descriptions, roughness, and presentation angles.
- Other Saturnian moons continue using the existing lightweight procedural path.

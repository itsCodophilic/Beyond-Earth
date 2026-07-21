# Titan implementation

Titan now follows the same hero-moon architecture used for Jupiter's resolved Galilean moons instead of the old palette-only procedural sphere.

## Visual layers

1. **Mapped surface**
   - 2048×1024 colour map
   - 1024×512 height and roughness maps
   - Smooth spherical geometry with restrained displacement and bump detail
   - Cream, amber, lavender, muted blue, and organic-brown regions based on the supplied multi-angle reference

2. **Methane cloud veil**
   - Lightweight animated procedural shader
   - Broad low-opacity cloud fields with extra polar activity

3. **Lower photochemical haze**
   - Warm orange/cream atmospheric filtering over the disc
   - View-angle and sunlight-aware opacity

4. **Extended atmospheric limb**
   - Thin golden daytime rim
   - Muted violet night-side limb

## Integration

- `saturnianMoonFactory.js` creates the full Titan system.
- `satelliteSystem.js` skips the old generic atmosphere when a moon supplies `hasCustomAtmosphere`.
- `saturnianMoonCatalog.js` exposes Titan-specific evidence, surface structure, roughness, and an initial presentation angle.
- Other Saturnian moons retain their previous generation path.

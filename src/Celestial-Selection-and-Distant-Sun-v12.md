# Celestial selection and distant Sun — v12

## Selection priority

- Stars, planets, and natural satellites take priority over asteroid clutter.
- Major bodies receive a small visibility-aware screen-space click cushion.
- Sub-pixel bodies are treated as regions to explore, not invisible click targets.
- Instanced asteroid rocks are selected only after their projected radius is visibly resolvable.
- GPU-instanced rocks no longer participate in the broad scene raycast, preventing hidden rocks from stealing clicks.

## Distant Sun

The physical solar disk still becomes smaller with distance. Its unresolved corona, diffraction flare, glow size, opacity, pulse, and ray rotation now strengthen progressively during deep-space travel and from remote planetary or asteroid viewpoints. Depth testing remains enabled, so solid celestial bodies can still eclipse the flare.

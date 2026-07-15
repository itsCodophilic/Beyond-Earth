# Celestial Hover Lock and Collapsible Focus Card — v14

## Magnetic celestial locator

The green locator now applies to the Sun, planets, natural satellites, named asteroids, generated asteroid meshes, and visible instanced belt rocks.

When a body enters the small visibility-aware hover area:

- its name and type are shown;
- the locator follows the moving body;
- pointer parallax pauses;
- the Solar System simulation slows to 4.5% speed;
- the hover target remains magnetically locked until the pointer moves away;
- clicking selects the locked target even if it moves several pixels.

Major celestial bodies retain priority over foreground asteroid clutter.

## Focus-card collapse

The information card has a green collapse control. Collapsing it does not end focus or restore the journey. A small information button remains on the right edge and restores the full card.

The body-to-card connector is hidden while the card is collapsed.

## Earth-return control

The rocket control is positioned in the bottom-right corner, opposite the lower-left journey-distance panel.

import * as THREE from "three";

/**
 * How far away a faint ring system stays worth drawing.
 *
 * What was reported: from the system view every ring except Saturn's glowed
 * brighter than the planet it belongs to. Three separate things were causing
 * it, and only one of them was a mistake.
 *
 *   1  The band shaders deliberately *raised* alpha with distance --
 *      `mix(1.20, 0.74, uInspection)` -- so a ring seen from a thousand
 *      radii away was drawn twenty per cent brighter than the same ring seen
 *      from close up. That was written to stop distant rings vanishing and it
 *      overshot.
 *   2  A ring is a large thin sheet seen nearly edge-on. Fold the whole of it
 *      into a handful of pixels and every one of those pixels accumulates the
 *      sheet's full alpha, so the ring concentrates while the planet's disc,
 *      which is shrinking honestly, does not.
 *   3  Real dust rings are faint *because they are resolved*. Uranus's rings
 *      cannot be seen from Earth in a backyard telescope at all; they were
 *      found by watching a star wink out behind them.
 *
 * So the rule: below `fullBelowRadii` the rings are drawn as authored, they
 * fade out between there and `goneAboveRadii`, and past that the whole system
 * is switched off -- not merely transparent, because an invisible group still
 * costs its draw calls and its particle sort every frame.
 *
 * The two numbers come from measurement, not taste. Focusing a planet puts
 * the camera at 4.2 planet radii. The arrival view sits at 750 to 1,800.
 * Looking at one planet while another sits in the background is 125 to 1,100.
 * Fourteen leaves the focused view untouched with room to spare; seventy is
 * well inside the nearest of those background cases.
 *
 * Saturn is deliberately not wired to this. Its rings are the reason anyone
 * looks at Saturn and they are genuinely visible from Earth through the
 * smallest telescope, so they read at every distance by right.
 */
export const RING_PROXIMITY = Object.freeze({
  fullBelowRadii: 14,
  goneAboveRadii: 70,
  /** Below this the system is hidden outright rather than drawn at nothing. */
  hideBelowFade: 0.004,
});

/** 1 close in, 0 far out, smooth between. `normalizedDistance` is in planet radii. */
export function ringProximityFade(normalizedDistance) {
  return 1 - THREE.MathUtils.smoothstep(
    normalizedDistance,
    RING_PROXIMITY.fullBelowRadii,
    RING_PROXIMITY.goneAboveRadii,
  );
}

/**
 * Switches a whole ring system off once it has faded to nothing, and back on
 * when it has not.
 *
 * The pointer targets are taken out with it. They are invisible annuli and
 * three's raycaster does not check `visible`, so without this a ring nobody
 * can see would still answer a hover from a thousand radii away. Clearing the
 * layers is what the raycaster does test.
 *
 * Both sides run only on the transition, so the steady state costs one
 * comparison.
 */
export function applyRingProximityVisibility(system, fade) {
  const shouldDraw = fade > RING_PROXIMITY.hideBelowFade;
  if (system.userData.proximityDrawn === shouldDraw) return shouldDraw;
  system.userData.proximityDrawn = shouldDraw;
  system.visible = shouldDraw;
  system.userData.interactionTargets?.forEach((target) => {
    if (!target?.layers) return;
    if (shouldDraw) target.layers.enable(0);
    else target.layers.disableAll();
  });
  return shouldDraw;
}

/**
 * The invisible geometry that exists only to be clicked.
 *
 * A great many things in this scene are too small or too thin to hit reliably
 * with a pointer -- a two-pixel asteroid, a ring a fraction of a pixel thick,
 * a moon at the far end of the Solar System -- so each of them carries a
 * generously sized proxy mesh that the raycaster can find. Those proxies are
 * already invisible: `colorWrite` is off and the opacity is zero, so they put
 * no colour on the screen.
 *
 * What they were still doing was being *drawn*. Four hundred and forty of them
 * went through the renderer every frame -- sorted into the transparent queue,
 * bound, and rasterised, with the fragment shader run over every pixel they
 * covered, all to write nothing. Measured against the rest of the scene they
 * came to roughly two and a half milliseconds a frame, which was around a
 * third of everything left after the Sun's plasma was batched.
 *
 * Moving them to a layer the camera does not render, and telling the raycaster
 * to look at that layer, keeps every one of them clickable and stops all of
 * them being drawn. It is the same objects, in the same places, with the same
 * hit behaviour; they are simply no longer submitted.
 *
 * Layers 6 and 7 are already spoken for by the two inspection lighting rigs,
 * so this takes 5.
 */
export const POINTER_PROXY_LAYER = 5;

/**
 * Marks one mesh as click-only.
 *
 * `set` rather than `enable`, deliberately: the object has to leave layer 0
 * for the camera to stop drawing it. Anything that later enables another layer
 * on it -- the asteroid inspection rig does, briefly -- keeps this one, and the
 * raycaster keeps finding it either way.
 */
export function markPointerProxy(object) {
  if (!object) return object;
  object.layers.set(POINTER_PROXY_LAYER);
  return object;
}

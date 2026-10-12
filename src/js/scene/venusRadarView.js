/**
 * Venus beneath its clouds, as radar sees it (round 42, the owner, with
 * NASA's Magellan globe: "venus image i found"; chosen: keep the clouds as
 * the eye sees them and add a view beneath them).
 *
 * Visible light never reaches Venus's ground and back: the sulphuric-acid
 * cloud deck is optically thick, so every camera sees the pale cream ball
 * (planetFactory.js addVenusClouds). Radar passes through. NASA's Magellan
 * orbiter (1990-1994) mapped about 98% of the surface that way, and the
 * familiar orange globe is that radar mosaic. Radar has no colour: the
 * orange is NASA/JPL's choice, taken from the Soviet Venera 13 and 14
 * landers' colour photographs of the ground (NASA/JPL PIA00104 and its
 * notes).
 *
 * The scene already carries a map in that scheme under the clouds
 * (public/textures/venus-surface-2k.jpg, the `venus` texture), drawn dark
 * so it never shows through. This view hides the cloud deck and the
 * atmosphere shell and shows that map as a radar image: lit evenly, since
 * a radar image is lit by the radar, not the Sun, with a little sunlight
 * left on for shape (the emissive and colour levels below were chosen by
 * eye against the owner's Magellan image).
 *
 * Cost: none while off; while on, two hidden meshes and one changed
 * material.
 */
const HIDE = ["Venus cloud deck", "Venus atmosphere"];

/* While on: the map lights itself (radar illumination) at 0.72, and the Sun
 * adds a little shading on a 0x262626 base. Chosen by eye: with a 0x585858
 * base the sunlit half washed out to a pale peach under the scene's tone
 * mapping, unlike the deep orange of the Magellan globe. */
const RADAR = { color: 0x262626, emissive: 0xffffff, emissiveIntensity: 0.72 };

/**
 * Turns the radar view on or off for the Venus mesh. Returns whether it is
 * on afterwards. Safe to call repeatedly.
 */
export function setVenusRadar(venus, on) {
  if (!venus?.material) return false;
  const state = (venus.userData.radarView ??= { on: false, hidden: [], saved: null });
  if (on === state.on) return state.on;
  const material = venus.material;
  if (on) {
    state.saved = {
      color: material.color.getHex(),
      emissive: material.emissive.getHex(),
      emissiveMap: material.emissiveMap,
      emissiveIntensity: material.emissiveIntensity,
    };
    material.color.setHex(RADAR.color);
    material.emissive.setHex(RADAR.emissive);
    material.emissiveMap = material.map;
    material.emissiveIntensity = RADAR.emissiveIntensity;
    material.needsUpdate = true;
    venus.traverse((object) => {
      if (object !== venus && HIDE.includes(object.name) && object.visible) {
        object.visible = false;
        state.hidden.push(object);
      }
    });
  } else {
    const saved = state.saved;
    if (saved) {
      material.color.setHex(saved.color);
      material.emissive.setHex(saved.emissive);
      material.emissiveMap = saved.emissiveMap;
      material.emissiveIntensity = saved.emissiveIntensity;
      material.needsUpdate = true;
    }
    state.hidden.forEach((object) => { object.visible = true; });
    state.hidden = [];
    state.saved = null;
  }
  state.on = on;
  return on;
}

export const isVenusRadarOn = (venus) => Boolean(venus?.userData?.radarView?.on);

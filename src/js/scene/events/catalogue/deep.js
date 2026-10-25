import { REDESIGNED_DEEP_EVENTS } from "./deepRedesign.js";
import { NOVA_EVENTS } from "./novae.js";
import { NEW_DEEP_EVENTS } from "./deepNew.js";

/**
 * Section 12 of the catalogue: deep sky.
 *
 * Round 88 (Prompts.md: the deep-sky events made real -- "travelling
 * beyond the solar system ... at light speed to reach that star ... and
 * we will go back to the solar system, seeing it from there"): every
 * event is now a voyage (deepVoyage.js) from the real Earth to the real
 * object and back.
 *
 *   novae.js         the kinds of nova, one event each (the core-collapse
 *                    supernova and the kilonova are the round-1 events in
 *                    solarSystemEvents.js, redesigned there from here)
 *   deepRedesign.js  the twelve round-79 deep-sky events, redesigned
 *   deepNew.js       new: wormhole, the biggest black hole and star, a
 *                    white hole, a Dyson sphere, the Boötes Void, a pulsar,
 *                    Kepler-186f, the Heart and Horsehead nebulae, the
 *                    kinds of galaxy, J1407b, a rogue planet, Eta Carinae
 *                    and the Pillars of Creation
 *
 * The round-79 dioramas are kept in docs/archive/deep-dioramas-round79/.
 */
export const DEEP_EVENTS = [...NOVA_EVENTS, ...REDESIGNED_DEEP_EVENTS, ...NEW_DEEP_EVENTS];

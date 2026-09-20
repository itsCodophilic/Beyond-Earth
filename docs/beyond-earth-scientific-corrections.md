# Beyond Earth — Scientific Corrections & Misleading Claims

## Scope

This review compares the two current project markdowns:

- `celestial-bodies.md`
- `space-events.md`

against current NASA/IAU-facing information checked in September 2026.

This file contains **items that should be corrected, qualified, or reclassified**. It does not mean the visual implementation is bad; several items are perfectly reasonable artistic/educational approximations but should not be presented as complete or strictly factual.

---

## 1. Moon count: Saturn is outdated (Ignore this step for now)

### Current project claim

`celestial-bodies.md` says:

> Saturn — 285 moons

and the headline total is:

> 453 moons

### Correction

NASA's current Saturn page states that **Saturn has 293 confirmed moons as of August 2026**. NASA also notes that 128 small moons were confirmed in March 2025.

Therefore, the Saturn figure of 285 is stale.

If the project counts:

- Earth: 1
- Mars: 2
- Jupiter: 115
- Saturn: 293
- Uranus: 29
- Neptune: 16
- Pluto: 5

the corresponding total is **461 known moons**.

### Recommended wording

Use:

> **Known moons represented: 461**  
> *Counts are date-sensitive and can change as new satellites are confirmed.*

Do not hard-code a timeless "total moons" number without a date.

Sources:
- NASA, Saturn Moons: https://science.nasa.gov/saturn/moons/
- NASA, Jupiter Moons: https://science.nasa.gov/jupiter/jupiter-moons/
- NASA, Uranus Moons: https://science.nasa.gov/uranus/moons/facts/
- NASA, Neptune Moons: https://science.nasa.gov/neptune/moons/facts/
- NASA, Pluto Moons: https://science.nasa.gov/dwarf-planets/pluto/moons/

---

## 2. Uranus moon count should be explicitly dated (Ignore this step for now)

The project says 29, which is correct for the current 2026 count.

NASA's August 2026 page says Uranus has **29 known moons**.

However, another older NASA page still contains 28. This illustrates why the project should date dynamic counts.

### Recommended UI

> **29 known moons (Aug 2026)**

Source:
https://science.nasa.gov/uranus/moons/facts/

---

## 3. "Three ring systems" is misleading/incomplete (Maybe Jupiter pending, rest mentioned planet requires verification)

### Current project claim

The implementation describes:

> Ring systems — 3

covering Saturn, Uranus and Neptune.

### Why this is misleading

Jupiter has a real, faint ring system. NASA explicitly describes Jupiter's equatorial dust rings.

Therefore, if the project is claiming to cover **Solar System ring systems**, Jupiter should not be omitted.

There is also evidence for rings around dwarf planets/large trans-Neptunian bodies, notably **Haumea** and **Quaoar**.

### Recommended distinction

Separate the concepts:

**Planetary ring systems**
- Jupiter
- Saturn
- Uranus
- Neptune

**Confirmed rings around smaller bodies**
- Haumea
- Quaoar

Then distinguish:

> **Implemented ring systems: 3**

from:

> **Known ring-bearing bodies in the Solar System: at least 6**

This avoids confusing implementation coverage with astronomical reality.

Sources:
- NASA Solar System basics: https://science.nasa.gov/learn/basics-of-space-flight/chapter1-2/
- NASA Solar System exploration: https://science.nasa.gov/solar-system/

---

## 4. Haumea's and Quaoar's rings are described but not drawn (I think it is drawn but verify)

This is not scientifically wrong; it is a **coverage gap**.

The current markdown correctly admits that the rings are not drawn.

For a project whose goal is "cover everything within the Solar System," these should be promoted to the missing-work list.

---

## 5. "Nine bodies. Five IAU dwarf planets; the rest are candidates" needs careful wording

The project lists:

- Ceres
- Pluto
- Haumea
- Makemake
- Eris
- Orcus
- Quaoar
- Gonggong
- Sedna

The five recognized dwarf planets are correct.

However, the other four should be called **dwarf-planet candidates / likely dwarf planets**, not presented as an equivalent official class.

### Recommended UI language

> **Dwarf planets:** 5 officially recognized  
> **Dwarf-planet candidates:** selected examples

There are many additional candidates beyond the four currently shown.

Source:
NASA: https://science.nasa.gov/solar-system/dwarf-planets/

---

## 6. The project cannot honestly claim complete Solar System object coverage from the current catalog (Ignore this)

The markdown says the scene contains 596 individually named/placed Solar System bodies.

That can be true for the implementation's selected catalog, but it should **not** be interpreted as "the Solar System contains only 596 bodies."

NASA currently describes the Solar System as containing approximately:

- **8 planets**
- **5 officially recognized dwarf planets**
- **hundreds of moons**
- about **1.4 million asteroids**
- about **4,000 comets**

The project's 5 individually modelled asteroids and selected TNOs are therefore a **curated visualization**, not a complete census.

Recommended wording:

> "Beyond Earth visualizes a curated, scientifically grounded subset of Solar System bodies, with representative populations for smaller-body regions."

Source:
https://science.nasa.gov/solar-system/

---

## 7. The Oort Cloud should not be described as directly observed

The project currently handles the Oort Cloud as a future/missing population, which is good.

Important scientific rule:

> The Oort Cloud has **never been directly observed**.

It is inferred from the orbital distribution of long-period comets and models.

Therefore, if you add it, render it as a **theoretical/inferred population**, not as a directly photographed structure.

NASA currently describes it as a predicted spherical shell extending roughly 5,000–100,000 AU.

Sources:
- https://science.nasa.gov/solar-system/oort-cloud/facts/
- https://science.nasa.gov/solar-system/solar-system-facts/

---

## 8. The heliopause is not the same thing as the outer edge of the Solar System

This distinction will become especially important because your next project is about cosmic boundaries.

The project documentation discusses:

- termination shock
- heliosheath
- heliopause

These are excellent inclusions.

But they represent the **heliosphere / solar-wind boundary**, not necessarily the full gravitational extent of the Solar System.

NASA describes the Oort Cloud as extending much farther than the heliosphere and potentially reaching ~100,000 AU.

Recommended conceptual hierarchy:

> Inner Solar System  
> → Outer planets  
> → Kuiper Belt  
> → Scattered Disk  
> → Heliosphere / heliopause  
> → Oort Cloud / gravitationally bound outer Solar System

Do not label the heliopause simply as "the edge of the Solar System."

Sources:
- https://science.nasa.gov/learn/heat/resource/components-of-the-heliosphere/
- https://science.nasa.gov/solar-system/oort-cloud/facts/

---

## 9. "Nothing in the sky is closer than four light-years" is a visualization rule, not an astronomical fact

The current background documentation says:

> nothing in the sky is closer than four light-years

This is only valid if it means the **rendering shell intentionally places deep-sky objects at artificial distances**.

It should not be presented as a physical statement.

For example, the nearest stellar system, Alpha Centauri, is about 4.37 light-years away, but the Solar System's sky contains many objects at distances below/above this depending on category.

Recommended wording:

> "Deep-sky objects are rendered on a camera-following sky shell; their shell distance is a visualization abstraction rather than their physical distance."

---

## 10. Supernova and kilonova are not Solar System events (Ignore this)

This is the biggest classification issue in `space-events.md`.

The event roster contains:

- Supernova
- Kilonova

Both are valid cosmic phenomena, but they are **not events occurring within our Solar System**.

They should not be counted in a category titled:

> "space events within the Solar System"

unless the UI explicitly labels them as:

> **Deep-sky / beyond-Solar-System phenomena**

### Recommended event categories

**Solar System events**
- solar/heliophysical
- planetary
- lunar
- small-body
- ring
- impact

**Deep-sky events**
- supernova
- kilonova
- future galactic events

This will make the project's scope scientifically clean.

---

## 11. "Sungrazing comet — Sun" is a real Solar System event, but it is better classified as a cometary event (Maybe improved wordings is require to use for the event)

A sungrazing comet is not a solar eruption.

The event is correctly described as a comet approaching very close to the Sun, potentially fragmenting or vaporizing.

Recommended category:

> **Small-body / cometary event**

rather than "solar event."

---

## 12. "Meteor shower" should be tied to a specific shower if presented as scientifically exact (ignore thid)

The current event is a generic meteor shower.

That is fine for visualization, but the project dossier uses highly specific language elsewhere.

A stronger implementation would support named showers such as:

- Perseids
- Geminids
- Quadrantids
- Leonids
- Lyrids
- Orionids
- Eta Aquariids
- Southern Delta Aquariids
- Draconids
- Taurids

A generic "meteor shower" should be labelled as a **representative visualization**, unless its radiant, parent body, activity window and rate correspond to a named shower.

---

## 13. "Impact swarm — Jupiter / Saturn" should not be presented as a regularly occurring observable event (Renaming or actual event name occurred is require, wordings need to be correct)

Impacts on giant planets absolutely occur, but the implementation is a **representative impact visualization**, not a simulation of a particular observed event.

Recommended label:

> **Atmospheric impact — representative simulation**

rather than implying the exact swarm is a documented recurring event.

A particularly strong future addition would be a historically observed event such as:

> **Shoemaker–Levy 9 impact on Jupiter (1994)**

NASA documents the event as an actual cometary collision with Jupiter.

Source:
https://science.nasa.gov/learn/basics-of-space-flight/chapter1-3/

---

## 14. "Solar eclipse" is correct, but the implementation's geometry should not imply every eclipse looks like the staged one

A solar eclipse requires Sun–Moon–Earth alignment. The exact appearance depends on geometry.

NASA distinguishes:
- total
- annular
- partial
- hybrid

The current event is best labelled as a **representative solar eclipse** unless it is tied to a specific historical eclipse.

Source:
https://science.nasa.gov/eclipses/types/

---

## 15. The event catalog mixes "events" with "persistent phenomena" (Catergorization renaming wording of events which tells which recurring or transient describe simpler words for better understanding)

Some entries are genuinely transient:

- CME
- impact
- eclipse
- meteor shower
- dust storm
- supernova
- kilonova

Others are persistent/recurring phenomena:

- ring spokes
- Mercury sodium tail
- Triton geysers
- Enceladus plumes

This isn't wrong, but a more scientifically useful event system would distinguish:

### Transient events
Something happens and changes with time.

### Dynamic phenomena
A persistent process evolves continuously.

### Recurring events
The phenomenon repeats according to orbital/solar cycles.

This will make the future event catalog much easier to expand.

---

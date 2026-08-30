import * as THREE from "three";

/**
 * Things that actually happen out there, staged on a timer.
 *
 * The Solar System reads as furniture in most renderings: the planets go round
 * and nothing ever *occurs*. It is not a fair picture. Jupiter is struck by
 * something big enough to see from Earth a few times a year; Io is erupting
 * somewhere on its surface at every moment; Enceladus has been venting its own
 * ocean into Saturn's E ring for as long as anyone has looked; Earth ploughs
 * through the same debris streams on the same dates every year; and the Sun
 * throws a billion tonnes of its atmosphere into space several times a day.
 *
 * Every event here is one of those, built from what was actually observed --
 * the sizes, the durations, the colours and the rates are in the notes on each
 * one. Nothing is invented for effect; the only liberty is timing, because a
 * viewer will not wait eight months for the Perseids.
 */

/**
 * Nothing here runs on a timer any more.
 *
 * The roster used to rotate: one event every three and a half minutes, chosen
 * at random from whatever was on screen. That was the wrong shape twice over.
 * A viewer who stayed ten minutes saw three of fifteen events, in an order
 * they did not choose, usually on a body they were not looking at -- and the
 * ones they did see arrived unannounced, so the interesting part (what it is,
 * why it happens) had already started before they knew to look.
 *
 * So events are now staged only on request, and the request carries the whole
 * sequence with it: travel to the body, wait, watch it happen once. There is
 * no interval and no autoplay, because there is no rotation left to configure.
 */

/** How long after arriving at a body before its event begins. */
export const EVENT_ARRIVAL_DELAY_SECONDS = 5;

const scratchVector = new THREE.Vector3();
const scratchProjection = new THREE.Vector3();

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * The direction the camera lies in, expressed in the body's own local frame.
 *
 * Every event here is parented to the body it happens on, so it can pick where
 * on that body to happen. Left to chance, half of them happen on the far side
 * and the viewer sees nothing at all -- which for a one-second impact flash
 * means the event may as well not have fired. Nothing about *what* happens is
 * changed by this; only which face of the world it is staged on, which is the
 * same licence any photograph of these events was taken under.
 */
function localCameraDirection(target, camera, out) {
  if (!camera) return out.set(0, 0, 1);
  out.copy(camera.position);
  target.worldToLocal(out);
  if (out.lengthSq() < 1e-8) return out.set(0, 0, 1);
  return out.normalize();
}

/**
 * A point on the hemisphere facing the camera, scattered but never behind.
 *
 * `spread` is how far off the sub-camera point it may wander, in radians.
 */
function facingPoint(facing, spread, out) {
  // Any vector not parallel to `facing` gives a usable pair of tangents.
  const helper = Math.abs(facing.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const tangentA = new THREE.Vector3().crossVectors(facing, helper).normalize();
  const tangentB = new THREE.Vector3().crossVectors(facing, tangentA).normalize();
  const angle = Math.random() * spread;
  const around = Math.random() * Math.PI * 2;
  return out.copy(facing).multiplyScalar(Math.cos(angle))
    .addScaledVector(tangentA, Math.sin(angle) * Math.cos(around))
    .addScaledVector(tangentB, Math.sin(angle) * Math.sin(around))
    .normalize();
}

/** A soft round sprite texture, shared by every glow this module draws. */
let sharedGlowTexture = null;
function getGlowTexture() {
  if (sharedGlowTexture) return sharedGlowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.72)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.16)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sharedGlowTexture = new THREE.CanvasTexture(canvas);
  sharedGlowTexture.name = "Event glow";
  return sharedGlowTexture;
}

function makeGlow(colour, opacity = 1) {
  const material = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: colour,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  return new THREE.Sprite(material);
}

/* ------------------------------------------------------------------ events */

/**
 * A planet pulls in a swarm of rocks, and they come from everywhere.
 *
 * Amateur astronomers have caught Jupiter impacts repeatedly -- 2010 twice,
 * then 2012, 2016, 2017, 2019, 2021, 2022 -- and the pattern is always the
 * same: a rock or comet fragment of order five to twenty metres arrives at
 * close to sixty kilometres a second, and the entire encounter is over in
 * about one to two seconds. There is no crater and no debris. The object never
 * reaches a surface, because Jupiter has not got one; it detonates in the
 * upper atmosphere as a bolide, and what is seen from Earth is that flash.
 *
 * **Why several, and from different sides.** The first version staged one
 * rock, and one rock is a misleading picture of what a gas giant does. Jupiter
 * has three hundred and eighteen Earth masses of gravity sitting at the inner
 * edge of the asteroid belt, and everything that comes near it is bent toward
 * it -- from every direction at once, because the objects it accretes are on
 * every kind of orbit: main-belt strays kicked out by the 3:1 Kirkwood
 * resonance, Jupiter-family comets, Trojans knocked off their libration
 * points, and Centaurs falling in from beyond Saturn. Estimates from the
 * observed flash rate put objects this size hitting Jupiter tens of times a
 * year. A swarm arriving on unrelated trajectories is the honest picture; a
 * single rock on a single line is not.
 *
 * So this builds three to five of them, each with its own entry point on the
 * facing hemisphere, its own approach direction, its own size, and its own
 * arrival time -- staggered, so they land as a sequence rather than a volley.
 * They are genuinely independent: the direction each one comes in from is
 * sampled around the full circle of approach azimuths, not jittered off a
 * shared line.
 *
 * The builder is generic in its target, because the physics is. Saturn accretes
 * the same way for the same reason, and the only thing that changes is which
 * planet the flash is on.
 */
function createImpactSwarm(target, camera) {
  const group = new THREE.Group();
  group.name = "Impact swarm event";
  const radius = target.userData?.visualRadius ?? 1;
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * A basis on the plane perpendicular to the camera direction. Approach
   * azimuths are measured in this plane, which is what makes "from different
   * directions" mean something on screen rather than only in world space --
   * spreading the arrivals around a circle the viewer is looking down would
   * put them all on top of each other.
   */
  const helper = Math.abs(facing.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const screenRight = new THREE.Vector3().crossVectors(facing, helper).normalize();
  const screenUp = new THREE.Vector3().crossVectors(facing, screenRight).normalize();

  const count = 3 + Math.floor(Math.random() * 3);
  // Azimuths are handed out one per equal sector with a jitter inside it, so
  // the swarm cannot cluster on one side by accident -- which random sampling
  // of five directions does about a third of the time.
  const sector = (Math.PI * 2) / count;
  const azimuthOffset = Math.random() * Math.PI * 2;

  const impactors = [];
  for (let index = 0; index < count; index += 1) {
    const azimuth = azimuthOffset + sector * index + (Math.random() - 0.5) * sector * 0.65;
    // Sizes follow the real size distribution: small ones are far commoner,
    // so a power skews the draw toward the faint end and the occasional
    // bigger one lands with visibly more energy.
    const mass = Math.pow(Math.random(), 1.9);
    const scale = 0.55 + mass * 1.15;

    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 0.020 * scale, 1),
      new THREE.MeshStandardMaterial({ color: 0x6b5a4c, roughness: 1, metalness: 0 }),
    );
    group.add(rock);

    // Entry heating: the object is already glowing long before it arrives.
    const bolide = makeGlow(0xffd8a0, 0);
    group.add(bolide);
    // The flash itself, at the point of entry.
    const flash = makeGlow(0xfff3d6, 0);
    group.add(flash);
    /*
     * The afterglow, and deliberately not a scar.
     *
     * An earlier pass left a dark bruise behind, on the reasoning that
     * Shoemaker-Levy 9 left scars visible for months. That was the wrong
     * precedent: SL9's fragments were kilometres across. An object of the size
     * this event is about -- metres -- deposits its energy high in the
     * atmosphere and leaves *nothing*. Every flash amateurs have recorded was
     * followed by imaging that found no debris field and no dark spot. The
     * flash is the whole event.
     */
    const afterglow = makeGlow(0xffb070, 0);
    group.add(afterglow);

    /*
     * Where it comes in, and from how far.
     *
     * Both numbers are set by what the frame can hold rather than by the
     * physics, and the physics does not mind. When a viewer is inspecting
     * Jupiter the visible half-height is about one planetary radius: an
     * approach starting nine radii out is off screen for its whole length, and
     * all that arrives is a flash with no cause. So each run-in starts just
     * outside the frame edge, on its own azimuth.
     *
     * What is lost is nothing an observer ever had. Nobody has seen one of
     * these objects before it arrived -- they are metres across and unlit, and
     * the first anyone knows is the flash.
     */
    const entry = new THREE.Vector3()
      .copy(facing).multiplyScalar(Math.cos(THREE.MathUtils.degToRad(24 + Math.random() * 40)))
      .addScaledVector(screenRight, Math.sin(THREE.MathUtils.degToRad(24 + Math.random() * 40)) * Math.cos(azimuth))
      .addScaledVector(screenUp, Math.sin(THREE.MathUtils.degToRad(24 + Math.random() * 40)) * Math.sin(azimuth))
      .normalize()
      .multiplyScalar(radius * 1.01);

    // Out along the entry normal, then thrown around its own azimuth so each
    // path visibly bends in from its own side of the frame.
    const start = entry.clone().normalize().multiplyScalar(radius * (2.1 + Math.random() * 0.7));
    start.addScaledVector(screenRight, Math.cos(azimuth) * radius * (1.3 + Math.random() * 0.8));
    start.addScaledVector(screenUp, Math.sin(azimuth) * radius * (1.3 + Math.random() * 0.8));

    impactors.push({
      rock, bolide, flash, afterglow, entry, start, scale,
      /*
       * Staggered arrivals across the middle of the event, so the swarm reads
       * as a sequence of separate strikes. Spread over a window rather than
       * evenly spaced, because these objects are not related to each other and
       * arriving on a beat would say that they were.
       */
      arriveAt: 0.34 + (index / count) * 0.40 + Math.random() * 0.09,
      // Each one gets its own bend, so no two paths are parallel.
      bend: (0.28 + Math.random() * 0.34) * (Math.random() < 0.5 ? -1 : 1),
      spin: 0.06 + Math.random() * 0.10,
    });
  }

  return {
    group,
    duration: 15,
    update(progress) {
      for (let index = 0; index < impactors.length; index += 1) {
        const item = impactors[index];
        const { arriveAt } = item;
        // Each impactor runs its own clock: it falls for the whole span up to
        // its own arrival, then flashes and fades on its own schedule.
        const approach = THREE.MathUtils.clamp(progress / arriveAt, 0, 1);
        // Gravity does not pull linearly. The last tenth of the fall is most
        // of the speed, so the eased curve is what makes it read as being
        // *pulled* rather than flown in.
        const fall = Math.pow(approach, 2.6);
        item.rock.position.lerpVectors(item.start, item.entry, fall);
        const arc = Math.sin(approach * Math.PI) * radius * item.bend;
        item.rock.position.addScaledVector(screenRight, arc * 0.7);
        item.rock.position.addScaledVector(screenUp, arc);
        item.rock.rotation.x += item.spin;
        item.rock.rotation.y += item.spin * 1.4;
        item.rock.visible = progress < arriveAt + 0.005;

        // Entry heating begins only in the last stretch, where the atmosphere is.
        const heating = smoothstep(arriveAt * 0.68, arriveAt, progress);
        item.bolide.position.copy(item.rock.position);
        item.bolide.material.opacity = heating * 0.9;
        item.bolide.scale.setScalar(radius * (0.05 + heating * 0.20) * item.scale);

        // One to two seconds in reality; a beat and a half here.
        const flare = progress < arriveAt
          ? 0
          : Math.max(0, 1 - (progress - arriveAt) / 0.11);
        item.flash.position.copy(item.entry);
        item.flash.material.opacity = Math.pow(flare, 0.7);
        item.flash.scale.setScalar(radius * (0.09 + flare * 1.35 * item.scale));

        // The tail of the flash: gone within a beat, leaving the planet
        // exactly as it was.
        const tailStart = arriveAt + 0.04;
        const tail = progress < tailStart
          ? 0
          : Math.max(0, 1 - (progress - tailStart) / 0.24);
        item.afterglow.position.copy(item.entry).multiplyScalar(1.004);
        item.afterglow.scale.setScalar(radius * (0.07 + tail * 0.24) * item.scale);
        item.afterglow.material.opacity = Math.pow(tail, 1.6) * 0.55;
      }
    },
    dispose() {
      impactors.forEach((item) => {
        item.rock.geometry.dispose();
        item.rock.material.dispose();
        item.bolide.material.dispose();
        item.flash.material.dispose();
        item.afterglow.material.dispose();
      });
      impactors.length = 0;
    },
  };
}

/**
 * Io throws a plume three hundred kilometres up.
 *
 * Io is the most volcanically active body in the Solar System -- around four
 * hundred active volcanoes, and enough sulphur and sulphur dioxide leaving the
 * surface to resurface the whole moon every few thousand years. The large
 * plumes at Pele and Tvashtar reach 300 to 500 km, high enough to be a visible
 * umbrella against the disc rather than anything subtle. Loki Patera, the
 * brightest, brightens on a roughly five-hundred-day cycle.
 *
 * The colour is the giveaway and it is real: these deposits are yellow, white
 * and red because they are sulphur allotropes, not rock dust.
 */
function createIoPlume(target, camera) {
  const group = new THREE.Group();
  group.name = "Io eruption event";
  const radius = target.userData?.visualRadius ?? 1;

  // A plume on the far limb is the best view of one -- it stands out against
  // black rather than against the disc -- so this sits near the edge of the
  // hemisphere facing us rather than dead centre.
  const facing = localCameraDirection(target, camera, new THREE.Vector3());
  const vent = facingPoint(facing, THREE.MathUtils.degToRad(72), new THREE.Vector3());

  // The umbrella. A plume on an airless moon is ballistic: every particle
  // follows its own arc and falls back, which is why it is a dome and not a
  // column. A cone standing on the vent is the honest silhouette of that.
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.62, radius * 0.78, 22, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd98a, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  group.add(plume);

  const hotspot = makeGlow(0xff9a4a, 0);
  group.add(hotspot);

  return {
    group,
    duration: 16,
    update(progress) {
      const rise = smoothstep(0, 0.28, progress);
      const settle = 1 - smoothstep(0.62, 1, progress);
      const strength = rise * settle;

      plume.position.copy(vent).multiplyScalar(radius * (1 + 0.39 * rise));
      plume.lookAt(scratchVector.copy(vent).multiplyScalar(-radius));
      plume.rotateX(Math.PI * 0.5);
      plume.scale.setScalar(0.35 + rise * 0.75);
      plume.material.opacity = strength * 0.5;

      hotspot.position.copy(vent).multiplyScalar(radius * 1.01);
      hotspot.scale.setScalar(radius * (0.18 + strength * 0.22));
      hotspot.material.opacity = strength * 0.85;
    },
    dispose() {
      plume.geometry.dispose(); plume.material.dispose();
      hotspot.material.dispose();
    },
  };
}

/**
 * Enceladus vents its ocean into Saturn's E ring.
 *
 * More than a hundred discrete jets erupt from four warm fractures across the
 * south pole -- the "tiger stripes" -- and Cassini flew through them and tasted
 * salt, silica and organic molecules, which is how a 500 km moon came to be one
 * of the better places to look for life. The material does not fall back: most
 * of it escapes, and it *is* Saturn's E ring, which is why that ring is there
 * at all and why it is centred on this moon's orbit.
 *
 * So the jets here all leave from the south pole, they fan, and they do not
 * come back down.
 */
function createEnceladusPlumes(target) {
  const group = new THREE.Group();
  group.name = "Enceladus plume event";
  const radius = target.userData?.visualRadius ?? 1;

  const JETS = 9;
  const positions = new Float32Array(JETS * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  const directions = [];
  for (let index = 0; index < JETS; index += 1) {
    // From the south pole, fanned: the stripes are parallel fissures, not a point.
    const tilt = THREE.MathUtils.degToRad(8 + Math.random() * 26);
    const around = (index / JETS) * Math.PI * 2 + Math.random() * 0.4;
    directions.push(new THREE.Vector3(
      Math.sin(tilt) * Math.cos(around),
      -Math.cos(tilt),
      Math.sin(tilt) * Math.sin(around),
    ));
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xcfeaff, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const jets = new THREE.LineSegments(geometry, material);
  group.add(jets);

  const base = makeGlow(0xdff1ff, 0);
  group.add(base);

  return {
    group,
    duration: 18,
    update(progress) {
      const on = smoothstep(0, 0.2, progress) * (1 - smoothstep(0.7, 1, progress));
      const attribute = jets.geometry.getAttribute("position");
      for (let index = 0; index < JETS; index += 1) {
        const direction = directions[index];
        // Each jet breathes on its own clock; they are not one valve.
        const length = radius * (1.1 + 1.5 * on
          * (0.6 + 0.4 * Math.sin(progress * 9 + index * 1.7)));
        attribute.setXYZ(index * 2, direction.x * radius, direction.y * radius, direction.z * radius);
        attribute.setXYZ(index * 2 + 1,
          direction.x * length, direction.y * length, direction.z * length);
      }
      attribute.needsUpdate = true;
      material.opacity = on * 0.75;

      base.position.set(0, -radius * 0.98, 0);
      base.scale.setScalar(radius * (0.5 + on * 0.5));
      base.material.opacity = on * 0.5;
    },
    dispose() { geometry.dispose(); material.dispose(); base.material.dispose(); },
  };
}

/**
 * Earth runs into a debris stream.
 *
 * The showers are the most reliably recurring events in the Solar System: Earth
 * crosses the same trails on the same dates every year, because the trails are
 * in fixed orbits and so is Earth. The Perseids in August are dust shed by
 * comet Swift-Tuttle; the Geminids in December are unusual in coming from an
 * asteroid, 3200 Phaethon, rather than a comet. At peak, a shower delivers of
 * order a hundred visible meteors an hour, and the particles are mostly the
 * size of a grain of sand.
 *
 * They all appear to radiate from one point, which is pure perspective -- the
 * particles are travelling on parallel paths, and the radiant is the vanishing
 * point. That is what is drawn here.
 */
function createMeteorShower(target) {
  const group = new THREE.Group();
  group.name = "Meteor shower event";
  const radius = target.userData?.visualRadius ?? 1;

  const COUNT = 34;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT * 2 * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xbfe6ff, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const streaks = new THREE.LineSegments(geometry, material);
  group.add(streaks);

  // One shared direction: the stream arrives on parallel paths.
  const stream = new THREE.Vector3(
    -0.5 + Math.random(), -0.35 - Math.random() * 0.4, -0.5 + Math.random(),
  ).normalize();
  const seeds = Array.from({ length: COUNT }, () => ({
    offset: new THREE.Vector3(
      (Math.random() - 0.5) * radius * 4.6,
      (Math.random() - 0.5) * radius * 4.6,
      (Math.random() - 0.5) * radius * 4.6,
    ),
    phase: Math.random(),
    speed: 0.7 + Math.random() * 0.9,
  }));

  return {
    group,
    duration: 17,
    update(progress) {
      const on = smoothstep(0, 0.14, progress) * (1 - smoothstep(0.76, 1, progress));
      const attribute = streaks.geometry.getAttribute("position");
      for (let index = 0; index < COUNT; index += 1) {
        const seed = seeds[index];
        // Each grain runs its own short life and restarts, so the sky keeps
        // producing them rather than showing one synchronised volley.
        const life = (seed.phase + progress * seed.speed * 5) % 1;
        const travel = radius * 5.5;
        const head = scratchVector.copy(stream).multiplyScalar(travel * (0.5 - life))
          .add(seed.offset);
        const tailLength = radius * (0.5 + 0.7 * Math.sin(life * Math.PI));
        attribute.setXYZ(index * 2, head.x, head.y, head.z);
        attribute.setXYZ(index * 2 + 1,
          head.x - stream.x * tailLength,
          head.y - stream.y * tailLength,
          head.z - stream.z * tailLength);
      }
      attribute.needsUpdate = true;
      material.opacity = on * 0.85;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}

/**
 * The Sun throws part of itself away.
 *
 * A coronal mass ejection lifts of order a billion tonnes of plasma out of the
 * corona at up to three thousand kilometres a second. At solar maximum they
 * happen several times a day; at minimum, about one every five days. The
 * fastest reach Earth in under a day, and it is these, not the light of a
 * flare, that drive the big geomagnetic storms and the aurorae.
 *
 * Drawn as an expanding bright shell off one limb, which is how they look in a
 * coronagraph -- lopsided, directional, and gone within the hour.
 */
function createSolarEjection(target, camera) {
  const group = new THREE.Group();
  group.name = "Coronal mass ejection event";
  const radius = target.userData?.visualRadius ?? 1;

  // Off a limb rather than towards or away from the camera: a CME aimed at the
  // viewer is a disc, and one aimed away is invisible. Across is how every
  // coronagraph image of one looks.
  const facing = localCameraDirection(target, camera, new THREE.Vector3());
  const direction = facingPoint(facing, THREE.MathUtils.degToRad(96), new THREE.Vector3());

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.38),
    new THREE.MeshBasicMaterial({
      color: 0xffb066, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  group.add(shell);

  const root = makeGlow(0xfff0c8, 0);
  group.add(root);

  return {
    group,
    duration: 15,
    update(progress) {
      const launch = smoothstep(0, 0.12, progress);
      const spread = Math.pow(progress, 0.75);
      const fade = 1 - smoothstep(0.55, 1, progress);

      shell.scale.setScalar(radius * (1.05 + spread * 3.4));
      shell.position.copy(direction).multiplyScalar(radius * spread * 1.1);
      shell.lookAt(scratchVector.copy(direction).multiplyScalar(-1));
      shell.rotateX(Math.PI * 0.5);
      shell.material.opacity = launch * fade * 0.30;

      root.position.copy(direction).multiplyScalar(radius * 1.04);
      root.scale.setScalar(radius * (0.5 + launch * 0.7));
      root.material.opacity = launch * fade * 0.7;
    },
    dispose() { shell.geometry.dispose(); shell.material.dispose(); root.material.dispose(); },
  };
}

/**
 * Mars disappears under its own dust.
 *
 * On average once every three Mars years -- about five and a half Earth years
 * -- a regional dust storm fails to die and instead grows until it wraps the
 * entire planet. The 2018 one ended Opportunity's mission. They start in the
 * southern hemisphere's summer, and the reason is orbital: Mars has a
 * noticeably eccentric orbit, so southern summer is also perihelion, the
 * planet is significantly hotter, and there is enough radiative forcing to
 * lift dust faster than it settles. Once airborne the dust absorbs sunlight,
 * heats the air around it, and drives the winds that lift more of it.
 *
 * The winds themselves are unimpressive by Earth standards -- around 60 mph --
 * and in an atmosphere one percent as dense as ours they could not knock a
 * person over. What they can do is keep a very great deal of extremely fine
 * dust in suspension for weeks to months.
 *
 * Staged as an ochre veil closing over the disc and then slowly clearing,
 * because that is exactly what the telescope images show: surface features
 * fading out over days until nothing is left but a featureless butterscotch
 * ball.
 */
function createMarsDustStorm(target) {
  const group = new THREE.Group();
  group.name = "Mars global dust storm";
  const radius = target.userData?.visualRadius ?? 1;

  /*
   * A shell just above the surface rather than a sprite in front of it. The
   * storm is *atmospheric*, so it has to wrap the limb and follow the
   * terminator; a flat billboard would sit in front of the night side too and
   * light up a hemisphere the Sun is not on.
   */
  const veil = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 28),
    new THREE.MeshStandardMaterial({
      color: 0xc98a4e,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  veil.scale.setScalar(radius * 1.022);
  group.add(veil);

  // A second, thinner shell a little higher: the high-altitude haze that
  // outlives the storm itself and gives the limb its soft edge.
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 22),
    new THREE.MeshBasicMaterial({
      color: 0xe0a96b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    }),
  );
  haze.scale.setScalar(radius * 1.055);
  group.add(haze);

  return {
    group,
    duration: 22,
    update(progress) {
      // Weeks to grow, months to clear: the rise is far steeper than the fall,
      // which is the shape of the real optical-depth curves.
      const grow = smoothstep(0.02, 0.34, progress);
      const clear = 1 - smoothstep(0.55, 1, progress);
      const strength = grow * clear;
      veil.material.opacity = strength * 0.92;
      haze.material.opacity = strength * 0.16;
      // The dust is in the atmosphere and the atmosphere is turning.
      veil.rotation.y += 0.0016;
      haze.rotation.y -= 0.0011;
    },
    dispose() {
      veil.geometry.dispose(); veil.material.dispose();
      haze.geometry.dispose(); haze.material.dispose();
    },
  };
}

/**
 * Saturn's Great White Spot.
 *
 * Once per Saturnian year -- once every thirty Earth years -- Saturn stops
 * being bland. A storm erupts in the northern hemisphere, spreads along its
 * own latitude at a few hundred kilometres an hour, and within months has
 * wrapped the entire planet in a bright band tens of thousands of kilometres
 * long. The 2010 outbreak that Cassini watched was the largest ever recorded:
 * it ran for months, and it changed the temperature and composition of
 * Saturn's atmosphere for more than three years afterwards.
 *
 * The mechanism is a slow charge and a fast discharge. Water vapour is heavy
 * enough that it sits far below the visible cloud deck and cannot convect
 * through the lighter dry air above it -- so heat accumulates underneath for
 * decades until the layer finally overturns, all at once, in the most violent
 * lightning storm in the Solar System.
 *
 * Staged as a bright head appearing at northern mid-latitude and drawing
 * itself out into a band that wraps the planet.
 */
function createSaturnWhiteSpot(target) {
  const group = new THREE.Group();
  group.name = "Saturn Great White Spot";
  const radius = target.userData?.visualRadius ?? 1;

  /*
   * The band, as a latitude ring: a torus sitting on the northern mid-latitude
   * circle. Growing the arc of that ring from nothing to the whole way round
   * is exactly what the storm does, and it stays glued to the right latitude
   * for free as the planet turns.
   */
  const bandLatitude = THREE.MathUtils.degToRad(37);
  const bandRadius = Math.cos(bandLatitude);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(radius * bandRadius * 1.005, radius * 0.055, 10, 128, 0.1),
    new THREE.MeshBasicMaterial({
      color: 0xfff1d8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = radius * Math.sin(bandLatitude);
  group.add(band);

  // The head of the storm: the convective plume that is doing the work, and
  // the brightest thing on the planet while it lasts.
  const head = makeGlow(0xffffff, 0);
  group.add(head);

  let arc = 0.1;

  return {
    group,
    duration: 24,
    update(progress) {
      const onset = smoothstep(0, 0.14, progress);
      const spread = smoothstep(0.05, 0.72, progress);
      const fade = 1 - smoothstep(0.78, 1, progress);

      // Rebuilding the torus geometry every frame to grow its arc would be
      // absurd; scaling the drawn range is what the geometry's own draw range
      // is for.
      const wanted = 0.1 + spread * (Math.PI * 2 - 0.1);
      if (Math.abs(wanted - arc) > 0.01) {
        arc = wanted;
        band.geometry.dispose();
        band.geometry = new THREE.TorusGeometry(
          radius * bandRadius * 1.005, radius * 0.055 * (0.6 + spread * 0.6), 10, 128, arc,
        );
      }
      band.material.opacity = onset * fade * 0.62;
      band.rotation.z += 0.004;

      // The head runs ahead of the band it is laying down.
      const headAngle = arc;
      head.position.set(
        Math.cos(headAngle + band.rotation.z) * radius * bandRadius * 1.01,
        radius * Math.sin(bandLatitude),
        Math.sin(headAngle + band.rotation.z) * radius * bandRadius * 1.01,
      );
      head.scale.setScalar(radius * (0.10 + onset * 0.16));
      head.material.opacity = onset * fade * 0.9;
    },
    dispose() {
      band.geometry.dispose(); band.material.dispose(); head.material.dispose();
    },
  };
}

/**
 * A comet dives into the Sun and does not come out.
 *
 * SOHO has discovered more than four thousand comets, which makes a solar
 * observatory the most prolific comet discoverer in history by an enormous
 * margin -- and about eighty-five per cent of them belong to one family. The
 * Kreutz sungrazers are all fragments of a single giant comet that broke up
 * on a previous pass, probably around the twelfth century, and they are still
 * arriving one at a time on the same orbit. SOHO finds one on average every
 * three days.
 *
 * Almost none survive. They pass within a couple of solar radii of the
 * photosphere, where the nucleus -- typically only tens of metres of ice --
 * is destroyed by heat and tidal stress within minutes. The tail keeps going
 * for a little while after the nucleus has gone, which is the eeriest part:
 * for a few frames there is a comet tail with nothing at the front of it.
 *
 * Staged as an inbound streak that brightens hard on approach, sheds its tail
 * and then ends.
 */
function createSungrazerComet(target, camera) {
  const group = new THREE.Group();
  group.name = "Sungrazing comet event";
  const radius = target.userData?.visualRadius ?? 1;

  const facing = localCameraDirection(target, camera, new THREE.Vector3());
  // The approach lies across the line of sight, so the plunge is seen side-on.
  const inbound = facingPoint(facing, THREE.MathUtils.degToRad(88), new THREE.Vector3());
  const start = inbound.clone().multiplyScalar(radius * 7.5);
  // Perihelion just above the photosphere: this is what "sungrazing" means.
  const perihelion = new THREE.Vector3().crossVectors(inbound, facing).normalize()
    .multiplyScalar(radius * 1.35);

  const nucleus = makeGlow(0xd8f0ff, 0);
  group.add(nucleus);

  /*
   * The tail, as a cone opening away from the Sun. A comet's tail does not
   * trail behind its motion -- it is pushed directly anti-sunward by radiation
   * pressure and the solar wind, so on the inbound leg it points *ahead* of
   * the comet. Getting that backwards is the commonest mistake in comet art.
   */
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.16, radius * 2.6, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x9fd4ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  group.add(tail);

  const path = new THREE.Vector3();

  return {
    group,
    duration: 13,
    update(progress) {
      // A quadratic Bezier through perihelion: a real sungrazer's path is a
      // near-parabola, and this is the cheapest honest approximation of one.
      const t = Math.pow(THREE.MathUtils.clamp(progress / 0.80, 0, 1), 1.35);
      const inv = 1 - t;
      path.set(0, 0, 0)
        .addScaledVector(start, inv * inv)
        .addScaledVector(perihelion, 2 * inv * t)
        .addScaledVector(perihelion, t * t * 0.4);

      // Brightness goes roughly as the inverse square of solar distance, and
      // then some: sublimation rises faster than illumination does.
      const reach = Math.max(radius * 1.1, path.length());
      const glare = Math.min(1, Math.pow(radius * 3.4 / reach, 2.1));
      // The end: the nucleus is gone before the tail is.
      const survives = 1 - smoothstep(0.74, 0.86, progress);

      nucleus.position.copy(path);
      nucleus.scale.setScalar(radius * (0.05 + glare * 0.11));
      nucleus.material.opacity = glare * survives;

      // Anti-sunward, always.
      const away = path.clone().normalize();
      tail.position.copy(path).addScaledVector(away, radius * 1.3);
      tail.lookAt(scratchVector.copy(path));
      tail.rotateX(Math.PI * 0.5);
      tail.scale.setScalar(0.5 + glare * 1.1);
      tail.material.opacity = glare * (1 - smoothstep(0.86, 1, progress)) * 0.34;
    },
    dispose() {
      nucleus.material.dispose(); tail.geometry.dispose(); tail.material.dispose();
    },
  };
}

/**
 * Something hits the Moon and you can see it from Earth.
 *
 * The Moon has no atmosphere, so a meteoroid that would burn up harmlessly
 * over Earth arrives at the lunar surface at its full speed -- tens of
 * kilometres a second -- and converts all of it to heat in an instant. The
 * result is a flash bright enough to record with a modest telescope from
 * Earth, on the night side, against black.
 *
 * The numbers come from NELIOTA, which watched the Moon for 283 hours between
 * 2017 and 2023 and validated 192 of them -- about **0.68 flashes per hour of
 * observation**. Over three-quarters of the impactors weighed between 1 and
 * 200 grams and were 0.5 to 3 cm across: gravel. Most flashes lasted under
 * 66 milliseconds, and 85% of the peaks were between 2,000 and 4,500 K, which
 * is why they photograph orange rather than white.
 *
 * The flash here is slowed enormously -- 66 ms is four frames -- but nothing
 * else is changed: it is a point on the unlit hemisphere, it is orange, and
 * it leaves nothing behind.
 */
function createLunarImpactFlash(target, camera) {
  const group = new THREE.Group();
  group.name = "Lunar impact flash event";
  const radius = target.userData?.visualRadius ?? 1;
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Three of them, because at 0.68 an hour with a 66-millisecond flash the odds
   * of ever catching one are what make this event worth staging at all, and
   * because the point is that the Moon is being sandblasted continuously
   * rather than struck once.
   */
  const flashes = [];
  for (let index = 0; index < 3; index += 1) {
    const site = facingPoint(facing, THREE.MathUtils.degToRad(66), new THREE.Vector3())
      .multiplyScalar(radius * 1.004);
    // 2,000-4,500 K: the cool end is orange, the hot end nearly white.
    const heat = Math.random();
    const flash = makeGlow(new THREE.Color().setRGB(1, 0.52 + heat * 0.34, 0.22 + heat * 0.42), 0);
    flash.position.copy(site);
    group.add(flash);
    flashes.push({
      flash,
      at: 0.14 + index * 0.28 + Math.random() * 0.08,
      // Under 66 ms in reality; the bigger impactors ring for longer.
      width: 0.05 + Math.random() * 0.05,
      size: 0.06 + Math.pow(Math.random(), 2) * 0.10,
    });
  }

  return {
    group,
    duration: 12,
    update(progress) {
      for (let index = 0; index < flashes.length; index += 1) {
        const item = flashes[index];
        const since = progress - item.at;
        // Instantaneous on, exponential off: the light curve of a hot spot
        // radiating into vacuum with nothing to sustain it.
        const level = since < 0 ? 0 : Math.exp(-since / item.width);
        item.flash.material.opacity = level;
        item.flash.scale.setScalar(radius * item.size * (0.5 + level * 1.4));
      }
    },
    dispose() { flashes.forEach((item) => item.flash.material.dispose()); },
  };
}

/**
 * Triton's nitrogen geysers.
 *
 * Voyager 2 passed Neptune in 1989 and found the biggest surprise of the whole
 * flyby on its largest moon: dark plumes rising nearly eight kilometres off
 * the surface and then bending over and streaming 150 kilometres downwind, on
 * the coldest surface ever measured -- 38 K, thirty-eight degrees above
 * absolute zero.
 *
 * The mechanism is a solid-state greenhouse. Triton's south polar cap is
 * transparent nitrogen ice; sunlight passes through it and warms the darker
 * material a metre or two underneath. The nitrogen there sublimates, pressure
 * builds under the ice cap, and eventually it breaks through and vents --
 * carrying dark dust up with it, which is why the plumes are visible at all.
 * They can run for a year at a time.
 *
 * The horizontal streak is the signature and it is worth drawing: the plume
 * goes up until it reaches Triton's thin atmosphere's shear level, and then
 * the wind takes it sideways for a hundred and fifty kilometres.
 */
function createTritonGeysers(target, camera) {
  const group = new THREE.Group();
  group.name = "Triton geyser event";
  const radius = target.userData?.visualRadius ?? 1;
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  const columns = [];
  // A shared downwind direction: they all feel the same wind, so the streaks
  // must be parallel. Independently-oriented plumes would look like a bug.
  const wind = new THREE.Vector3();

  for (let index = 0; index < 4; index += 1) {
    const vent = facingPoint(facing, THREE.MathUtils.degToRad(52), new THREE.Vector3());
    if (index === 0) {
      // Any tangent at the first vent will do; the rest inherit it.
      const helper = Math.abs(vent.y) > 0.9
        ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      wind.crossVectors(vent, helper).normalize();
    }
    // 8 km up against a 1,353 km radius is 0.6% -- far too small to see, so
    // the column is exaggerated to about a twentieth of the moon. Everything
    // about its *shape* is kept: short vertical, long horizontal.
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.010, radius * 0.020, radius * 0.13, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8fa6c4, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    group.add(column);

    // The downwind streak: 150 km against 8 km up, so nearly twenty times as
    // long as the column is tall. That ratio is the whole point.
    const streak = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.006, radius * 0.022, radius * 0.34, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x6e7f99, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    group.add(streak);

    columns.push({ vent, column, streak, phase: index * 0.17 });
  }

  const tip = new THREE.Vector3();

  return {
    group,
    duration: 18,
    update(progress) {
      for (let index = 0; index < columns.length; index += 1) {
        const item = columns[index];
        const local = THREE.MathUtils.clamp(progress - item.phase, 0, 1);
        const rise = smoothstep(0, 0.30, local);
        const fade = 1 - smoothstep(0.66, 1, progress);
        const strength = rise * fade;

        item.column.position.copy(item.vent).multiplyScalar(radius * (1 + 0.065 * rise));
        item.column.lookAt(scratchVector.copy(item.vent).multiplyScalar(-radius));
        item.column.rotateX(Math.PI * 0.5);
        item.column.scale.set(1, rise, 1);
        item.column.material.opacity = strength * 0.55;

        // The streak begins where the column tops out and runs downwind.
        tip.copy(item.vent).multiplyScalar(radius * (1 + 0.13 * rise));
        item.streak.position.copy(tip).addScaledVector(wind, radius * 0.17 * rise);
        item.streak.lookAt(scratchVector.copy(tip).addScaledVector(wind, -radius));
        item.streak.rotateX(Math.PI * 0.5);
        item.streak.scale.set(1, rise, 1);
        item.streak.material.opacity = strength * 0.34;
      }
    },
    dispose() {
      columns.forEach((item) => {
        item.column.geometry.dispose(); item.column.material.dispose();
        item.streak.geometry.dispose(); item.streak.material.dispose();
      });
    },
  };
}

/**
 * Spokes appear across Saturn's B ring.
 *
 * Voyager found them in 1980, Cassini watched them for years, and Hubble is
 * tracking them now -- radial smears reaching across the B ring, thousands of
 * kilometres long, that form in minutes and are gone in a few hours. They are
 * radial, which is the strange part: everything in a ring orbits at its own
 * speed, so a radial feature should shear itself into a spiral almost
 * immediately, and these do not.
 *
 * The explanation is electrostatic. Dust-sized icy grains pick up charge and
 * levitate above the ring plane, where they are no longer on Keplerian orbits
 * but partly controlled by Saturn's magnetic field, which rotates rigidly with
 * the planet. That is what lets a radial feature hold together.
 *
 * They are seasonal. Spokes appear around Saturn's equinoxes, when the Sun is
 * nearly in the ring plane -- so twice per 29.4-year orbit, roughly every
 * fifteen Earth years, in a season that lasts a few years. Saturn's northern
 * autumnal equinox falls on 6 May 2025, so this is spoke season now.
 */
function createRingSpokes(target) {
  const group = new THREE.Group();
  group.name = "Saturn ring spoke event";
  const radius = target.userData?.visualRadius ?? 1;

  /*
   * Drawn in the ring plane and parented to the planet, so they inherit the
   * ring's tilt for free. The B ring runs from about 1.53 to 1.95 Saturn radii,
   * which is where these sit.
   */
  const spokes = [];
  const count = 7;
  for (let index = 0; index < count; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 0.42, radius * 0.10),
      new THREE.MeshBasicMaterial({
        color: 0xd8e4f2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    spoke.rotation.x = -Math.PI / 2;
    group.add(spoke);
    spokes.push({
      spoke,
      angle: (index / count) * Math.PI * 2 + Math.random() * 0.4,
      // 1.53 to 1.95 Saturn radii: the B ring.
      reach: 1.53 + Math.random() * 0.34,
      // Minutes to form, hours to shear away -- so each has its own life.
      at: Math.random() * 0.45,
      width: 0.22 + Math.random() * 0.24,
    });
  }

  return {
    group,
    duration: 20,
    update(progress) {
      for (let index = 0; index < spokes.length; index += 1) {
        const item = spokes[index];
        const since = progress - item.at;
        // Fast on, slow off: forms in minutes, shears out over hours.
        const level = since < 0
          ? 0
          : smoothstep(0, 0.06, since) * (1 - smoothstep(item.width * 0.4, item.width, since));
        /*
         * They rotate with the magnetic field, not with the ring. Saturn's
         * field rotates in about 10.6 hours while B-ring particles take about
         * 8 -- so the spokes drift slowly *backwards* relative to the material
         * they are made of, which is the observation that made the
         * electrostatic explanation necessary.
         */
        const angle = item.angle + progress * 0.9;
        item.spoke.position.set(
          Math.cos(angle) * radius * item.reach,
          0,
          Math.sin(angle) * radius * item.reach,
        );
        item.spoke.rotation.z = -angle;
        item.spoke.material.opacity = level * 0.42;
      }
    },
    dispose() {
      spokes.forEach((item) => { item.spoke.geometry.dispose(); item.spoke.material.dispose(); });
    },
  };
}

/**
 * The Moon's shadow crosses the Earth.
 *
 * There are between two and five solar eclipses a year, and the reason there
 * are not two every month is that the Moon's orbit is tilted about five
 * degrees to Earth's -- so at most new moons the shadow misses, passing above
 * or below. Only when a new moon happens near a node does the shadow land.
 *
 * When it does, the umbra is tiny: at most about 270 km wide, and it crosses
 * the surface at over 1,700 km/h, which is why totality at any one place lasts
 * only a few minutes and why the same spot waits an average of 375 years for
 * the next one. The much larger penumbra around it is the partial eclipse, and
 * covers a good fraction of a hemisphere.
 *
 * This is the one event in the roster with no light of its own -- it is a
 * shadow, so it is drawn by taking light away.
 */
function createSolarEclipse(target, camera) {
  const group = new THREE.Group();
  group.name = "Solar eclipse event";
  const radius = target.userData?.visualRadius ?? 1;
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Normal blending with a dark colour, not additive: this subtracts. Every
   * other event in this file adds light, and using additive here would make
   * the shadow glow, which took one look to notice and is worth a line of
   * comment so it is never "tidied" into consistency with the others.
   */
  const penumbra = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.46, 40),
    new THREE.MeshBasicMaterial({
      color: 0x0a0d16, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(penumbra);

  const umbra = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.075, 26),
    new THREE.MeshBasicMaterial({
      color: 0x04060c, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(umbra);

  // The track: shadows sweep roughly west to east across the facing
  // hemisphere, entering at one limb and leaving at the other.
  const entry = facingPoint(facing, THREE.MathUtils.degToRad(74), new THREE.Vector3());
  const exit = facingPoint(facing, THREE.MathUtils.degToRad(74), new THREE.Vector3());
  const track = new THREE.Vector3();

  return {
    group,
    duration: 16,
    update(progress) {
      const run = smoothstep(0.06, 0.94, progress);
      // Great-circle interpolation, so the shadow stays on the surface rather
      // than cutting through the planet as a straight lerp would.
      track.copy(entry).lerp(exit, run).normalize();
      const arrival = smoothstep(0, 0.12, progress) * (1 - smoothstep(0.88, 1, progress));

      penumbra.position.copy(track).multiplyScalar(radius * 1.006);
      penumbra.lookAt(scratchVector.copy(track).multiplyScalar(radius * 4));
      penumbra.material.opacity = arrival * 0.55;

      umbra.position.copy(track).multiplyScalar(radius * 1.010);
      umbra.lookAt(scratchVector.copy(track).multiplyScalar(radius * 4));
      umbra.material.opacity = arrival * 0.92;
    },
    dispose() {
      penumbra.geometry.dispose(); penumbra.material.dispose();
      umbra.geometry.dispose(); umbra.material.dispose();
    },
  };
}

/**
 * Mercury grows a tail.
 *
 * Mercury has no atmosphere to speak of, but it does have an exosphere -- a
 * cloud of atoms so thin they never collide with each other -- and the solar
 * wind and a steady rain of micrometeorites knock fresh sodium off the surface
 * to keep replenishing it. Sodium is very good at absorbing sunlight at 589 nm,
 * which means radiation pressure pushes hard on it, and the result is a tail
 * of sodium atoms streaming anti-sunward for around **24 million kilometres**.
 * Mercury is, functionally, a rocky comet.
 *
 * The brightness is not constant round the orbit and the reason is elegant:
 * the tail peaks about **16 days either side of perihelion**, because
 * Mercury's orbital velocity Doppler-shifts the sodium absorption line off the
 * dark bottom of the solar spectrum's own sodium line and into the bright
 * continuum beside it, so the atoms suddenly have far more light to absorb and
 * far more push to feel. An 88-day orbit means this happens several times a
 * year.
 *
 * It is nearly invisible to the eye -- you need a filter tuned to 589 nm -- so
 * this is drawn at the intensity a sodium filter records rather than what an
 * unaided observer would see, which is nothing at all.
 */
function createMercurySodiumTail(target, camera) {
  const group = new THREE.Group();
  group.name = "Mercury sodium tail event";
  const radius = target.userData?.visualRadius ?? 1;

  /*
   * Anti-sunward, and worked out from the actual geometry rather than assumed.
   * The Sun is at the origin of the scene, so the direction away from it is
   * simply the body's own world position -- converted into the body's local
   * frame, because everything here is parented to the body.
   */
  const antiSunward = new THREE.Vector3();
  target.getWorldPosition(antiSunward);
  if (antiSunward.lengthSq() < 1e-8) antiSunward.set(1, 0, 0);
  antiSunward.normalize();
  // Into the body's frame, ignoring translation: this is a direction.
  const away = antiSunward.clone().applyQuaternion(
    target.getWorldQuaternion(new THREE.Quaternion()).invert(),
  ).normalize();

  /*
   * A long shallow cone. The real tail is 24 million km against Mercury's
   * 2,440 km radius -- a ratio of ten thousand to one, which at this scale
   * would run clean out of the Solar System. Compressed hard; what is kept is
   * that it is very long relative to the planet, very narrow at the root, and
   * opens slowly.
   */
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.5, radius * 14, 20, 1, true),
    new THREE.MeshBasicMaterial({
      // Sodium D lines: 589 nm, the colour of a street lamp.
      color: 0xffc65c,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(tail);

  // The exosphere itself, hugging the planet: this is where the tail is fed.
  const halo = makeGlow(0xffd98a, 0);
  group.add(halo);

  return {
    group,
    duration: 20,
    update(progress) {
      /*
       * The 16-days-either-side-of-perihelion double peak, in one pass: the
       * tail brightens, dips slightly through perihelion itself, brightens
       * again, then fades. That dip is the real behaviour and it is the whole
       * reason the timing is interesting.
       */
      const envelope = Math.sin(Math.min(1, progress / 0.92) * Math.PI);
      const doublePeak = 1 - 0.34 * Math.exp(-Math.pow((progress - 0.46) / 0.10, 2));
      const strength = Math.pow(envelope, 0.7) * doublePeak;

      // The cone's own axis is +Y, so it is aimed by looking down the tail.
      tail.position.copy(away).multiplyScalar(radius * 7.4);
      tail.lookAt(scratchVector.copy(away).multiplyScalar(-radius));
      tail.rotateX(Math.PI * 0.5);
      tail.scale.set(1, 0.6 + strength * 0.55, 1);
      tail.material.opacity = strength * 0.24;

      halo.position.set(0, 0, 0);
      halo.scale.setScalar(radius * (2.0 + strength * 1.0));
      halo.material.opacity = strength * 0.42;
    },
    dispose() {
      tail.geometry.dispose(); tail.material.dispose(); halo.material.dispose();
    },
  };
}

/**
 * Uranus stops being featureless.
 *
 * Voyager 2 flew past in 1986 and photographed a pale blue-green ball with
 * almost nothing on it, and that picture stuck. It was a bad time to visit: the
 * south pole was pointed at the Sun, and Uranus is tipped 98 degrees, so one
 * hemisphere had been in continuous daylight for decades and the atmosphere
 * had nothing to drive it.
 *
 * Since the 2007 equinox, when sunlight returned to both hemispheres, it has
 * been a different planet. In August 2014 Keck picked out **eight large storms
 * in one night** in the northern hemisphere, and the brightest was caught by
 * amateurs with backyard telescopes -- on a planet 2.9 billion kilometres away
 * that had been considered featureless. The bright spots are condensations of
 * methane ice, and at least one appears to be the top of a tall vortex
 * anchored deep in the atmosphere, in the way Jupiter's Great Red Spot is.
 *
 * Uranus takes 84 years to go round, so a season lasts 21. The activity that
 * started after 2007 is a seasonal thing, not a one-off.
 */
function createUranusStorms(target, camera) {
  const group = new THREE.Group();
  group.name = "Uranus storm event";
  const radius = target.userData?.visualRadius ?? 1;
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Eight, because that is how many were counted on the night this is of.
   * Northern hemisphere, at mid-latitudes, which is where they were.
   */
  const spots = [];
  for (let index = 0; index < 8; index += 1) {
    const site = facingPoint(facing, THREE.MathUtils.degToRad(64), new THREE.Vector3());
    const spot = makeGlow(0xf2fbff, 0);
    spot.position.copy(site).multiplyScalar(radius * 1.008);
    group.add(spot);
    spots.push({
      spot,
      // Methane-ice cloud tops brighten and dissipate on their own schedules.
      at: Math.random() * 0.42,
      life: 0.30 + Math.random() * 0.34,
      size: 0.10 + Math.pow(Math.random(), 1.6) * 0.20,
    });
  }

  return {
    group,
    duration: 19,
    update(progress) {
      for (let index = 0; index < spots.length; index += 1) {
        const item = spots[index];
        const since = progress - item.at;
        const level = since < 0
          ? 0
          : smoothstep(0, 0.16, since / item.life) * (1 - smoothstep(0.55, 1, since / item.life));
        item.spot.scale.setScalar(radius * item.size * (0.6 + level * 0.8));
        item.spot.material.opacity = level * 0.80;
      }
      // The whole system turns with the planet: Uranus's day is 17.2 hours.
      group.rotation.y += 0.0022;
    },
    dispose() { spots.forEach((item) => item.spot.material.dispose()); },
  };
}

/* ------------------------------------------------------ events in the sky */

/*
 * The two events below do not happen on a body.
 *
 * Everything else in this file is staged on a planet or a moon: the builder is
 * handed a target, works in that target's local frame, and is parented to it.
 * A supernova has no such target -- it happens thousands of light-years away,
 * against the sky, and the whole point of watching one from here is that it is
 * *out there* rather than on anything.
 *
 * So these are given a sky anchor instead: a group that rides with the camera
 * at the deep-sky shell radius, exactly like the star field does. They receive
 * the same (target, camera) signature as every other builder, and use the
 * target only for its scale.
 */

/**
 * A star explodes, and the dust around it lights up.
 *
 * The Milky Way makes about **two supernovae a century**, and the last one
 * anybody on Earth saw with the naked eye was probably Flamsteed's in 1680 --
 * so a person is unlikely to get one in a lifetime, and the Solar System has
 * seen maybe twenty since it formed. What makes them worth staging anyway is
 * the second half of what happens, which is usually left out: the star is the
 * flash, but the *nebula it was sitting in* is what you actually see for the
 * next several months, because the light has to travel out through the gas
 * before it can reach you.
 *
 * The light curve is a real Type II-P: a fast rise over about ten days, then a
 * **hundred-day plateau** while the hydrogen recombination front eats inward
 * through the expanding envelope at exactly the rate that keeps the luminosity
 * flat, then a collapse onto the cobalt-56 decay tail that takes a year or
 * more to fade. Compressed here, but the shape is the measured one -- and the
 * shape is the thing the viewer asked for: it does not flash and vanish.
 */
function createSupernova(target, camera, context = {}) {
  const group = new THREE.Group();
  group.name = "Supernova event";
  const scale = context.skyRadius ?? 3000;

  /*
   * Placed in front of the camera rather than anywhere on the sky.
   *
   * Staging it at a random point on the shell means it is behind the viewer
   * half the time, and a supernova nobody was facing is a highlight on an
   * empty frame. It is put a little off centre so it does not sit exactly
   * under the crosshair, which reads as a UI element rather than as a star.
   */
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  const helper = Math.abs(ahead.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(ahead, helper).normalize();
  const up = new THREE.Vector3().crossVectors(ahead, right).normalize();
  const offAxis = THREE.MathUtils.degToRad(9 + Math.random() * 11);
  const around = Math.random() * Math.PI * 2;
  const site = ahead.clone()
    .addScaledVector(right, Math.tan(offAxis) * Math.cos(around))
    .addScaledVector(up, Math.tan(offAxis) * Math.sin(around))
    .normalize()
    .multiplyScalar(scale * 0.94);

  // The star itself: a point that gets very bright and stays bright.
  const star = makeGlow(0xdbe6ff, 0);
  star.position.copy(site);
  group.add(star);

  // The halo: the light of the star reaching us through the gas around it.
  const halo = makeGlow(0xffd9a8, 0);
  halo.position.copy(site);
  group.add(halo);

  /*
   * The expanding shell.
   *
   * Real ejecta leave at around 10,000 km/s, which sounds enormous and is
   * still slow enough that a remnant takes centuries to become a visible ring
   * -- Cassiopeia A is 340 years old and ten light-years across. What is drawn
   * here is the light echo rather than the material: a bright front expanding
   * outward through the surrounding dust at the speed of light, which is what
   * is actually visible in the months after.
   */
  const echo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffc98a,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  echo.position.copy(site);
  group.add(echo);

  const tint = new THREE.Color();
  const hot = new THREE.Color(0.82, 0.88, 1.0);
  const cool = new THREE.Color(1.0, 0.52, 0.28);

  return {
    group,
    duration: 26,
    sky: true,
    update(progress, api) {
      // Type II-P, in days, at about 26 days per second of screen time.
      const days = progress * 680;
      let shape;
      if (days < 10) {
        const t = days / 10;
        shape = t * t * (3 - 2 * t);
      } else if (days < 110) {
        // The plateau. Not perfectly flat: real ones sag a few tenths.
        shape = 1 - 0.14 * ((days - 110 + 100) / 100);
      } else if (days < 136) {
        const t = (days - 110) / 26;
        shape = 0.86 + (0.16 - 0.86) * (t * t * (3 - 2 * t));
      } else {
        // Cobalt-56: 77.2-day half-life, so an e-folding every 111.4 days.
        shape = 0.16 * Math.exp(-(days - 136) / 111.4);
      }
      shape = Math.max(0, shape);

      // Ejecta cool as they expand, so it peaks blue-white and ends red.
      tint.copy(hot).lerp(cool, Math.pow(1 - Math.min(1, shape), 1.5));
      star.material.color.copy(tint);
      star.material.opacity = Math.min(1, shape * 1.4);
      star.scale.setScalar(scale * (0.004 + Math.pow(shape, 0.55) * 0.020));

      halo.material.color.copy(tint);
      halo.material.opacity = shape * 0.5;
      halo.scale.setScalar(scale * (0.02 + Math.pow(shape, 0.4) * 0.085));

      // The echo keeps expanding even as the star fades, because the light
      // that left at peak is still on its way out through the cloud.
      const spread = Math.pow(progress, 0.62);
      echo.scale.setScalar(scale * (0.01 + spread * 0.30));
      echo.material.opacity = shape * (1 - spread) * 0.18;

      // And the sky itself comes on. This is the part that makes it read as an
      // explosion inside something rather than a dot in front of it.
      api?.setSkyHighlight?.(Math.min(1, shape * 1.15));
    },
    dispose(api) {
      api?.setSkyHighlight?.(0);
      star.material.dispose();
      halo.material.dispose();
      echo.geometry.dispose();
      echo.material.dispose();
    },
  };
}

/**
 * Two neutron stars merge, and the universe makes gold.
 *
 * On 17 August 2017 the gravitational-wave detectors and the gamma-ray
 * satellites saw the same event within two seconds of each other, and within
 * eleven hours seventy observatories had found it in visible light in a galaxy
 * 130 million light-years away. It is the most consequential single
 * observation in modern astronomy, and it settled a long-standing question:
 * where the heavy elements come from.
 *
 * The answer is here. Neutron-star mergers throw off a few per cent of a solar
 * mass of neutron-rich debris, and that debris runs the r-process -- rapid
 * neutron capture -- building elements past iron in about a second. GW170817
 * is estimated to have produced **several Earth-masses of gold and platinum**.
 * Most of the gold in the world was made this way.
 *
 * The light curve is nothing like a supernova's and that is the giveaway that
 * identified it: a **kilonova** rises in hours, not weeks, and fades in days
 * rather than months -- and it goes from blue to deep red extremely fast as
 * the freshly-made heavy elements make the ejecta opaque.
 */
function createKilonova(target, camera, context = {}) {
  const group = new THREE.Group();
  group.name = "Kilonova event";
  const scale = context.skyRadius ?? 3000;

  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  const helper = Math.abs(ahead.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(ahead, helper).normalize();
  const up = new THREE.Vector3().crossVectors(ahead, right).normalize();
  const offAxis = THREE.MathUtils.degToRad(7 + Math.random() * 10);
  const around = Math.random() * Math.PI * 2;
  const site = ahead.clone()
    .addScaledVector(right, Math.tan(offAxis) * Math.cos(around))
    .addScaledVector(up, Math.tan(offAxis) * Math.sin(around))
    .normalize()
    .multiplyScalar(scale * 0.94);

  const core = makeGlow(0xeaf2ff, 0);
  core.position.copy(site);
  group.add(core);

  const ejecta = makeGlow(0xff7a3c, 0);
  ejecta.position.copy(site);
  group.add(ejecta);

  /*
   * The jet. GW170817's gamma-ray burst was seen off-axis, which is why it was
   * faint in gamma rays and why the geometry mattered so much: a merger throws
   * a narrow relativistic jet along its rotation axis, and whether you see a
   * short gamma-ray burst depends entirely on whether you are in it.
   */
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(scale * 0.012, scale * 0.16, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xa8d4ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  const jetAxis = up.clone().addScaledVector(right, 0.4).normalize();
  group.add(jet);

  const tint = new THREE.Color();
  const blue = new THREE.Color(0.86, 0.93, 1.0);
  const red = new THREE.Color(1.0, 0.34, 0.16);

  return {
    group,
    duration: 20,
    sky: true,
    update(progress, api) {
      // Hours to rise, days to fade -- a hundredth of a supernova's timescale.
      const rise = smoothstep(0, 0.055, progress);
      const fall = Math.exp(-Math.max(0, progress - 0.055) / 0.22);
      const shape = rise * fall;

      /*
       * Blue to red, and fast. The r-process builds lanthanides within
       * seconds, and lanthanides are enormously opaque in the blue -- so the
       * ejecta go from blue-white to deep infrared-red in about a day. That
       * colour change is what identified GW170817's counterpart as a kilonova
       * rather than anything else.
       */
      tint.copy(blue).lerp(red, Math.min(1, progress * 4.2));
      core.material.color.copy(tint);
      core.material.opacity = Math.min(1, shape * 1.5);
      core.scale.setScalar(scale * (0.004 + Math.pow(shape, 0.5) * 0.016));

      ejecta.material.opacity = shape * 0.55;
      ejecta.scale.setScalar(scale * (0.014 + Math.pow(progress, 0.5) * 0.075));

      // The jet is brief and early: it is the gamma-ray burst.
      const jetLevel = Math.max(0, 1 - progress / 0.16) * rise;
      jet.position.copy(site).addScaledVector(jetAxis, scale * 0.085 * jetLevel);
      jet.lookAt(scratchVector.copy(site).addScaledVector(jetAxis, -scale));
      jet.rotateX(Math.PI * 0.5);
      jet.scale.set(1, 0.4 + jetLevel, 1);
      jet.material.opacity = jetLevel * 0.5;

      api?.setSkyHighlight?.(Math.min(1, shape * 0.95));
    },
    dispose(api) {
      api?.setSkyHighlight?.(0);
      core.material.dispose();
      ejecta.material.dispose();
      jet.geometry.dispose();
      jet.material.dispose();
    },
  };
}

/* ------------------------------------------------------------- the roster */

/*
 * Every entry carries the four things the dashboard needs to explain it, and
 * they are separate fields rather than one blob of prose because the panel
 * lays them out differently:
 *
 *   detail     what you are about to watch happen
 *   frequency  how often it really happens, with the measurement it comes from
 *   cause      why it happens -- the mechanism, in one or two sentences
 *   note       the fact worth carrying away
 *
 * `frequency` is the field that most repays being exact. "Often" tells a
 * reader nothing; "roughly 0.68 flashes per hour of observation, from 192
 * validated detections over 283 hours" tells them both the rate and how
 * confident to be about it.
 */
const EVENTS = [
  {
    id: "jupiter-impact",
    body: "Jupiter",
    title: "Impact swarm",
    detail: "Several metre-scale asteroids fall in from different directions and detonate in Jupiter's upper atmosphere",
    frequency: "Objects this size strike Jupiter tens of times a year; Earth-based amateurs catch one or two of the flashes",
    cause: "318 Earth masses of gravity sitting at the inner edge of the asteroid belt. Jupiter bends in main-belt strays kicked out by the 3:1 Kirkwood resonance, Jupiter-family comets, and Centaurs falling from beyond Saturn — so the arrivals come from every direction at once.",
    note: "There is no crater. A metre-scale body deposits its energy high in the atmosphere and leaves nothing behind — the flash is the whole event.",
    build: createImpactSwarm,
  },
  {
    id: "saturn-impact",
    body: "Saturn",
    title: "Impact swarm",
    detail: "Saturn accretes its own share of the same debris, arriving on unrelated trajectories",
    frequency: "Perhaps a fifth of Jupiter's rate — Saturn is further out and less massive, so its gravitational reach is smaller",
    cause: "The same accretion Jupiter does, and for the same reason. Saturn sweeps up Centaurs on their way in from the Kuiper Belt; several are on orbits that cross its own.",
    note: "Cassini found ring ripples that date a debris impact on the rings to 1983 — nobody was watching at the time.",
    build: createImpactSwarm,
  },
  {
    id: "io-eruption",
    body: "Io",
    title: "Volcanic plume",
    detail: "Sulphur thrown 300 km above the most volcanic world in the Solar System",
    frequency: "Continuous. Io has around 400 active volcanoes and something is erupting at every moment; Loki Patera brightens on a roughly 500-day cycle",
    cause: "Tidal heating. Io is locked in a 4:2:1 resonance with Europa and Ganymede that keeps its orbit eccentric, so Jupiter's tides knead it constantly — enough to melt its interior.",
    note: "Enough material leaves the surface to resurface the entire moon every few thousand years. The yellows and reds are sulphur allotropes, not rock.",
    build: createIoPlume,
  },
  {
    id: "enceladus-plumes",
    body: "Enceladus",
    title: "Ocean venting to space",
    detail: "Over a hundred jets of salty water ice leaving the south pole",
    frequency: "Continuous, and modulated by the orbit — the jets are measurably stronger at apoapsis, when tidal stress pulls the fractures open",
    cause: "A global subsurface ocean under an ice shell, kept liquid by tidal flexing from Saturn, venting through four fractures across the south pole that Cassini named the tiger stripes.",
    note: "Cassini flew through the plume and tasted it: salt, silica, and organic molecules. This escaping material is what Saturn's E ring is made of.",
    build: createEnceladusPlumes,
  },
  {
    id: "meteor-shower",
    body: "Earth",
    title: "Meteor shower",
    detail: "Earth crosses a comet's debris trail, as it does on the same dates each year",
    frequency: "About a dozen major showers a year on fixed dates — the Perseids peak 12–13 August, the Geminids 13–14 December",
    cause: "Earth's orbit intersects streams of debris shed by comets on earlier passes. The dates are fixed because the streams are: the crossing point is a place in Earth's orbit, so it comes round once a year.",
    note: "The Perseids come from comet Swift–Tuttle; the Geminids from asteroid 3200 Phaethon, which is probably a burnt-out comet.",
    build: createMeteorShower,
  },
  {
    id: "solar-cme",
    body: "Sun",
    title: "Coronal mass ejection",
    detail: "A billion tonnes of plasma leaving the corona at up to 3,000 km/s",
    frequency: "Several a day at solar maximum, about one every five days at minimum — an eleven-year cycle",
    cause: "Magnetic reconnection. The Sun's field gets wound up by differential rotation until a loop snaps and reconnects, releasing the stored energy and flinging the plasma it was containing.",
    note: "The fastest reach Earth in under a day. It is these, not the light of a flare, that drive the big geomagnetic storms and the aurorae.",
    build: createSolarEjection,
  },
  {
    id: "sungrazer",
    body: "Sun",
    title: "Sungrazing comet",
    detail: "A comet dives to within a couple of solar radii and does not come out",
    frequency: "SOHO finds a Kreutz sungrazer on average every three days, and has discovered over 4,000 comets in total — about 85% of them from that one family",
    cause: "The Kreutz group are all fragments of a single giant comet that broke up on an earlier pass, probably in the twelfth century. They are still arriving one at a time on the same orbit.",
    note: "Almost none survive. The nucleus — often only tens of metres of ice — is destroyed by heat and tidal stress within minutes, and for a few frames the tail outlives it.",
    build: createSungrazerComet,
  },
  {
    id: "mars-dust-storm",
    body: "Mars",
    title: "Global dust storm",
    detail: "A regional storm fails to die and instead wraps the entire planet",
    frequency: "Once every three Mars years on average — about 5½ Earth years",
    cause: "Mars's orbit is eccentric, so southern summer coincides with perihelion. The planet gets hot enough for the radiative forcing to lift dust faster than it settles; the airborne dust then absorbs sunlight, heats the air, and drives the winds that lift more.",
    note: "The winds top out around 60 mph, and in an atmosphere 1% as dense as ours they could not knock you over. The 2018 storm ended Opportunity's mission all the same.",
    build: createMarsDustStorm,
  },
  {
    id: "saturn-white-spot",
    body: "Saturn",
    title: "Great White Spot",
    detail: "A storm erupts and spreads along its latitude until it wraps the planet",
    frequency: "Roughly once per Saturnian year — once every 30 Earth years. The last was 2010",
    cause: "Water vapour is heavy enough to sit far below the visible cloud deck and cannot convect through the lighter dry air above it. Heat accumulates underneath for decades until the layer finally overturns all at once.",
    note: "The 2010 outbreak Cassini watched was the largest ever recorded — it ran for months and altered Saturn's atmospheric temperature and composition for over three years.",
    build: createSaturnWhiteSpot,
  },
  {
    id: "ring-spokes",
    body: "Saturn",
    title: "Ring spokes",
    detail: "Radial smears thousands of kilometres long form across the B ring and shear away",
    frequency: "Seasonal — around Saturn's equinoxes, so twice per 29.4-year orbit, roughly every 15 years. Northern autumn equinox fell on 6 May 2025, so this is spoke season",
    cause: "Dust-sized icy grains pick up electrical charge and levitate above the ring plane, where Saturn's rigidly rotating magnetic field controls them instead of Kepler's laws.",
    note: "That is why they can be radial at all. Anything on a normal orbit would shear into a spiral within minutes, because the inner edge of the ring laps the outer edge.",
    build: createRingSpokes,
  },
  {
    id: "lunar-impact-flash",
    body: "Moon",
    title: "Lunar impact flash",
    detail: "Gravel-sized meteoroids hit the unlit hemisphere at full speed and flash",
    frequency: "About 0.68 validated flashes per hour of observation — NELIOTA recorded 192 in 283 hours between 2017 and 2023",
    cause: "No atmosphere. A meteoroid that would burn up harmlessly over Earth reaches the lunar surface at tens of kilometres a second and converts all of that energy to heat instantly.",
    note: "Over three-quarters of the impactors weigh between 1 and 200 grams and are 0.5–3 cm across. Most flashes last under 66 milliseconds and peak between 2,000 and 4,500 K.",
    build: createLunarImpactFlash,
  },
  {
    id: "solar-eclipse",
    body: "Earth",
    title: "Solar eclipse",
    detail: "The Moon's shadow lands on Earth and races across it",
    frequency: "Between two and five solar eclipses a year; any given place on Earth waits an average of 375 years for a total one",
    cause: "The Moon's orbit is tilted about 5° to Earth's, so at most new moons the shadow passes above or below. Only a new moon near an orbital node puts the shadow on the surface.",
    note: "The umbra is at most about 270 km wide and crosses the surface at over 1,700 km/h, which is why totality anywhere lasts only minutes.",
    build: createSolarEclipse,
  },
  {
    id: "supernova",
    body: null,
    title: "Supernova",
    detail: "A massive star collapses and detonates, lighting up the dust around it for months",
    frequency: "About two per century in the Milky Way. The last one seen from Earth with the naked eye was probably in 1680",
    cause: "A star above about eight solar masses runs out of fuel, its iron core collapses to a neutron star in under a second, and the infalling envelope rebounds off it.",
    note: "The light does not flash and vanish. This is a Type II-P: a ten-day rise, a hundred-day plateau while hydrogen recombines through the expanding envelope, then a cobalt-56 tail that takes over a year to fade.",
    build: createSupernova,
  },
  {
    id: "kilonova",
    body: null,
    title: "Kilonova",
    detail: "Two neutron stars merge and throw off debris that builds gold and platinum in seconds",
    frequency: "Rare enough that one has been caught once — GW170817, on 17 August 2017, in a galaxy 130 million light-years away",
    cause: "Two neutron stars spiral together and merge, flinging out a few per cent of a solar mass of neutron-rich debris that runs rapid neutron capture and builds elements past iron.",
    note: "This is where the heavy elements come from. GW170817 is estimated to have made several Earth-masses of gold and platinum — most of the gold on Earth was made this way.",
    build: createKilonova,
  },
  {
    id: "mercury-sodium-tail",
    body: "Mercury",
    title: "Sodium tail",
    detail: "Mercury streams a comet-like tail of sodium roughly 24 million km anti-sunward",
    frequency: "Every orbit — 88 days — peaking about 16 days either side of perihelion",
    cause: "Solar wind and micrometeorites knock sodium off the surface into Mercury's exosphere, and radiation pressure at the 589 nm sodium line pushes it away from the Sun.",
    note: "The double peak is a Doppler effect: Mercury's orbital speed shifts the sodium line off the dark bottom of the Sun's own sodium line and into the bright continuum, so the atoms suddenly have far more light to absorb.",
    build: createMercurySodiumTail,
  },
  {
    id: "uranus-storms",
    body: "Uranus",
    title: "Bright storm outbreak",
    detail: "Methane-ice cloud tops erupt across the northern hemisphere",
    frequency: "Seasonal. Activity has been climbing since the 2007 equinox; Keck counted eight large storms in a single night in August 2014",
    cause: "Uranus is tipped 98°, so for decades one pole faces the Sun and the atmosphere has nothing to drive it. Sunlight returning to both hemispheres after equinox restarts the weather.",
    note: "The 2014 outbreak was bright enough for amateurs with backyard telescopes to catch — on the planet Voyager 2 photographed in 1986 as a featureless ball.",
    build: createUranusStorms,
  },
  {
    id: "triton-geysers",
    body: "Triton",
    title: "Nitrogen geysers",
    detail: "Dark plumes rise 8 km and then bend over and stream 150 km downwind",
    frequency: "Individual vents can run for about a year; Voyager 2 caught at least two erupting during its 1989 flyby",
    cause: "A solid-state greenhouse. Sunlight passes through transparent nitrogen ice and warms darker material a metre or two below; the nitrogen there sublimates, pressure builds under the cap, and it vents — carrying dark dust with it.",
    note: "This happens on the coldest surface ever measured: 38 K, thirty-eight degrees above absolute zero.",
    build: createTritonGeysers,
  },
];

/**
 * Runs the roster.
 *
 * Every event is staged by name, once, on request. What remains here is the
 * mechanics of that: build the instance, attach it to its body, drive it to
 * completion, take it apart, and tell anyone listening what is happening.
 *
 * `viewCount` is kept per event and is the only state that outlives an
 * event -- it is what lets the dashboard say whether something has been
 * watched before, is running now, or has not been seen yet.
 */
export function createSolarSystemEvents({
  camera,
  findBody,
  announce,
  /**
   * Where an event with no body is staged.
   *
   * A group that rides with the camera at the deep-sky shell radius -- the
   * same trick `deepSky.js` uses, and correct rather than a cheat, since
   * nothing on that shell is closer than four light-years and no amount of
   * travelling inside one planetary system moves any of it.
   */
  skyAnchor = null,
  /**
   * The shell radius, as a function rather than a value.
   *
   * The space environment that owns this number is constructed after the event
   * system is, so reading it at call time throws. Called on demand instead.
   */
  getSkyRadius = () => 3000,
  /** Lets a sky event brighten the dust while it burns. */
  setSkyHighlight = null,
} = {}) {
  let active = null;
  let paused = false;
  const listeners = new Set();
  const viewCounts = new Map(EVENTS.map((event) => [event.id, 0]));
  const skyApi = { setSkyHighlight: (value) => setSkyHighlight?.(value) };

  function isOnScreen(body) {
    if (!body) return false;
    body.getWorldPosition(scratchProjection);
    scratchProjection.project(camera);
    return scratchProjection.z > -1 && scratchProjection.z < 1
      && Math.abs(scratchProjection.x) < 0.95 && Math.abs(scratchProjection.y) < 0.95;
  }

  function snapshot() {
    return {
      activeId: active?.definition.id ?? null,
      activeProgress: active
        ? THREE.MathUtils.clamp(active.elapsed / active.duration, 0, 1)
        : 0,
      paused,
      viewCounts: Object.fromEntries(viewCounts),
    };
  }

  /** One shape for every state change, so the dashboard has a single seam. */
  function emit() {
    const state = snapshot();
    listeners.forEach((listener) => listener(state));
    return state;
  }

  function stop() {
    if (!active) return;
    active.group.parent?.remove(active.group);
    active.dispose?.(skyApi);
    /*
     * Belt and braces on the highlight. `dispose` clears it, but an event that
     * is torn down mid-flight -- replaced by another, or disposed with the
     * whole system -- must never leave the sky stuck bright, and a stuck
     * highlight is not obviously a bug when you see it. It is one line.
     */
    setSkyHighlight?.(0);
    active = null;
    emit();
  }

  return {
    setPaused(value) { paused = Boolean(value); },

    update(deltaSeconds) {
      if (paused || !active) return;
      active.elapsed += deltaSeconds;
      const progress = active.elapsed / active.duration;
      if (progress >= 1) stop();
      else { active.update(progress, skyApi); emit(); }
    },

    /**
     * Stages one event now, by id. Runs once and takes itself apart -- there is
     * no looping, because the thing being depicted does not loop either.
     */
    play(id) {
      const definition = EVENTS.find((event) => event.id === id);
      if (!definition) return false;
      // An event with no body happens against the sky, not on anything.
      const host = definition.body === null ? skyAnchor : findBody(definition.body);
      if (!host) return false;
      stop();
      const instance = definition.build(
        definition.body === null ? host : host,
        camera,
        { skyRadius: getSkyRadius() },
      );
      host.add(instance.group);
      active = { ...instance, definition, elapsed: 0 };
      viewCounts.set(definition.id, (viewCounts.get(definition.id) ?? 0) + 1);
      announce?.({
        id: definition.id,
        // Sky events have no world to name, so they say where they are.
        body: definition.body ?? "Deep space",
        title: definition.title,
        detail: definition.detail,
        note: definition.note,
        // A sky event is staged in front of the lens by construction.
        visible: definition.body === null ? true : isOnScreen(host),
      });
      emit();
      return true;
    },

    /** Diagnostic alias, kept because the debug console documents it. */
    trigger(id) { return this.play(id); },

    /** Ends whatever is running, without starting anything. */
    stop,

    /** Whether a given event's body exists in the scene right now. */
    isAvailable(id) {
      const definition = EVENTS.find((event) => event.id === id);
      if (!definition) return false;
      if (definition.body === null) return Boolean(skyAnchor);
      return Boolean(findBody(definition.body));
    },

    /**
     * Which events can be staged right now.
     *
     * Moons are hydrated lazily as the journey reaches their parent, so
     * Enceladus and Triton genuinely do not exist while the camera is at
     * Earth. That is correct -- building Neptune's satellite system for a
     * viewer looking at Mars would be a real cost for nothing -- but it means
     * the roster is not uniformly available, and a button that fails on press
     * is worse than one that says why beforehand.
     */
    getAvailability: () => {
      const map = {};
      EVENTS.forEach((event) => {
        map[event.id] = event.body === null
          ? Boolean(skyAnchor)
          : Boolean(findBody(event.body));
      });
      return map;
    },

    /** Everything the dashboard needs to render itself. */
    list: () => EVENTS.map((event) => ({
      id: event.id,
      body: event.body ?? "Deep space",
      /** True when the event is staged against the sky rather than on a world. */
      isSky: event.body === null,
      title: event.title,
      detail: event.detail,
      frequency: event.frequency,
      cause: event.cause,
      note: event.note,
    })),

    getState: snapshot,

    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },

    dispose() { stop(); listeners.clear(); },
  };
}

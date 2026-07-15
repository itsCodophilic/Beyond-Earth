# Beyond Earth — Realistic Space Region Architecture Specification

## Purpose

This document is the implementation brief for building the **space environment system** of the **Beyond Earth** project.

It is intended to be given directly to a coding agent such as Codex.

The agent should treat this file as the primary source of truth for:

- visual direction
- scientific realism
- Three.js architecture
- rendering strategy
- camera behavior
- star-field design
- solar illumination
- cosmic dust
- galaxy visibility
- scroll-driven transitions
- performance requirements
- mobile behavior
- testing
- acceptance criteria

The objective is not to create a decorative star background.

The objective is to create a **realistic, cinematic, mesmerizing journey through the Solar System and into interstellar space**.

---

# 1. Project Vision

Beyond Earth should feel like an interactive space documentary rather than a conventional website.

The user should feel that they are physically travelling outward from the Sun, through the inner Solar System, past the gas giants, beyond Neptune, through the Kuiper Belt, and finally into interstellar space.

The experience should communicate:

- wonder
- silence
- scale
- isolation
- peace
- mystery
- curiosity
- infinity
- scientific realism
- humanity's smallness within the universe

The visual mood should be inspired by:

- NASA scientific imagery
- James Webb Space Telescope imagery
- Hubble imagery
- Interstellar
- 2001: A Space Odyssey
- Ad Astra
- modern planetarium visualizations
- deep-space astrophotography

However, the scene must not become fantasy space.

Avoid:

- excessive purple nebula fog
- colorful clouds everywhere
- hyperspace effects
- cartoon stars
- bright particles filling the screen
- flat panoramic backgrounds
- overuse of lens flare
- glowing planets from every direction
- unrealistic ambient illumination

The final style should be:

> Scientifically inspired, visually cinematic, emotionally powerful, and technically efficient.

---

# 2. Important Realism Principles

## 2.1 Space Is Mostly Black

Space should remain overwhelmingly dark.

The blackness of space is not empty visual space. It is the primary background against which all celestial objects become meaningful.

Do not fill the scene with:

- blue fog
- violet gradients
- grey atmospheric haze
- dense particle clouds
- bright ambient backgrounds

Darkness should dominate every region.

---

## 2.2 Sunlight Does Not Illuminate Empty Vacuum

Sunlight itself is not normally visible as glowing rays in empty space.

Sunlight becomes visible when it interacts with:

- planets
- moons
- asteroids
- spacecraft
- interplanetary dust
- gas
- camera optics
- atmospheric scattering

Therefore:

- do not render large solid beams coming from the Sun
- do not make the vacuum itself glow
- do not use scene-wide fog to represent sunlight
- do not brighten the entire scene near the Sun

Instead, show solar influence through:

- strong illumination on nearby objects
- bright rims
- high exposure
- lens glare
- corona
- dust glints
- reflected light
- harsh day-night boundaries
- reduced visibility of faint background stars

---

## 2.3 The Sun's Influence Gradually Weakens

There is no visible wall or boundary where the Solar System ends.

The Sun gradually becomes smaller and less visually dominant as the viewer moves outward.

The transition should be continuous.

Near the Sun:

- strong solar glare
- warm highlights
- powerful direct lighting
- restrained visibility of faint stars
- dust occasionally illuminated
- high scene contrast
- bright Sun corona

Far from the Sun:

- the Sun appears smaller
- glare becomes less dominant
- more stars become visible
- the Milky Way becomes clearer
- distant galaxies become easier to notice
- the scene feels colder and quieter
- deep blackness becomes more dominant

Beyond Neptune:

- the Sun should resemble an extremely bright nearby star
- the broader universe should become the main visual subject
- the Milky Way should be more noticeable
- faint galaxies should reward careful observation
- cosmic dust should remain subtle
- empty black space should still dominate

---

## 2.4 Galaxies Are Always Present

Distant galaxies do not suddenly appear after leaving the Solar System.

They are always present in the background.

Their visibility changes because of:

- solar glare
- camera exposure
- foreground brightness
- contrast
- viewing direction
- post-processing
- human visual adaptation

Therefore, galaxies should not be spawned suddenly at a certain region.

Instead:

- keep them present
- begin with very low visibility
- smoothly increase their perceptual visibility
- reveal them through exposure changes
- preserve continuity across the entire journey

---

## 2.5 Stars Should Not Look Like Five-Pointed Icons

Most stars should appear as:

- tiny points
- subtle halos
- slightly colored lights
- faint subpixel glints
- occasional brighter cores

Do not use:

- star emojis
- five-point star icons
- obvious PNG star shapes
- identical circular dots
- uniformly sized particles

The majority of stars should be very small.

Only a few bright stars should display optical diffraction spikes similar to:

- ✦
- ✧
- ✨

These spikes should represent the observation camera or optical system.

They are not the physical shape of the star.

---

## 2.6 Real Stars Do Not Twinkle in Space

Stars twinkle from Earth because of atmospheric turbulence.

In deep space they should remain visually stable.

However, for a cinematic experience, a very subtle brightness variation is acceptable.

This must be:

- slow
- restrained
- asynchronous
- nearly imperceptible
- never flashing
- never synchronized
- never cartoon-like

Suggested ordinary star brightness range:

```text
0.96 to 1.04
```

Suggested hero-star brightness range:

```text
0.92 to 1.08
```

Rare optical glints may briefly exceed this slightly.

---

# 3. Main Visual Journey

The user should experience a continuous transformation.

## 3.1 Inner Solar System

Regions:

- Sun
- Mercury
- Venus
- Earth
- Moon
- Mars

Visual characteristics:

- strong solar dominance
- warm illumination
- bright corona
- strong lens glare when viewing toward the Sun
- relatively low visibility of faint stars
- very dark shadows
- subtle illuminated dust
- sharp highlights on rocky worlds
- atmospheric scattering on Earth and Venus
- sparse distant-galaxy visibility
- Milky Way faint or barely visible

The background should still contain stars, but the exposure should make the faintest stars difficult to see.

---

## 3.2 Middle Solar System

Regions:

- Mars
- asteroid belt
- Jupiter
- Saturn

Visual characteristics:

- reduced solar glare
- increasing star visibility
- more noticeable variation in star brightness
- slightly clearer Milky Way structure
- rare visible galaxies
- asteroid fragments
- occasional illuminated debris
- increased depth perception
- slower visual rhythm
- greater sense of empty distance

The asteroid belt must not look like a dense wall of rocks.

Asteroids should be:

- sparse
- far apart
- varied in scale
- slowly rotating
- occasionally crossing the viewing path
- mostly isolated within large areas of empty space

---

## 3.3 Outer Solar System

Regions:

- Saturn
- Uranus
- Neptune

Visual characteristics:

- Sun visibly smaller
- cooler scene character
- reduced warm glare
- stronger star-field contrast
- clearer Milky Way
- more visible background galaxies
- occasional bright hero stars
- rare optical sparkles
- very sparse dust
- deep silence
- greater apparent depth

The environment should not suddenly become colorful.

The richness should come from:

- star density variation
- subtle color temperature
- layered depth
- dark dust lanes
- faint galaxies
- controlled bloom
- negative space

---

## 3.4 Kuiper Belt and Interstellar Transition

Visual characteristics:

- Sun appears like an extremely bright local star
- minimal solar glare
- broad universe becomes the dominant visual subject
- Milky Way becomes clearly recognizable
- faint galaxies become easier to see
- interstellar dust structures may appear as dark lanes
- sparse icy objects
- rare large distant bodies
- almost no visible local dust
- strong feeling of emptiness and scale

No fantasy nebula explosion should occur.

The transition should feel like the Sun slowly gives up visual control and the larger universe reveals itself.

---

# 4. Required Environment Layers

The environment must not be built as one flat sky texture.

Use multiple visual layers with different depths and motion responses.

---

## 4.1 Deep-Space Background

Purpose:

- provide the most distant visual structure
- create the Milky Way
- create dark galactic dust lanes
- provide large-scale stellar distribution
- create distant cosmic depth

Possible implementation:

- equirectangular celestial map
- cube texture
- sky sphere
- procedural shader
- hybrid of image-based and procedural layers

Recommended Three.js elements:

```js
THREE.SphereGeometry
THREE.MeshBasicMaterial
THREE.BackSide
THREE.TextureLoader
THREE.CubeTextureLoader
THREE.ShaderMaterial
```

Requirements:

- no visible seams
- no obvious repetition
- no fast rotation
- no flat wallpaper appearance
- no bright saturation
- no strong parallax
- no camera-following behavior that reveals the background as a nearby sphere

The deep background should remain almost fixed.

---

## 4.2 Procedural Distant Star Field

Use:

```js
THREE.Points
THREE.BufferGeometry
THREE.BufferAttribute
THREE.ShaderMaterial
```

Do not create one mesh per star.

Each star may contain:

```text
position
size
brightness
color
temperature
twinkle phase
twinkle speed
halo amount
hero-star eligibility
```

The star field must be deterministic.

Use seeded randomness so the star positions remain stable across reloads.

Recommended utility:

```js
seededRandom.js
```

### Distribution Rules

Do not use perfectly uniform random placement.

Create:

- dense bands
- sparse voids
- subtle Milky Way concentration
- a few loose clusters
- large empty regions
- uneven luminosity distribution

### Color Distribution

Most stars:

- neutral white
- slightly warm white
- pale yellow-white

Fewer:

- pale blue-white
- soft orange
- subtle red-orange

Avoid:

- bright red
- electric blue
- neon purple
- high saturation

### Size Distribution

Most stars:

- extremely small
- near subpixel scale
- low brightness

A few:

- larger
- brighter
- haloed

Very few:

- hero stars with diffraction spikes

---

## 4.3 Hero Star System

Hero stars are rare bright stars.

They should visually resemble delicate optical glints such as:

```text
✦
✧
✨
```

Do not use Unicode characters in the scene.

Do not use ordinary emoji sprites.

Preferred implementation:

- shader-based billboard
- signed-distance-field shape
- instanced starburst geometry
- radial core plus anisotropic diffraction spikes

Visual structure:

- bright circular center
- soft halo
- two main crossing spikes
- optional two faint diagonal spikes
- subtle bloom
- slow optical shimmer

Suggested population:

```text
0.1% to 0.5% of visible stars
```

Hero stars must:

- appear at different brightness levels
- shimmer independently
- not all animate together
- not rapidly pulse
- not scale dramatically
- not become large decorative icons

Potential shader approach:

```glsl
core = radial falloff
horizontalSpike = thin anisotropic falloff
verticalSpike = thin anisotropic falloff
diagonalSpike = weaker rotated falloff
final = core + spikes + halo
```

---

## 4.4 Mid-Distance Parallax Stars

Create a smaller set of apparently nearer stars.

Purpose:

- create depth during camera movement
- prevent the universe from feeling like a static skybox
- support subtle parallax

Rules:

- move only slightly relative to the camera
- never rush past like snow
- never resemble hyperspace
- never pass close enough to feel like particles
- remain visually stellar

The deep background should barely move.

Mid-distance stars should move slightly.

Dust should produce the strongest local parallax.

---

## 4.5 Fine Cosmic Dust

Use a shader-driven particle system.

Recommended:

```js
THREE.Points
THREE.BufferGeometry
THREE.ShaderMaterial
```

Dust should be:

- tiny
- sparse
- often invisible
- revealed by light angle
- slowly drifting
- unevenly distributed
- subtle during camera motion

Dust must not look like:

- snow
- underwater particles
- smoke
- fog
- rain
- sparks

Dust brightness should depend on:

- solar direction
- camera direction
- particle normal approximation
- journey region
- exposure
- viewing angle

Conceptual brightness:

```js
dustBrightness =
  baseOpacity *
  solarInfluence *
  viewLightAlignment *
  exposureResponse;
```

---

## 4.6 Coarse Debris and Small Asteroids

Use:

```js
THREE.InstancedMesh
THREE.IcosahedronGeometry
THREE.DodecahedronGeometry
THREE.BufferGeometry
```

Requirements:

- low polygon geometry
- irregular silhouettes
- random rotation
- slow drift
- sparse distribution
- large distances between objects
- subtle roughness
- physically consistent lighting
- no dense asteroid tunnel

Recommended use cases:

- asteroid belt region
- Kuiper Belt
- rare local debris near planets
- occasional silhouette crossing sunlight

Avoid updating every instance with new object allocations each frame.

Reuse:

```js
THREE.Matrix4
THREE.Vector3
THREE.Quaternion
THREE.Euler
```

---

## 4.7 Zodiacal Light

Create a very subtle flattened dust-scattering structure near the Solar System's ecliptic plane.

It should appear as:

- a broad faint glow
- low contrast
- strongest in the inner Solar System
- aligned with the ecliptic
- visible only under suitable exposure
- weaker farther outward

It must not resemble:

- a spotlight
- a hard cone
- a bright volumetric beam
- thick fog
- a solar ray tunnel

Possible implementation:

- shader-based volumetric approximation
- low-opacity flattened particle distribution
- large transparent geometry with noise
- procedural ecliptic glow shader

Use extreme restraint.

---

## 4.8 Distant Galaxy System

Galaxies should remain small and subtle.

Possible types:

- elliptical smudges
- edge-on streaks
- small spiral hints
- reddish distant galaxies
- irregular faint patches

Implementation options:

- billboard sprites
- instanced quads
- shader cards
- small textured planes

Recommended elements:

```js
THREE.InstancedMesh
THREE.PlaneGeometry
THREE.ShaderMaterial
THREE.MeshBasicMaterial
THREE.Sprite
THREE.SpriteMaterial
```

Variation must include:

- rotation
- scale
- brightness
- color
- opacity
- aspect ratio
- texture
- orientation

Avoid:

- large colorful galaxy images
- obvious repeated textures
- equal sizes
- equal brightness
- strong bloom
- too many visible galaxies

Galaxies should become perceptually clearer as the viewer travels outward.

Do not abruptly spawn them.

---

# 5. Solar Illumination System

The Sun is the dominant local light source.

Use one consistent solar-light direction for:

- planets
- moons
- asteroids
- debris
- dust glints
- atmosphere rims

Recommended implementation:

```js
THREE.DirectionalLight
```

The Sun itself may use:

- emissive sphere
- animated surface shader
- corona shader
- halo sprite
- selective bloom
- subtle lens flare

Avoid adding arbitrary fill lights around every planet.

---

## 5.1 Planet Lighting Rules

### Airless Worlds

Examples:

- Mercury
- Moon
- many asteroids

Characteristics:

- sharp terminator
- harsh direct light
- deep dark side
- rough surface response
- little atmospheric scattering
- strong crater shadows

### Atmospheric Worlds

Examples:

- Venus
- Earth
- Mars
- gas giants

Characteristics:

- atmosphere rim
- softer terminator
- scattering toward the limb
- thin glow
- subtle night-side fill only where justified
- cloud or haze response where applicable

### Gas Giants

Characteristics:

- broad atmospheric shading
- soft limb
- layered cloud textures
- subtle volumetric feeling
- clear light direction
- restrained night-side visibility

---

# 6. Exposure and Journey State

Create a centralized environment controller.

Suggested name:

```text
EnvironmentStateController
```

It should convert travel progress into visual parameters.

Example state:

```js
{
  journeyProgress,
  solarInfluence,
  solarGlare,
  rendererExposure,
  directLightIntensity,
  sunApparentScale,
  starVisibility,
  heroStarVisibility,
  milkyWayVisibility,
  galaxyVisibility,
  dustVisibility,
  zodiacalGlow,
  debrisVisibility,
  backgroundContrast,
  bloomStrength,
  lensFlareStrength
}
```

The values should transition smoothly.

Use:

- smoothstep
- smootherstep
- damped interpolation
- exponential easing
- critically damped motion

Avoid:

- direct raw scroll assignment
- abrupt opacity switches
- planet-by-planet hard transitions
- visible state jumps

Suggested easing helper:

```js
current += (target - current) * (1 - Math.exp(-damping * deltaTime));
```

---

# 7. Journey Progress Map

Create a normalized travel value.

```js
journeyProgress = 0.0;
journeyProgress = 1.0;
```

Example mapping:

```js
export const journeyMap = {
  sun: 0.00,
  mercury: 0.08,
  venus: 0.16,
  earth: 0.25,
  moon: 0.29,
  mars: 0.36,
  asteroidBelt: 0.46,
  jupiter: 0.56,
  saturn: 0.67,
  uranus: 0.77,
  neptune: 0.86,
  kuiperBelt: 0.94,
  interstellar: 1.00
};
```

Adapt this mapping to the current project.

The same environment progression must work when the user:

- scrolls
- clicks navigation
- selects a planet
- moves backward
- reloads at a section
- uses mobile touch
- navigates using keyboard controls

---

# 8. Camera Design

The camera should feel weightless and cinematic.

Avoid:

- snapping
- sudden FOV changes
- fast orbiting
- constant shaking
- quick spinning
- excessive roll
- flat frontal planet views
- zooming only by changing FOV

Prefer physical camera movement.

Interpolate:

- position
- look-at target
- roll
- field of view
- focus distance
- exposure
- environment progress

---

## 8.1 Planet Focus Camera

When the user selects a planet:

1. calculate the planet's visible radius
2. calculate camera framing distance from radius and FOV
3. approach using a deliberate angle
4. reveal the illuminated side
5. preserve visible depth
6. avoid stopping too close
7. avoid framing the planet as a flat disc
8. maintain subtle orbital drift after arrival
9. maintain solar-light consistency
10. adapt environmental exposure smoothly

Suggested camera distance formula:

```js
distance = radius / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
distance *= framingMultiplier;
```

Use a configurable multiplier.

---

## 8.2 Camera Parallax

During camera movement:

- deep background barely moves
- distant stars move slightly
- mid-distance stars move more
- dust moves most noticeably
- debris produces real local parallax

Do not attach every layer directly to the camera.

Do not let the sky appear fixed like a texture pasted onto the screen.

---

# 9. Three.js Technical Guidance

## 9.1 Core Rendering

Consider:

```js
THREE.Scene
THREE.PerspectiveCamera
THREE.WebGLRenderer
THREE.Clock
THREE.Color
THREE.Vector2
THREE.Vector3
THREE.Matrix4
THREE.Quaternion
```

Recommended renderer setup:

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = initialExposure;
```

Preserve compatibility with the current installed Three.js version.

---

## 9.2 Particle Systems

Use:

```js
THREE.Points
THREE.BufferGeometry
THREE.Float32BufferAttribute
THREE.ShaderMaterial
```

Avoid:

- one mesh per star
- one sprite per dust particle
- per-frame geometry recreation
- repeated texture loads
- unnecessary CPU position updates

Use shader time for subtle motion where possible.

---

## 9.3 Instancing

Use:

```js
THREE.InstancedMesh
```

Appropriate for:

- asteroid fragments
- debris
- galaxy cards
- repeated optical elements
- repeated geometry-based sparkles

Keep draw calls low.

---

## 9.4 Post-Processing

Recommended:

```js
EffectComposer
RenderPass
UnrealBloomPass
OutputPass
```

Optional:

- SMAA
- FXAA
- selective bloom
- custom glare pass
- subtle vignette
- restrained chromatic aberration near the Sun only

Bloom should affect:

- Sun
- hero stars
- bright atmosphere rims
- intense reflections

Bloom should not affect:

- labels
- menus
- navigation
- all ordinary stars
- every planet
- all dust particles

Prefer selective bloom.

---

# 10. Shader Architecture

Suggested shader folders:

```text
src/
  js/
    shaders/
      stars/
        starVertex.glsl
        starFragment.glsl
        heroStarVertex.glsl
        heroStarFragment.glsl
      dust/
        dustVertex.glsl
        dustFragment.glsl
      solar/
        coronaVertex.glsl
        coronaFragment.glsl
      galaxy/
        galaxyVertex.glsl
        galaxyFragment.glsl
```

If the project does not currently support importing `.glsl` files, either:

- configure Vite appropriately
- use JavaScript template strings
- use an existing shader-loading solution

Do not leave unresolved shader imports.

---

## 10.1 Main Star Shader Attributes

Possible attributes:

```js
aSize
aBrightness
aColor
aTwinklePhase
aTwinkleSpeed
aHalo
aLayerDepth
```

Possible uniforms:

```js
uTime
uPixelRatio
uVisibility
uExposure
uSolarSuppression
uJourneyProgress
uCameraPosition
uViewport
```

The vertex shader should:

- transform position
- calculate point size
- apply distance attenuation
- clamp mobile point sizes
- pass brightness and color
- avoid oversized stars near the camera

The fragment shader should:

- create soft circular stars
- discard outer pixels
- create controlled halo
- avoid square point edges
- apply subtle brightness variation
- preserve color temperature
- avoid full-white clipping

---

## 10.2 Hero Star Shader

The hero-star shader should generate:

- circular core
- horizontal spike
- vertical spike
- optional diagonal spikes
- radial halo
- exposure response
- slow shimmer

Pseudo-logic:

```glsl
float core = radialFalloff(uv);
float horizontal = spikeX(uv);
float vertical = spikeY(uv);
float diagonalA = spikeDiagonalA(uv);
float diagonalB = spikeDiagonalB(uv);

float sparkle =
  core +
  horizontal * mainSpikeStrength +
  vertical * mainSpikeStrength +
  diagonalA * secondarySpikeStrength +
  diagonalB * secondarySpikeStrength;
```

Use smooth edges.

Avoid sharp pixel-art shapes.

---

# 11. Suggested Module Architecture

Adapt to the existing repository.

```text
src/
  js/
    core/
      SceneManager.js
      RendererManager.js
      CameraController.js
      AnimationLoop.js

    space/
      SpaceEnvironment.js
      SpaceEnvironmentConfig.js
      EnvironmentStateController.js
      StarField.js
      HeroStarField.js
      MilkyWayBackground.js
      GalaxyField.js
      CosmicDustField.js
      ZodiacalLight.js
      DebrisField.js
      SolarOptics.js

    shaders/
      stars/
      dust/
      solar/
      galaxy/

    utils/
      seededRandom.js
      math.js
      disposeObject3D.js
      deviceQuality.js
      textureLoader.js

    config/
      journeyMap.js
      qualityPresets.js
```

Do not force this structure if the project already has a clear architecture.

Preserve naming consistency.

---

# 12. Main SpaceEnvironment Interface

Suggested API:

```js
class SpaceEnvironment {
  constructor({
    scene,
    camera,
    renderer,
    composer,
    quality,
    assets
  }) {}

  async init() {}

  setJourneyProgress(progress) {}

  setSolarDirection(direction) {}

  setSunPosition(position) {}

  update(deltaTime, elapsedTime) {}

  resize(width, height, pixelRatio) {}

  setQuality(preset) {}

  dispose() {}
}
```

The rest of the application should interact mainly with `SpaceEnvironment`.

Avoid exposing every internal subsystem to `main.js`.

---

# 13. Configuration

Centralize artistic settings.

Example:

```js
export const spaceEnvironmentConfig = {
  stars: {
    desktopCount: 18000,
    tabletCount: 10000,
    mobileCount: 5500,
    minRadius: 400,
    maxRadius: 1800,
    heroRatio: 0.002,
    twinkleAmount: 0.04,
    maxPointSize: 5
  },

  heroStars: {
    desktopCount: 36,
    tabletCount: 22,
    mobileCount: 12,
    spikeStrength: 0.75,
    haloStrength: 0.4
  },

  dust: {
    fineDesktopCount: 5000,
    fineMobileCount: 1500,
    coarseDesktopCount: 250,
    coarseMobileCount: 80
  },

  galaxies: {
    desktopCount: 80,
    mobileCount: 35,
    minOpacity: 0.02,
    maxOpacity: 0.16
  },

  exposure: {
    innerSolar: 0.72,
    middleSolar: 0.86,
    outerSolar: 1.0,
    interstellar: 1.12
  },

  bloom: {
    innerStrength: 0.65,
    outerStrength: 0.4,
    radius: 0.35,
    threshold: 0.8
  },

  camera: {
    transitionDamping: 4.5,
    lookAtDamping: 5.0,
    progressDamping: 3.5
  }
};
```

These values are starting points only.

Tune them after inspecting:

- project scale
- current camera
- planet sizes
- renderer settings
- device performance
- existing post-processing

---

# 14. Quality Presets

Create:

- high
- medium
- low

Possible structure:

```js
export const qualityPresets = {
  high: {
    starMultiplier: 1,
    dustMultiplier: 1,
    galaxyMultiplier: 1,
    bloomResolutionScale: 1,
    maxPixelRatio: 2,
    heroStars: true,
    zodiacalLight: true,
    coarseDebris: true
  },

  medium: {
    starMultiplier: 0.65,
    dustMultiplier: 0.55,
    galaxyMultiplier: 0.7,
    bloomResolutionScale: 0.75,
    maxPixelRatio: 1.5,
    heroStars: true,
    zodiacalLight: true,
    coarseDebris: true
  },

  low: {
    starMultiplier: 0.35,
    dustMultiplier: 0.25,
    galaxyMultiplier: 0.4,
    bloomResolutionScale: 0.5,
    maxPixelRatio: 1.25,
    heroStars: true,
    zodiacalLight: false,
    coarseDebris: false
  }
};
```

Quality detection may consider:

- mobile device
- screen size
- device pixel ratio
- frame-rate sampling
- reduced-motion preference
- WebGL capability
- memory limits where detectable

Do not rely only on user-agent detection.

---

# 15. Performance Requirements

Target:

- approximately 60 FPS on capable desktop hardware
- stable 30 to 60 FPS on modern mobile devices
- graceful quality reduction
- no memory leaks
- no repeated shader compilation
- no per-frame geometry construction

Rules:

1. Use `THREE.Points` for large particle systems.
2. Use `THREE.InstancedMesh` for repeated geometry.
3. Reuse vectors, matrices, colors, and quaternions.
4. Avoid object allocation inside the animation loop.
5. Cap device pixel ratio.
6. Reduce counts on mobile.
7. Reduce post-processing resolution on mobile.
8. Pause or reduce work when the tab is hidden.
9. Avoid updating static buffer attributes.
10. Prefer GPU-driven motion.
11. Minimize transparent overdraw.
12. Keep draw calls controlled.
13. Dispose all geometries, materials, textures, and render targets.
14. Avoid duplicate animation loops.
15. Profile before and after implementation.

---

# 16. Reduced Motion and Accessibility

Respect:

```css
prefers-reduced-motion
```

Reduced-motion behavior:

- disable nonessential camera drift
- reduce star shimmer
- reduce dust movement
- disable large optical glints
- reduce parallax strength
- disable unnecessary lens movement
- preserve environment progression
- preserve readability

All space effects must remain behind the HTML interface.

Ensure labels and controls remain readable.

Do not let bloom affect UI text.

---

# 17. Sun Optical Effects

The Sun may include:

- emissive sphere
- animated surface shader
- corona
- halo
- restrained lens flare
- selective bloom
- subtle distortion near the limb

Lens flare should depend on:

- Sun screen position
- camera angle
- Sun visibility
- occlusion
- journey progress
- exposure
- solar influence

Do not display lens flare when:

- the Sun is behind the camera
- the Sun is fully occluded
- the Sun is far outside the viewport
- the current exposure would suppress it

Avoid:

- strong rainbow flares
- persistent flare
- giant rings
- excessive anamorphic streaks
- multiple bright artifacts

---

# 18. Planet Realism Integration

The space system must visually support the planets.

Each planet should use suitable texture maps where available:

- color map
- normal map
- roughness map
- displacement map
- cloud map
- night map
- atmosphere mask

Do not apply every map type to every planet.

Examples:

## Mercury

- high roughness
- crater normal or displacement
- strong directional light
- sharp terminator
- no atmosphere

## Venus

- dense cloud layer
- yellow-white atmospheric scattering
- diffused surface visibility
- warm solar interaction
- thick atmospheric rim

## Earth

- surface color map
- normal map
- roughness variation
- cloud layer
- night lights
- atmospheric scattering
- blue limb

## Mars

- dusty rough surface
- crater and terrain normals
- subtle atmosphere
- warm red-orange surface
- dark night side

## Gas Giants

- banded cloud textures
- soft lighting
- atmospheric limb
- subtle rotational motion
- no rocky-surface appearance

---

# 19. Implementation Roadmap

## Phase 1 — Repository Audit

The coding agent must first inspect:

- source structure
- Vite config
- package dependencies
- Three.js version
- renderer setup
- scene setup
- camera controller
- animation loop
- scroll logic
- navigation logic
- planet modules
- post-processing
- texture loading
- resize handling
- cleanup handling
- deployment setup

The agent should report:

- current architecture
- reusable systems
- conflicting systems
- duplicate animation loops
- likely performance issues
- files to preserve
- files to refactor
- files to create

Do not perform major replacement before this audit.

---

## Phase 2 — Environment Foundation

Create:

- `SpaceEnvironment`
- environment configuration
- journey state controller
- quality presets
- seeded randomness
- lifecycle methods
- resize integration
- disposal integration

Confirm this foundation works before adding heavy visuals.

---

## Phase 3 — Procedural Stars

Implement:

- distant star field
- nonuniform distribution
- star colors
- size variation
- subtle shimmer
- desktop and mobile counts
- stable seeded layout

Validate:

- no square points
- no particle-wall appearance
- no excessive brightness
- no repeated animation pattern
- no flat skybox feeling

---

## Phase 4 — Hero Stars

Implement:

- optical diffraction shader
- rare sparkle stars
- exposure-based visibility
- independent shimmer
- selective bloom

Validate:

- resembles delicate ✦ or ✨ optics
- does not resemble emoji
- remains rare
- no synchronized animation
- no oversized stars

---

## Phase 5 — Milky Way and Galaxies

Implement:

- deep Milky Way structure
- dark dust lanes
- faint galaxy field
- progressive visibility
- texture variation
- large-scale depth

Validate:

- no sudden spawning
- no fantasy saturation
- no obvious repeating cards
- no large nearby-looking galaxies

---

## Phase 6 — Dust and Zodiacal Light

Implement:

- fine dust
- coarse debris
- angle-dependent illumination
- ecliptic dust distribution
- zodiacal glow
- regional density control

Validate:

- no snow effect
- no underwater appearance
- no smoke
- no fog wall
- no bright cone from the Sun

---

## Phase 7 — Solar Optics and Exposure

Implement:

- solar influence controller
- renderer exposure changes
- Sun glare
- corona
- selective bloom
- lens flare
- star suppression near strong glare
- galaxy visibility adaptation

Validate:

- smooth transitions
- no hard section changes
- no overexposure
- no UI bloom
- no permanent flare

---

## Phase 8 — Camera and Navigation

Integrate:

- scroll progress
- navigation clicks
- planet focus
- reverse movement
- deep links
- mobile touch
- keyboard navigation
- camera easing
- environment easing

Validate:

- no snapping
- no flat planet framing
- no raw-scroll jitter
- no camera fighting
- no duplicate controllers

---

## Phase 9 — Performance and Accessibility

Implement:

- quality tiers
- reduced motion
- frame-rate monitoring
- hidden-tab optimization
- pixel-ratio cap
- post-processing scaling
- resource disposal
- memory leak prevention

Validate:

- desktop performance
- mobile performance
- resizing
- orientation changes
- production build
- GitHub Pages deployment

---

## Phase 10 — Final Polish

Tune:

- star brightness
- hero-star rarity
- Milky Way visibility
- galaxy opacity
- dust density
- solar bloom
- camera speed
- exposure
- parallax
- color balance
- black levels

Remove anything that feels decorative rather than spatial.

---

# 20. Coding Rules for the Agent

The agent must:

- inspect before rewriting
- preserve working features
- avoid one giant file
- avoid fake placeholder paths
- avoid incomplete pseudocode
- avoid TODO-only implementation
- avoid duplicate animation loops
- avoid global state where unnecessary
- keep naming consistent
- add concise technical comments
- preserve Vite compatibility
- preserve GitHub Pages compatibility
- validate imports
- validate shader paths
- validate asset paths
- include cleanup logic
- include resize logic
- include mobile behavior
- provide complete code

The agent must not:

- silently delete existing features
- invent unused modules
- create disconnected demos
- leave broken imports
- leave unimplemented interfaces
- add heavy libraries without justification
- replace the complete app unnecessarily
- add random lights to every planet
- use literal emoji textures for stars

---

# 21. Required Deliverables from the Agent

The agent should provide:

1. architecture assessment
2. implementation plan adapted to the actual repository
3. files to create
4. files to modify
5. explanation of each change
6. complete production-ready code
7. complete shader files
8. asset requirements
9. quality preset logic
10. mobile strategy
11. reduced-motion behavior
12. integration steps
13. testing checklist
14. production-build verification
15. performance implications
16. cleanup and disposal strategy

---

# 22. Acceptance Criteria

The implementation is successful only if all of the following are true.

## Visual

- space remains predominantly black
- planets show clear spherical depth
- all planets share a consistent solar-light direction
- stars vary in brightness and color
- star distribution is nonuniform
- most stars remain tiny
- hero stars resemble optical ✨ glints
- hero stars remain rare
- galaxies are subtle
- Milky Way visibility increases outward
- solar glare decreases outward
- no fantasy fog dominates the scene
- dust remains sparse
- asteroid belt remains mostly empty
- deep-space layers create visible parallax
- transitions are smooth
- no scene looks like a flat wallpaper

## Interaction

- scroll progression works
- navigation clicks work
- reverse travel works
- planet focus works
- camera framing remains cinematic
- mobile touch works
- resize works
- orientation change works
- reduced motion works

## Performance

- no duplicate render loops
- no excessive draw calls
- no per-frame geometry creation
- no obvious memory leaks
- device pixel ratio is capped
- mobile quality is reduced gracefully
- post-processing remains controlled
- production build succeeds

## Architecture

- modules are reusable
- configuration is centralized
- seeded randomness is used
- disposal methods exist
- update methods avoid allocations
- Vite paths work
- GitHub Pages deployment remains functional

---

# 23. Final Intended Experience

When the user begins near the Sun, the scene should feel dominated by solar power.

The Sun should create strong illumination, deep shadows, warm glare, and restrained background visibility.

Tiny dust particles should become visible only when the light catches them.

As the user moves past Mercury, Venus, Earth, and Mars, the stars should remain present but visually subdued by solar exposure.

Around Jupiter and Saturn, the star field should feel deeper. The Milky Way should become easier to notice. A few galaxies should begin to appear as faint distant smudges.

Near Uranus and Neptune, the Sun should feel smaller. The universe should feel larger. The brightest stars may display delicate optical diffraction spikes.

Beyond Neptune, the Sun should appear as a brilliant nearby star behind the traveller.

The Milky Way should span the background.

Countless tiny stars should create depth without destroying the emptiness.

Rare bright stars should produce elegant ✨-like optical glints.

Faint galaxies should reward users who pause and observe.

Nothing should move quickly.

Nothing should flash for attention.

Nothing should feel crowded.

The experience should become mesmerizing through:

- scale
- darkness
- restraint
- depth
- slow motion
- realistic light
- subtle detail
- silence

The universe itself should be the main character.

---

# 24. Initial Instruction to Codex

Use the following as the first instruction when beginning work:

> Read this complete specification before changing code. Then inspect the repository and explain the current rendering architecture, scene lifecycle, camera logic, scrolling system, planet modules, and performance risks. Do not begin by rewriting the project. First provide an implementation plan tailored to the actual repository. After the audit, implement the space environment in modular phases, beginning with the environment foundation and procedural star field.

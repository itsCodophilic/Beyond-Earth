# 🌌 Understanding WebGL & Three.js (Simple Beginner Guide)

> **Goal:** By the end of this guide, you should understand:
>
> - What is WebGL?
> - What is Three.js?
> - Why do we need them?
> - How browsers render 3D graphics?
> - Why wasn't HTML/CSS enough?
> - How everything works behind the scenes?

---

# Let's Start With a Question...

When you open YouTube, Instagram, or Amazon...

The browser displays:

- Text
- Buttons
- Images
- Videos

using **HTML + CSS + JavaScript**.

But...

What if we want to build something like this?

- 🌍 A rotating Earth
- 🌕 Moon orbiting Earth
- ⭐ Millions of stars
- ☄️ Flying through galaxies
- 🌌 Black holes
- 🚀 Camera moving through space

Can HTML draw these?

❌ No.

HTML only creates webpage elements.

---

# Think of HTML Like LEGO

HTML can build things like:

```
Heading

Button

Card

Image

Video

Paragraph
```

Imagine HTML as LEGO blocks.

You can arrange them beautifully.

But...

You cannot create an entire universe with LEGO.

---

# What about CSS?

CSS makes HTML beautiful.

It changes:

- Colors
- Fonts
- Shadows
- Borders
- Animations
- Layout

Example

```
Button

↓

Blue Button

↓

Rounded Button

↓

Animated Button
```

CSS can animate things...

But only webpage elements.

---

# What about JavaScript?

JavaScript makes HTML interactive.

For example

```
Click Button

↓

Open Menu

↓

Change Color

↓

Move Card
```

Still...

JavaScript is only controlling HTML.

It still cannot draw an actual 3D world.

---

# Imagine the Browser

Think of your browser as a room.

Inside the room...

```
HTML

↓

CSS

↓

JavaScript
```

Everything is still made from webpage elements.

There is no real 3D world.

---

# Then How Do Games Run Inside Browsers?

Good question.

Browsers have another powerful feature called...

# WebGL

---

# What is WebGL?

WebGL means

**Web Graphics Library**

It allows JavaScript to communicate directly with your computer's **Graphics Card (GPU).**

Instead of saying

```
Create Button
```

JavaScript can now say

```
Draw Triangle

Draw Sphere

Draw Cube

Draw 1 Million Stars
```

Now we're no longer building webpages.

We're drawing graphics.

---

# Think Like This

Without WebGL

```
JavaScript

↓

HTML

↓

Browser
```

With WebGL

```
JavaScript

↓

WebGL

↓

GPU

↓

Screen
```

Now the graphics card is doing the heavy work.

---

# Why GPU?

Your computer has two important parts.

## CPU

Good at

- Logic
- Calculations
- Running programs

Example

```
Open Chrome

Run JavaScript

Open Files
```

---

## GPU

Good at

Drawing millions of pixels every second.

Example

```
Draw Earth

↓

Draw Moon

↓

Draw Stars

↓

Draw Shadows

↓

Draw Reflections

↓

60 times every second
```

GPU is built for graphics.

---

# Why HTML Wasn't Enough?

Imagine trying to make Earth.

Using HTML.

```
<div class="earth"></div>
```

Now rotate it.

Still just a flat circle.

Want clouds?

Need more divs.

Atmosphere?

More divs.

Moon?

More divs.

Stars?

Thousands of divs.

Browser starts crying 😅

---

# With WebGL

Earth isn't a div.

It is

```
Sphere

↓

Texture

↓

Lighting

↓

Shadows

↓

GPU
```

Everything is mathematical.

---

# But WebGL is Hard...

Extremely hard.

Imagine you want one cube.

Instead of

```javascript
createCube();
```

WebGL requires hundreds of lines.

You need to explain

- vertices
- shaders
- buffers
- matrices
- projection
- lighting
- camera

For one cube.

---

# Example

Drawing one triangle in raw WebGL can take over **100 lines of code**.

Imagine Earth.

Thousands of lines.

---

# So Three.js Was Created

Three.js is a library.

It sits on top of WebGL.

Think of it as

```
Raw WebGL

↓

Very Difficult

↓

Three.js

↓

Very Easy
```

---

# Example

Without Three.js

```
100+ lines

↓

One Triangle
```

With Three.js

```javascript
const geometry = new THREE.BoxGeometry();
```

Done.

---

# Another Example

Without Three.js

```
Calculate vertices

↓

Send to GPU

↓

Create shader

↓

Create buffers

↓

Create projection

↓

Draw
```

With Three.js

```javascript
new THREE.SphereGeometry();
```

Finished.

---

# So What Does Three.js Actually Do?

Three.js creates useful objects for us.

Like

```
Scene

Camera

Renderer

Sphere

Cube

Light

Texture

Animation
```

Instead of building everything ourselves.

---

# Think of Three.js Like a Game Engine

Unity

↓

Makes games easier.

---

Three.js

↓

Makes WebGL easier.

---

# The Core of Every Three.js Project

Every project has these five things.

---

## 1. Scene

Think of the Scene as the universe.

Everything lives inside it.

```
Scene

├── Earth

├── Moon

├── Sun

├── Stars
```

Without Scene

Nothing exists.

---

## 2. Camera

The camera is your eyes.

Wherever the camera looks...

You see.

Example

```
Camera

↓

Earth
```

Move camera

↓

See Moon

Rotate camera

↓

See Saturn

---

## 3. Renderer

Renderer takes the Scene...

Looks through the Camera...

Draws everything.

```
Scene

↓

Camera

↓

Renderer

↓

Monitor
```

Without Renderer...

Nothing appears.

---

## 4. Objects

Objects are

- Earth
- Moon
- Stars
- Planets
- Cubes
- Spaceships

Everything you see is an object.

---

## 5. Animation Loop

This is the heartbeat.

Imagine

```
Draw Earth

↓

Draw Again

↓

Draw Again

↓

Draw Again
```

60 times every second.

Like

```
while(true){

draw();

}
```

That's how motion happens.

---

# How Does Earth Rotate?

Every frame

```
Earth.rotation += 0.01
```

Renderer draws again.

Looks like Earth is rotating.

---

# What Happens Every Second?

Your monitor refreshes

About

```
60 Frames

Every Second
```

Every frame

Three.js

```
Updates objects

↓

Updates camera

↓

Updates lighting

↓

Renders everything
```

Again and again.

---

# Why Is It So Smooth?

Because the GPU is doing the drawing.

Not HTML.

---

# Our Universe Project

When someone opens our website

We'll create

```
Scene

↓

Camera

↓

Renderer

↓

Stars

↓

Earth

↓

Moon

↓

Lights

↓

Animation Loop
```

Everything is rendered every frame.

---

# Scrolling

When the user scrolls...

We won't move the webpage.

We'll move the camera.

```
User Scroll

↓

Camera Moves

↓

Renderer Draws New Frame

↓

Looks Like Flying
```

Actually...

The webpage never moved.

Only the camera moved.

---

# Clicking Earth

User clicks Earth.

Three.js detects the object.

```
Click

↓

Raycaster

↓

Earth Selected

↓

Camera Flies Towards Earth
```

Just like clicking a planet in Google Earth.

---

# Why We Chose Three.js

Because we want

✅ Real 3D

✅ Lighting

✅ Shadows

✅ Camera

✅ Smooth Animations

✅ Millions of Stars

✅ GPU Rendering

Without writing raw WebGL ourselves.

---

# Final Analogy

Imagine you want to cook.

### Raw WebGL

Like farming wheat...

Grinding flour...

Making dough...

Building your own oven...

Then baking bread.

Very powerful.

Very difficult.

---

### Three.js

Like buying high-quality ingredients.

You still cook.

But you don't need to build the oven.

---

# One Last Thing to Remember

Think of our project like this:

```
HTML

↓

Creates UI

(Navigation, Loader, Buttons)

------------------------

CSS

↓

Makes UI Beautiful

------------------------

JavaScript

↓

Controls Everything

------------------------

Three.js

↓

Creates 3D World

------------------------

WebGL

↓

Talks to GPU

------------------------

GPU

↓

Draws Universe
```

Everything works together.

HTML isn't replaced.

CSS isn't replaced.

JavaScript isn't replaced.

They all work **alongside** Three.js.

Three.js then uses **WebGL**, and WebGL uses your computer's **GPU** to render the immersive 3D universe.
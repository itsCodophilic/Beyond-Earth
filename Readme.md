# 🌌 Beyond Earth

> An immersive 3D Solar System experience built with **Three.js** and **Vite**.

---

## 🚀 Features

- 🌍 Interactive 3D Solar System
- 🪐 Animated planets
- 🎥 Camera controls
- ⚡ Fast development using Vite
- 📦 Modular JavaScript architecture
- 🌐 Hosted using GitHub Pages

---

# 📁 Project Structure

```text
Beyond-Earth/
│
├── public/
│
├── src/
│   ├── css/
│   │   ├── styles.css              # CSS entry point
│   │   ├── base.css                # Theme and browser defaults
│   │   ├── experience.css          # Canvas, stages, and progress
│   │   ├── loader.css              # Startup overlay animation
│   │   ├── hud.css                 # Readout and responsive controls
│   │   └── brand.css               # Beyond Earth identity
│   │
│   └── js/
│       ├── main.js                 # Application composition and render loop
│       ├── brand.js                # Magnetic brand interaction
│       ├── config/
│       │   └── textures.js         # Texture sources and fallback rules
│       ├── graphics/
│       │   ├── loadTextures.js     # Asynchronous texture loading
│       │   ├── materials.js        # Custom WebGL shader materials
│       │   └── proceduralTextures.js
│       ├── planets/                # One owned folder per planet
│       │   ├── earth/
│       │   │   ├── earth.js
│       │   │   └── satellites/
│       │   │       └── moon.js     # Moon mesh, craters, and orbit
│       │   ├── mercury/ ... neptune/
│       │   │   └── <planet>.js
│       │   └── index.js            # Ordered planet registry
│       ├── stars/
│       │   └── sun/
│       │       └── sun.js           # Surface, corona, glow, flares, and light
│       └── scene/
│           ├── planetFactory.js    # Planet mesh construction
│           ├── orbits.js           # Orbit guide construction
│           ├── particles.js        # Stars, galaxy, and belt dust
│           └── asteroidBelt.js     # Rocky asteroid meshes
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── .gitignore
└── README.md
```

---

# 📋 Prerequisites

Install **Node.js** (includes npm).

Verify installation:

```bash
node -v
npm -v
```

---

# 📥 Clone the Repository

```bash
git clone https://github.com/itsCodophilic/Beyond-Earth.git
```

Move into the project directory.

```bash
cd Beyond-Earth
```

---

# 📦 Install Dependencies

Install all required packages.

```bash
npm install
```

---

# ▶️ Run the Development Server

```bash
npm run dev
```

Vite will start a local server.

Example:

```
http://localhost:5173
```

---

# 🏗️ Build for Production

Generate the optimized production build.

```bash
npm run build
```

The production files are generated inside:

```text
dist/
```

---

# 👀 Preview the Production Build

```bash
npm run preview
```

---

# 🌐 Deploying to GitHub Pages

## Step 1 — Install `gh-pages`

```bash
npm install --save-dev gh-pages
```

---

## Step 2 — Update `package.json`

Add these scripts.

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "deploy": "gh-pages -d dist",
  "publish": "npm run build && npm run deploy"
}
```

---

## Step 3 — Configure `vite.config.js`

Replace **Beyond-Earth** with your repository name if it ever changes.

```javascript
import { defineConfig } from "vite";

export default defineConfig({
  base: "/Beyond-Earth/",
});
```

---

## Step 4 — Build the Project

```bash
npm run build
```

---

## Step 5 — Deploy

```bash
npm run deploy
```

This creates a new branch named:

```
gh-pages
```

and uploads the contents of the `dist/` folder.

---

## Step 6 — Enable GitHub Pages

Open your GitHub repository.

Go to:

```
Settings
    ↓
Pages
```

Under **Build and Deployment**:

```
Source
Deploy from a branch
```

Choose:

```
Branch
gh-pages
```

Folder:

```
/ (root)
```

Click **Save**.

After a minute or two your website will be live at:

```
https://itsCodophilic.github.io/Beyond-Earth/
```

---

# 🔄 Updating the Website

Whenever you make changes to the project:

### 1. Start the development server

```bash
npm run dev
```

Verify your changes.

---

### 2. Commit your changes

```bash
git add .
git commit -m "Describe your changes"
```

---

### 3. Push to GitHub

```bash
git push origin main
```

This updates your source code repository.

---

### 4. Publish the latest website

```bash
npm run publish
```

or

```bash
npm run build
npm run deploy
```

After 1–2 minutes, GitHub Pages will automatically serve the latest version.

---

# 💻 Common Commands

| Command | Description |
|----------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build production files |
| `npm run preview` | Preview production build |
| `npm run deploy` | Deploy `dist/` to GitHub Pages |
| `npm run publish` | Build and deploy in one command |

---

# 📚 Tech Stack

- HTML5
- CSS3
- JavaScript (ES Modules)
- Three.js
- Vite
- Git
- GitHub Pages


---

## ⭐ Support

If you enjoyed this project, consider giving it a ⭐ on GitHub.

It helps others discover the project and supports future improvements.

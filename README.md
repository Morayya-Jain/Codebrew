# Walking Through Country

An interactive 2D exploration game that teaches Aboriginal Australian culture and heritage through landmark discovery and storytelling. Set on the lands of the Kulin Nation in Victoria, players walk through a procedurally generated landscape, encounter sacred sites and gathering places, and read rich cultural narratives about each location.

Built with **Phaser 3**, **TypeScript**, and **Vite**.

## Gameplay

- **Explore** a 2000x1600 pixel world using WASD or arrow keys
- **Discover** 6 culturally significant landmarks (Sacred Waterhole, Rock Art Gallery, Corroboree Ground, Bush Tucker Trail, Songline Path, Campfire Gathering Place)
- **Read stories** by pressing E when near a landmark — each has a multi-paragraph narrative about its cultural significance
- **Listen** to stories via built-in Text-to-Speech narration
- **Track progress** with a visual indicator showing how many of the 6 landmarks you've discovered

### Proximity System

Landmarks reveal themselves as the player approaches:

| Distance | State | Visual |
|----------|-------|--------|
| > 400px | Hidden | Nothing visible |
| 250-400px | Far | Faint icon and name |
| 130-250px | Mid | Pulsing label with description |
| < 130px | Near | Full label + "Press E" prompt |

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| [Phaser](https://phaser.io) | 3.90.0 | 2D game framework (rendering, physics, input, scenes) |
| [TypeScript](https://www.typescriptlang.org) | 5.7.2 | Type-safe development |
| [Vite](https://vitejs.dev) | 6.3.1 | Dev server with HMR + production bundler |
| [Terser](https://terser.org) | 5.39.0 | Production minification |

**Browser APIs used:** Web Speech API (Text-to-Speech)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (for npm)

### Install & Run

```bash
npm install
npm run dev
```

Opens at `http://localhost:8080` with hot-reloading.

### Production Build

```bash
npm run build
```

Output goes to `dist/`. Upload its contents to any static web host.

## Project Structure

```
src/
├── main.ts                     # App bootstrap
├── game/
│   ├── main.ts                 # Phaser game config & scene registration
│   ├── types.ts                # Interfaces, types, game constants
│   ├── data/
│   │   └── landmarks.json      # 6 landmark entries (positions, stories, colors)
│   ├── entities/
│   │   ├── Player.ts           # Player movement, animation, physics
│   │   └── Landmark.ts         # Landmark sprite + proximity detection
│   ├── scenes/
│   │   ├── BootScene.ts        # Procedural asset generation (sprites, icons)
│   │   ├── PreloadScene.ts     # Loading screen + asset preloading
│   │   ├── TitleScene.ts       # Animated title screen with cultural acknowledgement
│   │   ├── GameScene.ts        # Main gameplay (world, player, landmarks, particles)
│   │   └── UIScene.ts          # HUD overlay (progress dots, hints)
│   └── ui/
│       ├── FloatingLabel.ts    # Proximity-aware labels above landmarks
│       ├── StoryCard.ts        # Modal for reading landmark stories
│       └── TTSManager.ts       # Web Speech API wrapper
├── styles/
│   └── story-card.css          # Story card modal styles
└── vite-env.d.ts

public/
├── assets/
│   └── landmarks.json          # Landmark data (served statically)
├── style.css                   # Global page styles
└── favicon.png

vite/
├── config.dev.mjs              # Dev server config
└── config.prod.mjs             # Production build config (Terser, chunking)
```

## Scene Flow

```
BootScene → PreloadScene → TitleScene → GameScene + UIScene (parallel)
```

1. **BootScene** — generates all sprites and icon textures procedurally (no external image assets)
2. **PreloadScene** — loads `landmarks.json`, creates animations, shows loading bar
3. **TitleScene** — animated intro with cultural acknowledgement of the Kulin Nation
4. **GameScene** — main gameplay with landscape, player, landmarks, and ambient particles
5. **UIScene** — runs as an overlay on top of GameScene for HUD elements

## Data

Landmark data lives in `src/game/data/landmarks.json`. Each landmark has:

```json
{
  "id": "unique-id",
  "name": "Display Name",
  "shortDescription": "Brief text shown on proximity labels",
  "fullStory": "Multi-paragraph narrative shown in the story modal",
  "position": { "x": 1000, "y": 800 },
  "iconColor": "#hex",
  "illustrationColor": "#hex"
}
```

All 6 landmarks are culturally themed around Aboriginal Australian heritage: campfire storytelling, sacred waterholes, ancient rock art, corroboree ceremonies, bush tucker, and songlines.

## License

See repository for license details.

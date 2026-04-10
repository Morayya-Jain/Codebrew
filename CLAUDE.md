# CLAUDE.md

## Project Overview

**Walking Through Country** — a Phaser 3 + TypeScript educational exploration game about Aboriginal Australian culture on the Kulin Nation lands. Players walk through a 2D landscape, discover 6 landmarks, and read cultural narratives.

## Quick Reference

- **Dev server:** `npm run dev` (port 8080)
- **Build:** `npm run build` (output: `dist/`)
- **No test suite configured yet**
- **No linter/formatter configured yet**
- **TypeScript strict mode is ON** (`tsconfig.json`)

## Architecture

### Scene Pipeline

```
BootScene → PreloadScene → TitleScene → GameScene + UIScene (overlay)
```

- **BootScene** (`src/game/scenes/BootScene.ts`) — procedurally generates ALL visual assets (player sprites, landmark icons) using Phaser Graphics. No external image files are loaded.
- **PreloadScene** (`src/game/scenes/PreloadScene.ts`) — loads `landmarks.json`, creates sprite animations, shows loading bar.
- **TitleScene** (`src/game/scenes/TitleScene.ts`) — animated title with cultural acknowledgement. 2-second input delay to prevent accidental skip.
- **GameScene** (`src/game/scenes/GameScene.ts`) — **main scene**. Creates the world (sky, hills, trees, path, rocks, grass), spawns Player + 6 Landmarks, handles E-key interaction to open story cards. Camera follows player.
- **UIScene** (`src/game/scenes/UIScene.ts`) — runs in parallel with GameScene as an overlay. Manages progress dots (top-right), hint text, and pause/resume when story cards are open.

### Key Entities

- **Player** (`src/game/entities/Player.ts`) — handles WASD/arrow input, physics body, walk/idle animation, world bounds collision. Speed: 200px/s.
- **Landmark** (`src/game/entities/Landmark.ts`) — each landmark has a proximity detection system. Updates distance to player every frame and emits proximity state changes.

### UI Components

- **FloatingLabel** (`src/game/ui/FloatingLabel.ts`) — text label above each landmark. Visibility and content change based on `ProximityState` (hidden/far/mid/near).
- **StoryCard** (`src/game/ui/StoryCard.ts`) — HTML/CSS modal overlay for reading full stories. Injected into the DOM, not rendered via Phaser canvas.
- **TTSManager** (`src/game/ui/TTSManager.ts`) — wraps Web Speech API for "Read Aloud" feature in story cards.

### Types & Constants

All in `src/game/types.ts`:
- `LandmarkData` interface — shape of each landmark entry
- `LandmarksFile` interface — wrapper for the JSON array
- `ProximityState` — `'hidden' | 'far' | 'mid' | 'near'`
- `CONSTANTS` — frozen object with world dimensions (2000x1600), player speed (200), proximity thresholds (400/250/130)

### Data

- `src/game/data/landmarks.json` — authoritative source for all 6 landmarks (id, name, descriptions, story text, position, colors)
- `public/assets/landmarks.json` — copy served statically (loaded at runtime by PreloadScene)
- **Keep both files in sync** when editing landmark data

## Common Tasks

### Adding a new landmark
1. Add entry to `src/game/data/landmarks.json` (and `public/assets/landmarks.json`)
2. BootScene auto-generates icon textures for all landmarks in the JSON — no code changes needed there
3. GameScene reads from the loaded JSON and spawns landmarks dynamically
4. Update UIScene progress count if the total changes (currently hardcoded to 6 in a few places)

### Modifying proximity behavior
- Thresholds are in `CONSTANTS` (`src/game/types.ts`)
- Visual behavior per state is in `FloatingLabel.ts`
- Detection logic is in `Landmark.ts`

### Changing world generation
- All procedural landscape (sky, stars, hills, trees, path, rocks, grass) is in `GameScene.ts` `create()` method
- Player sprite generation is in `BootScene.ts`

### Styling the story card modal
- `src/styles/story-card.css` for CSS
- `src/game/ui/StoryCard.ts` for structure/behavior

## Gotchas

- **No external image assets** — everything is procedurally generated in BootScene. Don't look for sprite sheets or image files.
- **Two copies of landmarks.json** — `src/game/data/` and `public/assets/`. The runtime loads from `public/assets/`. Both must stay in sync.
- **StoryCard is DOM-based**, not Phaser — it creates HTML elements directly. Styling is in a separate CSS file, not in the Phaser render pipeline.
- **UIScene runs as a parallel overlay** on top of GameScene, not as a sequential scene. It uses Phaser's `scene.launch()` pattern.
- **TitleScene has a 2-second input lock** — intentional UX choice to prevent skipping the cultural acknowledgement.
- **Progress tracking is hardcoded to 6** in UIScene — if you add landmarks, search for the number 6 in UIScene and update accordingly.

## Tech Stack

- **Phaser 3.90.0** — game framework (rendering, physics, input, scenes)
- **TypeScript 5.7.2** — strict mode
- **Vite 6.3.1** — dev server + bundler
- **Terser 5.39.0** — production minification
- **Web Speech API** — browser-native TTS (no external dependency)

# Walking Through Country - Painted Asset Brief

This document describes the painted PNG assets that can optionally replace
the procedural Phaser Graphics fallback in the game.

**You can ship the game with zero painted assets** - every slot has a
procedural BootScene fallback. Drop any individual PNG into the matching
path and it upgrades the game on next page reload, no code changes needed.

## Delivery rules

- **Format:** PNG with transparency (alpha channel).
- **Keyspace:** painted assets live under `painted-` prefixed texture keys
  to avoid collision with the procedural ones. The file path determines the
  key automatically - do not rename keys.
- **Drop location:** `public/assets/{subfolder}/{filename}`
- **Fallback safety:** missing files fall through `PreloadScene`'s
  `loaderror` handler silently. Never fails a scene.

## Art direction

- **Reference games:** RiME, Firewatch, The Pathless. Painted realism, not
  cartoon. Atmospheric perspective (distant things desaturate and lift).
- **Palette:** warm ochre dominant, cool shadow complement. Must sit under
  the `TimeOfDay` multiplicative tints without losing readability at night.
- **Style:** soft, painterly, slightly impressionistic. Not pixel art.
- **Readability:** silhouettes must hold at 64x64 viewport scale - this is
  a game where players can see a landmark across an 8000x6400 world map.

## Asset table

### Player character

| Key | Path | Size | Frames | Notes |
|---|---|---|---|---|
| `painted-player-walk` | `public/assets/player/player_walk.png` | sprite sheet, 256x64 (4 x 64) | 4 walk frames | Frame 0 doubles as idle. 3/4 perspective, base at feet. |
| `painted-player-idle` | `public/assets/player/player_idle.png` | 64x64 | 1 | Optional - if absent, walk frame 0 is used as idle. |

Character framing: ungendered walking figure. Face not detailed. Neutral
clothing. The player is framed as a respectful visitor, not a member of
the Kulin Nation.

### Trees

| Key | Path | Size | Notes |
|---|---|---|---|
| `painted-tree-redgum` | `public/assets/trees/tree_redgum.png` | 256x384 | River red gum, broad canopy |
| `painted-tree-yellowbox` | `public/assets/trees/tree_yellowbox.png` | 256x384 | Yellow box, taller profile |
| `painted-tree-mannagum` | `public/assets/trees/tree_mannagum.png` | 256x384 | Manna gum, narrower |
| `painted-tree-snag` | `public/assets/trees/tree_snag.png` | 256x384 | Dead standing tree, bare |

Origin: base of trunk at bottom-center. The game will set origin to (0.5, 0.97).
Scale range in-world is 0.7-1.25 so deliver at the upper end of that range.

### Rocks

| Key | Path | Size |
|---|---|---|
| `painted-rock-1` | `public/assets/rocks/rock_1.png` | 128x96 |
| `painted-rock-2` | `public/assets/rocks/rock_2.png` | 128x96 |
| `painted-rock-3` | `public/assets/rocks/rock_3.png` | 128x96 |

Origin: base of rock at (0.5, 0.85) - sits slightly below visual centre so
the rock "sits on" the ground plane.

**Important:** Phase C's rock refactor uses a sprite path only when at
least one painted rock PNG is loaded. Delivering any one triggers the
sprite path. If you deliver none, the procedural Graphics rocks continue
to render identically to today.

### Fauna

| Key | Path | Size | Notes |
|---|---|---|---|
| `painted-fauna-kangaroo-0` | `public/assets/fauna/fauna_kangaroo_0.png` | 160x144 | Idle / standing pose |
| `painted-fauna-kangaroo-1` | `public/assets/fauna/fauna_kangaroo_1.png` | 160x144 | Hop pose |
| `painted-fauna-emu-0` | `public/assets/fauna/fauna_emu_0.png` | 120x200 | Idle |
| `painted-fauna-emu-1` | `public/assets/fauna/fauna_emu_1.png` | 120x200 | Stride |
| `painted-fauna-cockatoo-0` | `public/assets/fauna/fauna_cockatoo_0.png` | 80x80 | Perched |
| `painted-fauna-cockatoo-1` | `public/assets/fauna/fauna_cockatoo_1.png` | 80x80 | Wings out |

Origin: base of animal at (0.5, 0.95). Two-frame animations swap at 520ms.

### Ground tiles

| Key | Path | Size | Notes |
|---|---|---|---|
| `painted-ground-loam` | `public/assets/ground/ground_loam.png` | 512x512 | Tiling base ground - dark warm earth |
| `painted-ground-grass` | `public/assets/ground/ground_grass.png` | 512x512 | Tiling grass overlay |
| `painted-ground-litter` | `public/assets/ground/ground_litter.png` | 512x512 | Tiling leaf-litter overlay |

Must tile seamlessly left-right and top-bottom. The game tiles them across
the entire 8000x6400 world - visible tile repeats are very obvious.

### Landmark hero scenes (legacy path, already working)

Drop 1024x1024 PNGs into `public/assets/landmarks/{id}.png` with optional
`{id}_bg.png` and `{id}_fg.png` for foreground/background layering. The
IDs are the landmark keys from `landmarks.json`:

- `campfire`, `waterhole`, `rock_art`, `corroboree_ground`, `bush_tucker`,
  `songline`, `ancestor_tree`, `grinding_stones`, `emu_dreaming`, `possum_cloak`

These are the "story card illustrations" and the in-world landmark sprites.

### Parallax backgrounds (per chapter)

Three layers per chapter, covering the whole 8000x6400 world (aspect 1.25:1).

| Key pattern | Path pattern |
|---|---|
| `painted-bg-{chapterId}-far` | `public/assets/bg/{chapterId}_far.png` |
| `painted-bg-{chapterId}-mid` | `public/assets/bg/{chapterId}_mid.png` |
| `painted-bg-{chapterId}-haze` | `public/assets/bg/{chapterId}_haze.png` |

Chapter IDs:
- `the-campfire-welcome` (dusk, warm)
- `following-water` (cold dawn, misty)
- `reading-the-stone` (overcast morning)
- `the-emu-in-the-sky` (twilight, stars visible)
- `caring-for-country` (warm midday, heat shimmer)
- `corroboree-night` (night, firelit)

Size: 8000x6400 (the full world bounds). Layers scroll at 0.05/0.12/0.28
scroll factors, so the far layer feels most distant.

## Loading guarantees

- **All loads are optional.** The game never requires any of these files.
- **Phantom placeholder avoidance:** the `SpriteFactory.hasPainted(key)`
  check requires `source.width > 1 && source.height > 1`, so a broken
  or partial load does not flip the game to the painted path.
- **PreloadScene's `loaderror` handler** tolerates any `painted-*` key
  silently. Console will not warn for missing painted files.

## Testing your delivery

1. Drop the PNG(s) into `public/assets/{subfolder}/`
2. Run `npm run dev`
3. Open the game at `http://localhost:8080`
4. Pick a chapter and walk into the world

To verify a specific asset upgraded correctly, open the browser DevTools
console and run:

```js
__wtcGame.scene.keys.GameScene.spriteFactory_.hasPainted('tree-redgum');
// returns true if painted-tree-redgum.png loaded successfully
```

import { Scene } from 'phaser';
import { Player, PLAYER_EVENTS } from '../entities/Player';
import { Landmark } from '../entities/Landmark';
import { CONSTANTS } from '../types';
import type { LandmarkData, LandmarksFile } from '../types';
import { PostFxPipeline } from '../fx/PostFxPipeline';
import { timeOfDay } from '../systems/TimeOfDay';
import { AmbientAudio } from '../systems/AmbientAudio';
import { windSystem } from '../systems/WindSystem';

interface AmbientParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    size: number;
    life: number;
    maxLife: number;
}

interface BarrierDef {
    x: number;
    y: number;
    width: number;
    height: number;
    isCircle?: boolean;
    radius?: number;
}

export class GameScene extends Scene {
    private player!: Player;
    private landmarks: Landmark[] = [];
    private barriers!: Phaser.Physics.Arcade.StaticGroup;
    private interactKey!: Phaser.Input.Keyboard.Key;
    private nearestLandmark: Landmark | null = null;
    private isPaused = false;
    private ambientParticles: AmbientParticle[] = [];
    private particleGraphics!: Phaser.GameObjects.Graphics;
    private landmarkPositions: Array<{ x: number; y: number; id: string; iconColor: string }> = [];
    private leadOffsetX_ = 0;
    private leadOffsetY_ = 0;
    private postFx_: PostFxPipeline | null = null;
    private audio_: AmbientAudio | null = null;
    private grassTufts_: Phaser.GameObjects.Image[] = [];
    private riverShimmers_: Phaser.GameObjects.Graphics[] = [];
    private riverShimmerPhase_ = 0;

    constructor() {
        super('GameScene');
    }

    create(): void {
        const { WORLD_WIDTH, WORLD_HEIGHT } = CONSTANTS;

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // Create landscape layers
        this.createGroundBase(WORLD_WIDTH, WORLD_HEIGHT);
        this.createGroundVariation(WORLD_WIDTH, WORLD_HEIGHT);
        this.createHills(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRiver(WORLD_WIDTH, WORLD_HEIGHT);
        this.createPaths();
        this.createAmbientDetails(WORLD_WIDTH, WORLD_HEIGHT);

        // Create collision barrier group
        this.barriers = this.physics.add.staticGroup();

        // Draw terrain features AND create collision bodies
        this.createTrees(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRocks(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRiverCollisions();
        this.createBoundaryFade(WORLD_WIDTH, WORLD_HEIGHT);
        this.createGrassField(WORLD_WIDTH, WORLD_HEIGHT);

        // Ambient particles (fireflies/dust)
        this.particleGraphics = this.add.graphics();
        this.particleGraphics.setDepth(8);
        this.initAmbientParticles(WORLD_WIDTH, WORLD_HEIGHT);

        // Create player near center campfire
        this.player = new Player(this, 4000, 3400);

        // Register collider AFTER player exists
        this.physics.add.collider(this.player, this.barriers);

        // Setup camera
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
        this.cameras.main.setBackgroundColor(timeOfDay.palette.letterboxColor);

        // Register and attach the post-FX pipeline (WebGL only; graceful skip on Canvas)
        this.attachPostFxPipeline();

        // Load landmarks from JSON
        const landmarksData = this.cache.json.get('landmarks') as LandmarksFile | null;
        if (landmarksData) {
            this.landmarks = landmarksData.landmarks.map(
                (data: LandmarkData) => new Landmark(this, data)
            );
            this.landmarkPositions = landmarksData.landmarks.map(d => ({
                x: d.position.x, y: d.position.y, id: d.id, iconColor: d.iconColor,
            }));
        }

        // Interaction key
        if (this.input.keyboard) {
            this.interactKey = this.input.keyboard.addKey('E');
        }

        // Ambient audio — Web Audio synth, no asset files.
        this.audio_ = new AmbientAudio(this);
        // Register a point source per landmark so nearby ones drive biome bed.
        for (const p of this.landmarkPositions) {
            if (p.id === 'campfire') this.audio_.addPointSource(p.x, p.y, 'fire');
        }
        // River positional source — sample a handful of midpoints from the meander.
        const riverSamples: Array<readonly [number, number]> = [
            [1200, 2100], [2600, 2800], [4000, 3800], [5400, 4400], [6800, 4900],
        ];
        for (const [rx, ry] of riverSamples) this.audio_.addPointSource(rx, ry, 'water');

        // Start audio on the very first user input (autoplay policy compliant).
        const onFirstInput = (): void => {
            this.audio_?.start();
        };
        this.input.keyboard?.once('keydown', onFirstInput);
        this.input.once('pointerdown', onFirstInput);

        // Mute toggle: M key
        this.input.keyboard?.on('keydown-M', () => {
            this.audio_?.toggleMute();
        });

        // Footsteps: react to Player step events
        this.events.on(PLAYER_EVENTS.STEP, () => {
            this.audio_?.step('dirt');
        });

        // Tear audio down when the scene shuts down so we don't leak oscillators.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.audio_?.destroy();
            this.audio_ = null;
        });

        // Launch UI scene as overlay
        this.scene.launch('UIScene');

        // Listen for resume event — add cooldown to prevent E key retriggering
        this.events.on('resume', () => {
            this.time.delayedCall(200, () => {
                this.isPaused = false;
            });
        });

        // Fade in
        this.cameras.main.fadeIn(800, 10, 6, 3);
    }

    update(_time: number, delta: number): void {
        if (this.isPaused) return;

        this.player.update();
        windSystem.tick(delta);
        this.updateAmbientParticles(delta);
        this.updateGrassWind_();
        this.updateRiverShimmer_(delta);
        this.updateCameraPolish();
        this.audio_?.update(this.player.x, this.player.y, delta);

        // Update landmark proximity
        this.nearestLandmark = null;
        let nearestDist = Infinity;

        this.landmarks.forEach(landmark => {
            landmark.updateProximity(this.player.x, this.player.y);

            if (landmark.isNear) {
                const dist = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y,
                    landmark.data_.position.x, landmark.data_.position.y
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    this.nearestLandmark = landmark;
                }
            }
        });

        // Handle interaction
        if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey) && this.nearestLandmark) {
            this.openStoryCard(this.nearestLandmark.data_);
        }
    }

    // Public getters for UIScene / MiniMap
    getPlayerPosition(): { x: number; y: number } {
        if (!this.player) return { x: 4000, y: 3400 };
        return { x: this.player.x, y: this.player.y };
    }

    getLandmarkPositions(): ReadonlyArray<{ x: number; y: number; id: string; iconColor: string }> {
        return this.landmarkPositions;
    }

    private openStoryCard(data: LandmarkData): void {
        this.isPaused = true;
        this.player.setVelocity(0, 0);

        const uiScene = this.scene.get('UIScene');
        uiScene.events.emit('openStoryCard', data);

        this.scene.pause();
    }

    private attachPostFxPipeline(): void {
        const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        if (!renderer || renderer.type !== Phaser.WEBGL || !renderer.pipelines) {
            return;
        }
        // addPostPipeline is idempotent — internal `postPipelineClasses.has()` guard
        // protects against double-registration when the scene is restarted.
        renderer.pipelines.addPostPipeline('PostFxPipeline', PostFxPipeline);
        this.cameras.main.setPostPipeline('PostFxPipeline');
        const pipe = this.cameras.main.getPostPipeline('PostFxPipeline');
        const instance = Array.isArray(pipe) ? pipe[0] : pipe;
        if (instance instanceof PostFxPipeline) {
            instance.applyPalette(timeOfDay.palette);
            this.postFx_ = instance;
        }
        // React to time-of-day changes in later phases (Phase 6 animates).
        const handlePaletteChange = (): void => {
            this.postFx_?.applyPalette(timeOfDay.palette);
            this.cameras.main.setBackgroundColor(timeOfDay.palette.letterboxColor);
        };
        timeOfDay.on('change', handlePaletteChange);
        // Remove THIS listener only — `off('change')` without a handler would
        // also kill listeners registered by other scenes in later phases.
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            timeOfDay.off('change', handlePaletteChange);
        });
    }

    private createGrassField(width: number, height: number): void {
        const rng = this.createSeededRandom(311);
        // Scatter ~420 tufts; a fifth sit above player depth so the player walks
        // through them (the near-edge ones feel "physical" — this is the single
        // cheapest way to kill the flat top-down reading of the scene).
        const count = 420;
        for (let i = 0; i < count; i++) {
            const x = rng() * width;
            const y = rng() * height;

            // Avoid placing on paths/river/landmarks by staying clear of the
            // central campfire clearing radius.
            const cdx = x - 4000;
            const cdy = y - 3200;
            if (cdx * cdx + cdy * cdy < 180 * 180) continue;

            const tuft = this.add.image(x, y, 'grass-tuft');
            const scale = 0.7 + rng() * 0.75;
            tuft.setOrigin(0.5, 0.9);
            tuft.setScale(scale);
            tuft.setAlpha(0.8 + rng() * 0.15);
            // Depth-sort by world Y (so things further down are drawn later).
            // Foreground layer: draw above player (depth 5) for tufts the player
            // should visually walk through.
            const foreground = rng() < 0.35;
            tuft.setDepth(foreground ? 6.5 + y * 0.00001 : 1.2);
            tuft.setData('windPhase', rng() * Math.PI * 2);
            tuft.setData('baseScaleX', scale);
            this.grassTufts_.push(tuft);
        }

        // Scatter bark flakes under tree clusters — small touches of realism.
        for (let i = 0; i < 110; i++) {
            const x = rng() * width;
            const y = rng() * height;
            const cdx = x - 4000;
            const cdy = y - 3200;
            if (cdx * cdx + cdy * cdy < 180 * 180) continue;
            const flake = this.add.image(x, y, 'bark-flake');
            flake.setOrigin(0.5, 0.8);
            flake.setRotation(rng() * Math.PI * 2);
            flake.setAlpha(0.7);
            flake.setDepth(1.1);
        }
    }

    private updateGrassWind_(): void {
        if (this.grassTufts_.length === 0) return;
        const { value, direction } = windSystem.sample();
        const shearX = Math.cos(direction) * 0.1 * value;
        // Soft sine noise per tuft drives per-blade wobble
        const t = this.time.now / 1000;
        for (let i = 0; i < this.grassTufts_.length; i++) {
            const tuft = this.grassTufts_[i];
            const phase = (tuft.getData('windPhase') as number) ?? 0;
            const base = (tuft.getData('baseScaleX') as number) ?? 1;
            const wobble = Math.sin(t * 2.1 + phase) * 0.06 * value;
            tuft.setScale(base * (1 + wobble), base);
            tuft.rotation = shearX + Math.sin(t + phase) * 0.04 * value;
        }
    }

    private updateRiverShimmer_(deltaMs: number): void {
        this.riverShimmerPhase_ += deltaMs / 1000;
        if (this.riverShimmers_.length === 0) return;
        for (let i = 0; i < this.riverShimmers_.length; i++) {
            const g = this.riverShimmers_[i];
            const a = 0.25 + 0.2 * Math.sin(this.riverShimmerPhase_ * 1.7 + i * 0.6);
            g.setAlpha(Math.max(0.1, Math.min(0.55, a)));
        }
    }

    private updateCameraPolish(): void {
        // NOTE: no breathing zoom. A non-integer setZoom forces bilinear filtering
        // on every sprite in the scene (including the post-FX render target copy)
        // which reads as softness/blur on retina displays. The look-ahead offset
        // only changes scroll, which is pixel-rounded by startFollow(..., true).

        // Look-ahead: camera leads player by up to 60px in movement direction.
        const body = this.player.body as Phaser.Physics.Arcade.Body | null;
        const vx = body?.velocity.x ?? 0;
        const vy = body?.velocity.y ?? 0;
        const len = Math.hypot(vx, vy);
        const targetX = len > 10 ? -(vx / len) * 60 : 0;
        const targetY = len > 10 ? -(vy / len) * 60 : 0;
        this.leadOffsetX_ += (targetX - this.leadOffsetX_) * 0.05;
        this.leadOffsetY_ += (targetY - this.leadOffsetY_) * 0.05;
        this.cameras.main.setFollowOffset(
            Math.round(this.leadOffsetX_),
            Math.round(this.leadOffsetY_),
        );
    }

    // =========================================================================
    // LANDSCAPE RENDERING
    // =========================================================================

    private createGroundBase(width: number, height: number): void {
        // Dense high-detail loam, tiled across the whole world.
        // The 512×512 source tile is generated procedurally in BootScene.
        const loam = this.add.tileSprite(width / 2, height / 2, width, height, 'ground-loam');
        loam.setDepth(0);
        loam.setOrigin(0.5, 0.5);

        // Low-frequency earth-tone variation on top so the tile repeat pattern
        // isn't perceptible. Keep the old ellipse patch system but softer.
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(42);
        for (let i = 0; i < 120; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 220 + rng() * 380;
            const colors = [0x443828, 0x302418, 0x3a3020, 0x342818, 0x483c2a];
            const lightness = colors[Math.floor(rng() * colors.length)];
            const alpha = 0.08 + rng() * 0.15;
            gfx.fillStyle(lightness, alpha);
            gfx.fillEllipse(px, py, patchSize, patchSize * (0.5 + rng() * 0.8));
        }
        for (let i = 0; i < 30; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 180 + rng() * 320;
            const isOlive = rng() > 0.5;
            gfx.fillStyle(isOlive ? 0x3a3a22 : 0x4a3028, 0.08 + rng() * 0.1);
            gfx.fillEllipse(px, py, patchSize, patchSize * 0.7);
        }
    }

    private createGroundVariation(width: number, height: number): void {
        // Two additional tileable biome layers alpha-blended over the loam:
        // a grass-blade layer in the wetter mid-world and a leaf-litter layer
        // under tree clusters. Tiling uses a mask graphic for soft-edged patches.

        const rng = this.createSeededRandom(99);

        // --- Grass biome patches (soft-edged via RenderTexture + alpha mask) ---
        const grassRT = this.add.renderTexture(0, 0, width, height);
        grassRT.setDepth(0);
        grassRT.setOrigin(0, 0);
        const grassMask = this.add.graphics();
        grassMask.fillStyle(0xffffff, 1);
        // Scatter 40 fat grass patches across the world
        for (let i = 0; i < 40; i++) {
            const cx = rng() * width;
            const cy = rng() * height;
            const r = 260 + rng() * 380;
            grassMask.fillCircle(cx, cy, r);
        }
        const grassTile = this.add.tileSprite(width / 2, height / 2, width, height, 'ground-grass');
        grassTile.setOrigin(0.5, 0.5);
        grassTile.setMask(grassMask.createGeometryMask());
        grassTile.setDepth(0);
        // Keep the mask graphics invisible — it exists only to clip the tile.
        grassMask.setVisible(false);

        // --- Leaf-litter biome patches, smaller and more clustered ---
        const litterMask = this.add.graphics();
        litterMask.fillStyle(0xffffff, 1);
        for (let i = 0; i < 70; i++) {
            const cx = rng() * width;
            const cy = rng() * height;
            const r = 120 + rng() * 220;
            litterMask.fillCircle(cx, cy, r);
        }
        const litterTile = this.add.tileSprite(width / 2, height / 2, width, height, 'ground-litter');
        litterTile.setOrigin(0.5, 0.5);
        litterTile.setMask(litterMask.createGeometryMask());
        litterTile.setDepth(0);
        litterMask.setVisible(false);

        // --- Darker undergrowth patches for contrast ---
        const gfx = this.add.graphics();
        gfx.setDepth(0);
        for (let i = 0; i < 40; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 60 + rng() * 140;
            gfx.fillStyle(0x1f2e14, 0.22);
            gfx.fillEllipse(px, py, patchSize, patchSize);
        }
    }

    private createHills(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(77);

        // 28 hills, dramatically larger and more visible than before.
        // Sun angle derived from TimeOfDay — placeholder Phase 3 uses Golden-hour
        // (sun from upper-left), Phase 6 will animate this.
        const sunAngle = timeOfDay.palette.sunAngle * (Math.PI / 180);
        const litOffsetX = -Math.cos(sunAngle) * 90;
        const litOffsetY = -Math.sin(sunAngle) * 40;

        for (let i = 0; i < 28; i++) {
            const hx = rng() * width;
            const hy = rng() * height;
            const hw = 420 + rng() * 520;
            const hh = hw * (0.42 + rng() * 0.22);

            // Main hill body — a warm dark earth mass so it actually reads.
            gfx.fillStyle(0x2a2218, 0.35);
            gfx.fillEllipse(hx, hy, hw, hh);

            // Shadow under / behind the hill.
            gfx.fillStyle(0x140e08, 0.42);
            gfx.fillEllipse(hx - litOffsetX * 0.6, hy - litOffsetY * 0.6, hw * 0.92, hh * 0.9);

            // Lit face — warmer ochre highlight, offset toward the sun.
            gfx.fillStyle(0x6a5030, 0.22);
            gfx.fillEllipse(hx + litOffsetX, hy + litOffsetY, hw * 0.7, hh * 0.55);

            // Peak highlight — small brighter cap where the light hits most.
            gfx.fillStyle(0x8a6838, 0.18);
            gfx.fillEllipse(hx + litOffsetX * 1.25, hy + litOffsetY * 1.25, hw * 0.35, hh * 0.3);

            // Break the silhouette with a few dark scrub patches on the body.
            const scrubCount = 3 + Math.floor(rng() * 3);
            for (let s = 0; s < scrubCount; s++) {
                const sx = hx + (rng() - 0.5) * hw * 0.6;
                const sy = hy + (rng() - 0.5) * hh * 0.5;
                gfx.fillStyle(0x1a2410, 0.28);
                gfx.fillEllipse(sx, sy, 40 + rng() * 70, 20 + rng() * 40);
            }
        }
    }

    private createRiver(_width: number, _height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(1);

        // River flows across the 8000px world with natural meander
        // Crossings are at specific points for gameplay navigation
        const riverPoints = [
            { x: 0, y: 2400 },
            { x: 400, y: 2480 },
            { x: 800, y: 2560 },
            { x: 1200, y: 2620 },
            { x: 1600, y: 2680 },
            // CROSSING 1: near waterhole path area (~1900)
            { x: 2100, y: 2720 },
            { x: 2500, y: 2700 },
            { x: 2900, y: 2660 },
            // CROSSING 2: west of campfire (~3200)
            { x: 3400, y: 2600 },
            { x: 3800, y: 2540 },
            // CROSSING 3: near campfire (~4100)
            { x: 4300, y: 2480 },
            { x: 4700, y: 2440 },
            { x: 5100, y: 2400 },
            // CROSSING 4: east of center (~5300)
            { x: 5500, y: 2350 },
            { x: 5900, y: 2280 },
            // CROSSING 5: near grinding stones (~6200)
            { x: 6400, y: 2200 },
            { x: 6800, y: 2140 },
            // CROSSING 6: far east (~7100)
            { x: 7300, y: 2080 },
            { x: 7600, y: 2020 },
            { x: 8000, y: 1960 },
        ];

        // River banks (drawn first, wider, underneath)
        gfx.lineStyle(56, 0x2a2018, 0.3);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Main river water — varying width effect via two overlapping strokes
        gfx.lineStyle(44, 0x1a4a6a, 0.6);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Inner lighter water
        gfx.lineStyle(28, 0x2a6a8a, 0.5);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Water shimmer: split into 3 alpha-animated layers so the river "moves".
        const shimmerRng = this.createSeededRandom(555);
        const shimmerLayerCount = 3;
        for (let layer = 0; layer < shimmerLayerCount; layer++) {
            const shimmerGfx = this.add.graphics();
            shimmerGfx.setDepth(1.2);
            for (let i = 0; i < riverPoints.length - 1; i++) {
                const p1 = riverPoints[i];
                const p2 = riverPoints[i + 1];
                for (let t = layer / shimmerLayerCount; t < 1; t += 0.25) {
                    const x = p1.x + (p2.x - p1.x) * t + (shimmerRng() - 0.5) * 24;
                    const y = p1.y + (p2.y - p1.y) * t + (shimmerRng() - 0.5) * 18;
                    const dashW = 6 + shimmerRng() * 10;
                    shimmerGfx.fillStyle(0x6aaacc, 0.22);
                    shimmerGfx.fillRect(x - dashW / 2, y, dashW, 2);
                    shimmerGfx.fillStyle(0x4a8aaa, 0.35);
                    shimmerGfx.fillCircle(
                        x + (shimmerRng() - 0.5) * 6,
                        y + (shimmerRng() - 0.5) * 4,
                        1.8,
                    );
                }
            }
            shimmerGfx.setAlpha(0.25 + layer * 0.1);
            this.riverShimmers_.push(shimmerGfx);
        }

        // Crossings — 6 crossing points
        const crossings = [
            { x: 1900, y: 2700 },
            { x: 3200, y: 2630 },
            { x: 4100, y: 2510 },
            { x: 5300, y: 2375 },
            { x: 6200, y: 2248 },
            { x: 7100, y: 2116 },
        ];

        crossings.forEach(({ x, y }) => {
            // Lighter ground at gap
            gfx.fillStyle(0x4a3a28, 0.6);
            gfx.fillEllipse(x, y, 100, 60);

            // Stepping stones with individual highlight
            const stones = [
                { dx: -20, dy: -6, r: 7 },
                { dx: 4, dy: 4, r: 8 },
                { dx: 28, dy: -4, r: 6 },
                { dx: -8, dy: 8, r: 5 },
            ];
            stones.forEach(({ dx, dy, r }) => {
                // Stone shadow
                gfx.fillStyle(0x000000, 0.1);
                gfx.fillCircle(x + dx + 2, y + dy + 2, r);
                // Stone body
                gfx.fillStyle(0x6a5a48, 0.75);
                gfx.fillCircle(x + dx, y + dy, r);
                // Stone highlight (NW)
                gfx.fillStyle(0x8a7a68, 0.4);
                gfx.fillCircle(x + dx - r * 0.25, y + dy - r * 0.25, r * 0.5);
            });

            // Dot art around crossing
            gfx.fillStyle(0xe8c170, 0.15);
            for (let a = 0; a < 10; a++) {
                const angle = (a / 10) * Math.PI * 2;
                gfx.fillCircle(x + Math.cos(angle) * 42, y + Math.sin(angle) * 28, 2);
            }
        });
    }

    private createPaths(): void {
        const gfx = this.add.graphics();
        gfx.setDepth(1);

        // Center campfire position
        const center = { x: 4000, y: 3200 };

        // Paths from center to each landmark
        const pathTargets = [
            { x: 1400, y: 1800 },   // Waterhole (NW)
            { x: 6600, y: 1400 },   // Rock Art (NE)
            { x: 6400, y: 5000 },   // Corroboree (SE)
            { x: 1600, y: 4800 },   // Bush Tucker (SW)
            { x: 4000, y: 800 },    // Songline (N)
            { x: 2800, y: 600 },    // Ancestor Tree (NW-N)
            { x: 5600, y: 2800 },   // Grinding Stones (E)
            { x: 3200, y: 5600 },   // Emu Dreaming (S)
            { x: 6800, y: 3800 },   // Possum Cloak (Far E)
        ];

        pathTargets.forEach(target => {
            this.drawDotPath(gfx, center.x, center.y, target.x, target.y);
        });

        // Connecting paths between nearby landmarks
        this.drawDotPath(gfx, 1400, 1800, 2800, 600);     // Waterhole -> Ancestor Tree
        this.drawDotPath(gfx, 2800, 600, 4000, 800);       // Ancestor Tree -> Songline
        this.drawDotPath(gfx, 4000, 800, 6600, 1400);      // Songline -> Rock Art
        this.drawDotPath(gfx, 6600, 1400, 5600, 2800);     // Rock Art -> Grinding Stones
        this.drawDotPath(gfx, 5600, 2800, 6800, 3800);     // Grinding Stones -> Possum Cloak
        this.drawDotPath(gfx, 6800, 3800, 6400, 5000);     // Possum Cloak -> Corroboree
        this.drawDotPath(gfx, 1600, 4800, 3200, 5600);     // Bush Tucker -> Emu Dreaming
        this.drawDotPath(gfx, 3200, 5600, 6400, 5000);     // Emu Dreaming -> Corroboree
        this.drawDotPath(gfx, 1400, 1800, 1600, 4800);     // Waterhole -> Bush Tucker

        // Central clearing around campfire
        gfx.fillStyle(0x4a3a28, 0.3);
        gfx.fillCircle(center.x, center.y, 100);
        gfx.fillStyle(0x5a4a38, 0.2);
        gfx.fillCircle(center.x, center.y, 65);

        // Dot-art ring around center
        gfx.fillStyle(0xe8c170, 0.12);
        for (let a = 0; a < 32; a++) {
            const angle = (a / 32) * Math.PI * 2;
            gfx.fillCircle(center.x + Math.cos(angle) * 85, center.y + Math.sin(angle) * 85, 3);
        }
        for (let a = 0; a < 20; a++) {
            const angle = (a / 20) * Math.PI * 2;
            gfx.fillCircle(center.x + Math.cos(angle) * 110, center.y + Math.sin(angle) * 110, 2);
        }
    }

    private drawDotPath(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
        const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
        const steps = Math.floor(dist / 45); // Larger step size = fewer draw calls

        // Path ground (worn earth)
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 10;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;
            const px = x + dx * perpOffset;
            const py = y + dy * perpOffset;

            gfx.fillStyle(0x3d2e1e, 0.3);
            gfx.fillCircle(px, py, 16);

            // Grass encroachment on edges (every other step)
            if (i % 2 === 0) {
                gfx.fillStyle(0x3a5a2a, 0.2);
                gfx.fillCircle(px + dx * 16, py + dy * 16, 3);
            }
        }

        // Dot-art trail along path (every 3rd step)
        gfx.fillStyle(0xe8c170, 0.18);
        for (let i = 0; i <= steps; i += 3) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 10;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;

            gfx.fillCircle(x + dx * perpOffset, y + dy * perpOffset, 3);

            // Two surrounding dots instead of four
            gfx.fillStyle(0xe8c170, 0.08);
            const angle1 = t * 2;
            gfx.fillCircle(x + dx * perpOffset + Math.cos(angle1) * 9, y + dy * perpOffset + Math.sin(angle1) * 9, 2);
            gfx.fillCircle(x + dx * perpOffset - Math.cos(angle1) * 9, y + dy * perpOffset - Math.sin(angle1) * 9, 2);
            gfx.fillStyle(0xe8c170, 0.18);
        }
    }

    private createAmbientDetails(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(2);

        const rng = this.createSeededRandom(333);

        // Fallen logs
        for (let i = 0; i < 12; i++) {
            const lx = 200 + rng() * (width - 400);
            const ly = 200 + rng() * (height - 400);
            const len = 20 + rng() * 35;
            const angle = rng() * Math.PI;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Log shadow
            gfx.fillStyle(0x000000, 0.1);
            gfx.fillEllipse(lx + 4 + cos * len / 2, ly + 4 + sin * len / 2, len, 6);

            // Log body
            gfx.fillStyle(0x4a3220, 0.5);
            const x1 = lx - cos * len / 2;
            const y1 = ly - sin * len / 2;
            const x2 = lx + cos * len / 2;
            const y2 = ly + sin * len / 2;
            // Draw as series of circles along the log
            for (let t = 0; t <= 1; t += 0.15) {
                const tx = x1 + (x2 - x1) * t;
                const ty = y1 + (y2 - y1) * t;
                gfx.fillCircle(tx, ty, 3);
            }

            // Bark highlight
            gfx.fillStyle(0x5a4230, 0.3);
            gfx.fillCircle(lx - cos * len * 0.2, ly - sin * len * 0.2, 2);
        }

        // Small puddles near river area
        for (let i = 0; i < 10; i++) {
            const px = 200 + rng() * (width - 400);
            // Bias puddles toward the river y-range (2000-2800)
            const py = 1800 + rng() * 1200;
            const pw = 8 + rng() * 14;
            const ph = pw * (0.5 + rng() * 0.3);

            // Puddle shadow
            gfx.fillStyle(0x000000, 0.05);
            gfx.fillEllipse(px + 2, py + 2, pw + 2, ph + 2);

            // Puddle water
            gfx.fillStyle(0x2a5a7a, 0.2);
            gfx.fillEllipse(px, py, pw, ph);

            // Reflection highlight
            gfx.fillStyle(0x4a8aaa, 0.15);
            gfx.fillEllipse(px - pw * 0.15, py - ph * 0.15, pw * 0.4, ph * 0.4);
        }
    }

    // =========================================================================
    // COLLISION BARRIERS
    // =========================================================================

    private createTrees(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(6);

        const treeShadowGfx = this.add.graphics();
        treeShadowGfx.setDepth(2);

        const rng = this.createSeededRandom(123);

        // Landmark positions to avoid (with clearance radius)
        const landmarkZones = [
            { x: 4000, y: 3200 }, { x: 1400, y: 1800 }, { x: 6600, y: 1400 },
            { x: 6400, y: 5000 }, { x: 1600, y: 4800 }, { x: 4000, y: 800 },
            { x: 2800, y: 600 }, { x: 5600, y: 2800 }, { x: 3200, y: 5600 },
            { x: 6800, y: 3800 },
        ];

        const clearance = 160;
        const treeCount = 80;
        let placed = 0;
        let attempts = 0;

        while (placed < treeCount && attempts < treeCount * 4) {
            attempts++;
            const tx = 150 + rng() * (width - 300);
            const ty = 150 + rng() * (height - 300);
            const treeSize = 22 + rng() * 16;

            // Check clearance from landmarks
            const tooClose = landmarkZones.some(
                lz => Math.abs(tx - lz.x) < clearance && Math.abs(ty - lz.y) < clearance
            );
            if (tooClose) continue;

            this.drawTopDownTree(gfx, treeShadowGfx, tx, ty, treeSize);
            this.addBarrier({ x: tx, y: ty, width: 0, height: 0, isCircle: true, radius: treeSize * 0.5 });
            placed++;
        }
    }

    private drawTopDownTree(
        canopyGfx: Phaser.GameObjects.Graphics,
        shadowGfx: Phaser.GameObjects.Graphics,
        x: number, y: number, size: number
    ): void {
        // Cast shadow (SE offset)
        shadowGfx.fillStyle(0x000000, 0.12);
        shadowGfx.fillEllipse(x + 8, y + 10, size * 2.2, size * 1.6);

        // Outer canopy (wider than tall for isometric feel)
        canopyGfx.fillStyle(0x1a3a16, 0.75);
        canopyGfx.fillEllipse(x, y, size * 2, size * 1.6);

        // Mid canopy + highlight combined
        canopyGfx.fillStyle(0x2a4a22, 0.6);
        canopyGfx.fillEllipse(x - size * 0.15, y - size * 0.12, size * 1.4, size * 1.1);

        // NW highlight
        canopyGfx.fillStyle(0x3a6a2a, 0.4);
        canopyGfx.fillEllipse(x - size * 0.3, y - size * 0.25, size * 0.8, size * 0.6);

        // Trunk center dot
        canopyGfx.fillStyle(0x2a1a10, 0.5);
        canopyGfx.fillCircle(x, y, size * 0.15);
    }

    private createRocks(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(3);

        const rng = this.createSeededRandom(456);

        const landmarkZones = [
            { x: 4000, y: 3200 }, { x: 1400, y: 1800 }, { x: 6600, y: 1400 },
            { x: 6400, y: 5000 }, { x: 1600, y: 4800 }, { x: 4000, y: 800 },
            { x: 2800, y: 600 }, { x: 5600, y: 2800 }, { x: 3200, y: 5600 },
            { x: 6800, y: 3800 },
        ];

        const clearance = 140;
        const rockTarget = 30;
        let placedRocks = 0;
        let rockAttempts = 0;

        while (placedRocks < rockTarget && rockAttempts < rockTarget * 4) {
            rockAttempts++;
            const cx = 200 + rng() * (width - 400);
            const cy = 200 + rng() * (height - 400);

            const tooClose = landmarkZones.some(
                lz => Math.abs(cx - lz.x) < clearance && Math.abs(cy - lz.y) < clearance
            );
            if (tooClose) continue;
            placedRocks++;

            const rockCount = 1 + Math.floor(rng() * 3);
            for (let r = 0; r < rockCount; r++) {
                const rx = cx + (rng() - 0.5) * 40;
                const ry = cy + (rng() - 0.5) * 30;
                const rw = 22 + rng() * 18;
                const rh = rw * (0.55 + rng() * 0.25);

                // Rock shadow (SE)
                gfx.fillStyle(0x000000, 0.12);
                gfx.fillEllipse(rx + 6, ry + 6, rw + 4, rh + 4);

                // Rock body
                gfx.fillStyle(0x5a4a38, 0.75);
                gfx.fillEllipse(rx, ry, rw, rh);

                // Light side (NW — upper-left)
                gfx.fillStyle(0x8a7a68, 0.35);
                gfx.fillEllipse(rx - rw * 0.18, ry - rh * 0.18, rw * 0.55, rh * 0.5);

                // Dark side (SE — lower-right)
                gfx.fillStyle(0x3a2a1a, 0.25);
                gfx.fillEllipse(rx + rw * 0.15, ry + rh * 0.15, rw * 0.5, rh * 0.45);

                // Highlight spot
                gfx.fillStyle(0x9a8a78, 0.2);
                gfx.fillCircle(rx - rw * 0.25, ry - rh * 0.25, rw * 0.15);

                // Crack texture lines
                gfx.lineStyle(0.5, 0x3a3028, 0.3);
                gfx.beginPath();
                gfx.moveTo(rx - rw * 0.2, ry);
                gfx.lineTo(rx + rw * 0.15, ry + rh * 0.1);
                gfx.strokePath();

                // Collision body
                this.addBarrier({ x: rx, y: ry, width: rw, height: rh });
            }
        }
    }

    private createRiverCollisions(): void {
        // River collision uses small sub-segments that follow the diagonal path
        // 6 crossing gaps (~140px wide each)
        // Crossings at x: 1900, 3200, 4100, 5300, 6200, 7100

        // River path points (same as visual river)
        const riverPath = [
            { x: 0, y: 2400 }, { x: 400, y: 2480 }, { x: 800, y: 2560 },
            { x: 1200, y: 2620 }, { x: 1600, y: 2680 },
            { x: 2100, y: 2720 }, { x: 2500, y: 2700 }, { x: 2900, y: 2660 },
            { x: 3400, y: 2600 }, { x: 3800, y: 2540 },
            { x: 4300, y: 2480 }, { x: 4700, y: 2440 }, { x: 5100, y: 2400 },
            { x: 5500, y: 2350 }, { x: 5900, y: 2280 },
            { x: 6400, y: 2200 }, { x: 6800, y: 2140 },
            { x: 7300, y: 2080 }, { x: 7600, y: 2020 }, { x: 8000, y: 1960 },
        ];

        // Crossing zones (x-ranges where no collision should exist)
        const crossingGaps = [
            { xMin: 1830, xMax: 1970 },
            { xMin: 3130, xMax: 3270 },
            { xMin: 4030, xMax: 4170 },
            { xMin: 5230, xMax: 5370 },
            { xMin: 6130, xMax: 6270 },
            { xMin: 7030, xMax: 7170 },
        ];

        // Generate small collision segments between each pair of river points
        const segWidth = 200;
        for (let i = 0; i < riverPath.length - 1; i++) {
            const p1 = riverPath[i];
            const p2 = riverPath[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const subSteps = Math.max(1, Math.ceil(Math.abs(dx) / segWidth));

            for (let s = 0; s < subSteps; s++) {
                const t1 = s / subSteps;
                const t2 = (s + 1) / subSteps;
                const sx = p1.x + dx * ((t1 + t2) / 2);
                const sy = p1.y + dy * ((t1 + t2) / 2);
                const sw = Math.abs(dx) / subSteps;

                // Skip if this sub-segment overlaps a crossing gap
                const segLeft = sx - sw / 2;
                const segRight = sx + sw / 2;
                const inGap = crossingGaps.some(
                    g => segRight > g.xMin && segLeft < g.xMax
                );
                if (inGap) continue;

                this.addBarrier({ x: sx, y: sy, width: sw + 10, height: 42 });
            }
        }
    }

    private createBoundaryFade(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(7);

        const fadeWidth = 200;
        const strips = 10;

        for (let i = 0; i < strips; i++) {
            const t = 1 - (i / strips);
            const alpha = t * t * 0.65; // Opaque at edge, fading to transparent inward
            const stripSize = fadeWidth / strips;

            gfx.fillStyle(0x2a3a22, alpha);

            // Top edge (strip 0 = outermost = most opaque)
            gfx.fillRect(0, i * stripSize, width, stripSize);
            // Bottom edge
            gfx.fillRect(0, height - (i + 1) * stripSize, width, stripSize);
            // Left edge
            gfx.fillRect(i * stripSize, 0, stripSize, height);
            // Right edge
            gfx.fillRect(width - (i + 1) * stripSize, 0, stripSize, height);
        }

        // Very faint dotted boundary line
        gfx.fillStyle(0x4a6a3a, 0.12);
        const dotSpacing = 80;
        // Top
        for (let x = 0; x < width; x += dotSpacing) {
            gfx.fillCircle(x, 2, 1.5);
        }
        // Bottom
        for (let x = 0; x < width; x += dotSpacing) {
            gfx.fillCircle(x, height - 2, 1.5);
        }
        // Left
        for (let y = 0; y < height; y += dotSpacing) {
            gfx.fillCircle(2, y, 1.5);
        }
        // Right
        for (let y = 0; y < height; y += dotSpacing) {
            gfx.fillCircle(width - 2, y, 1.5);
        }
    }

    private addBarrier(def: BarrierDef): void {
        if (def.isCircle && def.radius) {
            const zone = this.add.zone(def.x, def.y, 1, 1);
            this.barriers.add(zone);
            const body = zone.body as Phaser.Physics.Arcade.StaticBody;
            body.setCircle(def.radius);
            body.setOffset(-def.radius, -def.radius);
        } else {
            const zone = this.add.zone(def.x, def.y, def.width, def.height);
            this.barriers.add(zone);
        }
    }

    // =========================================================================
    // AMBIENT PARTICLES
    // =========================================================================

    private initAmbientParticles(width: number, height: number): void {
        this.ambientParticles = Array.from({ length: 80 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.05 - Math.random() * 0.2,
            alpha: 0.1 + Math.random() * 0.35,
            size: 1 + Math.random() * 2,
            life: Math.random() * 3000,
            maxLife: 3000 + Math.random() * 5000,
        }));
    }

    private updateAmbientParticles(delta: number): void {
        const { WORLD_WIDTH, WORLD_HEIGHT } = CONSTANTS;
        this.particleGraphics.clear();

        this.ambientParticles = this.ambientParticles.map(p => {
            const newLife = p.life + delta;
            if (newLife > p.maxLife) {
                return {
                    x: Math.random() * WORLD_WIDTH,
                    y: Math.random() * WORLD_HEIGHT,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: -0.05 - Math.random() * 0.2,
                    alpha: 0.1 + Math.random() * 0.35,
                    size: 1 + Math.random() * 2,
                    life: 0,
                    maxLife: 3000 + Math.random() * 5000,
                };
            }

            const lifeT = newLife / p.maxLife;
            const fadeAlpha = lifeT < 0.2
                ? lifeT / 0.2
                : lifeT > 0.8
                    ? (1 - lifeT) / 0.2
                    : 1;

            this.particleGraphics.fillStyle(0xe8c170, p.alpha * fadeAlpha);
            this.particleGraphics.fillCircle(
                p.x + p.vx * delta * 0.05,
                p.y + p.vy * delta * 0.05,
                p.size
            );

            return {
                ...p,
                x: p.x + p.vx * delta * 0.05 + Math.sin(newLife * 0.002) * 0.15,
                y: p.y + p.vy * delta * 0.05,
                life: newLife,
            };
        });
    }

    // =========================================================================
    // UTILS
    // =========================================================================

    private createSeededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }
}

import { Scene } from 'phaser';
import { Player } from '../entities/Player';
import { Landmark } from '../entities/Landmark';
import { CONSTANTS } from '../types';
import type { LandmarkData, LandmarksFile } from '../types';

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
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBackgroundColor(0x1a1510);

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
        this.updateAmbientParticles(delta);

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

    // =========================================================================
    // LANDSCAPE RENDERING
    // =========================================================================

    private createGroundBase(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        // Base earth tone fill
        gfx.fillStyle(0x3a2e22, 1);
        gfx.fillRect(0, 0, width, height);

        // Terrain noise — patches of lighter/darker ground
        const rng = this.createSeededRandom(42);
        for (let i = 0; i < 800; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 40 + rng() * 120;
            const colors = [0x443828, 0x302418, 0x3a3020, 0x342818, 0x483c2a];
            const lightness = colors[Math.floor(rng() * colors.length)];
            const alpha = 0.15 + rng() * 0.3;
            gfx.fillStyle(lightness, alpha);
            gfx.fillEllipse(px, py, patchSize, patchSize * (0.5 + rng() * 0.8));
        }

        // Olive and reddish-earth patches for variety
        for (let i = 0; i < 120; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 50 + rng() * 100;
            const isOlive = rng() > 0.5;
            gfx.fillStyle(isOlive ? 0x3a3a22 : 0x4a3028, 0.1 + rng() * 0.15);
            gfx.fillEllipse(px, py, patchSize, patchSize * 0.7);
        }
    }

    private createGroundVariation(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(99);

        // Sandy patches (lighter areas)
        for (let i = 0; i < 120; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 50 + rng() * 80;
            gfx.fillStyle(0x5a4a38, 0.15);
            gfx.fillEllipse(px, py, patchSize, patchSize * 0.7);
        }

        // Sparse grass tufts (small green dots)
        for (let i = 0; i < 1200; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const tSize = 2 + rng() * 6;
            const greenShade = rng() > 0.5 ? 0x3a5a2a : 0x2a4a1a;
            gfx.fillStyle(greenShade, 0.2 + rng() * 0.2);
            gfx.fillCircle(px, py, tSize);
        }

        // Darker undergrowth patches
        for (let i = 0; i < 80; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const patchSize = 25 + rng() * 50;
            gfx.fillStyle(0x2a3a1a, 0.2);
            gfx.fillEllipse(px, py, patchSize, patchSize);
        }
    }

    private createHills(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(77);

        for (let i = 0; i < 25; i++) {
            const hx = rng() * width;
            const hy = rng() * height;
            const hw = 250 + rng() * 350;
            const hh = hw * (0.5 + rng() * 0.3);

            // Sunlit side (upper-left, lighter)
            gfx.fillStyle(0x4a4030, 0.08 + rng() * 0.07);
            gfx.fillEllipse(hx - hw * 0.1, hy - hh * 0.1, hw * 0.8, hh * 0.7);

            // Shadow side (lower-right, darker)
            gfx.fillStyle(0x1a1810, 0.06 + rng() * 0.06);
            gfx.fillEllipse(hx + hw * 0.1, hy + hh * 0.1, hw * 0.8, hh * 0.7);

            // Main hill body
            gfx.fillStyle(0x342a1e, 0.05 + rng() * 0.05);
            gfx.fillEllipse(hx, hy, hw, hh);
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

        // Water shimmer (horizontal dashes for reflection)
        const shimmerRng = this.createSeededRandom(555);
        for (let i = 0; i < riverPoints.length - 1; i++) {
            const p1 = riverPoints[i];
            const p2 = riverPoints[i + 1];
            for (let t = 0; t < 1; t += 0.08) {
                const x = p1.x + (p2.x - p1.x) * t + (shimmerRng() - 0.5) * 24;
                const y = p1.y + (p2.y - p1.y) * t + (shimmerRng() - 0.5) * 18;
                const dashW = 4 + shimmerRng() * 8;
                gfx.fillStyle(0x6aaacc, 0.06 + shimmerRng() * 0.08);
                gfx.fillRect(x - dashW / 2, y, dashW, 1.5);
            }
        }

        // Shimmer dots
        for (let i = 0; i < riverPoints.length - 1; i++) {
            const p1 = riverPoints[i];
            const p2 = riverPoints[i + 1];
            for (let t = 0; t < 1; t += 0.12) {
                const x = p1.x + (p2.x - p1.x) * t + (shimmerRng() - 0.5) * 20;
                const y = p1.y + (p2.y - p1.y) * t + (shimmerRng() - 0.5) * 16;
                gfx.fillStyle(0x4a8aaa, 0.25);
                gfx.fillCircle(x, y, 1.5);
            }
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
        const steps = Math.floor(dist / 22);

        // Path ground (worn earth) — wider base with color variation
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 10;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;
            const px = x + dx * perpOffset;
            const py = y + dy * perpOffset;

            // Main worn earth
            gfx.fillStyle(0x3d2e1e, 0.3);
            gfx.fillCircle(px, py, 12);

            // Slight color variation
            if (i % 3 === 0) {
                gfx.fillStyle(0x4a3828, 0.15);
                gfx.fillCircle(px, py, 14);
            }

            // Grass encroachment on edges
            if (i % 4 === 0) {
                gfx.fillStyle(0x3a5a2a, 0.2);
                gfx.fillCircle(px + dx * 14, py + dy * 14, 3);
                gfx.fillCircle(px - dx * 14, py - dy * 14, 2.5);
            }
        }

        // Dot-art trail along path
        gfx.fillStyle(0xe8c170, 0.18);
        for (let i = 0; i <= steps; i += 2) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 10;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;

            gfx.fillCircle(x + dx * perpOffset, y + dy * perpOffset, 2.5);

            // Small surrounding dots
            gfx.fillStyle(0xe8c170, 0.08);
            for (let a = 0; a < 4; a++) {
                const angle = (a / 4) * Math.PI * 2 + t * 2;
                gfx.fillCircle(
                    x + dx * perpOffset + Math.cos(angle) * 8,
                    y + dy * perpOffset + Math.sin(angle) * 8,
                    1.5
                );
            }
            gfx.fillStyle(0xe8c170, 0.18);
        }
    }

    private createAmbientDetails(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(2);

        const rng = this.createSeededRandom(333);

        // Fallen logs
        for (let i = 0; i < 25; i++) {
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
        for (let i = 0; i < 20; i++) {
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
        const treeCount = 140;
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
        // Cast shadow (SE offset for consistent NW light)
        shadowGfx.fillStyle(0x000000, 0.12);
        shadowGfx.fillEllipse(x + 8, y + 10, size * 2.2, size * 1.6);

        // Trunk visible below canopy
        canopyGfx.fillStyle(0x3a2210, 0.7);
        canopyGfx.fillRoundedRect(x - 3, y - 4, 6, 12, 2);

        // Outer canopy (dark green, slightly wider than tall for isometric feel)
        canopyGfx.fillStyle(0x1a3a16, 0.75);
        canopyGfx.fillEllipse(x, y, size * 2, size * 1.6);

        // Mid canopy layer
        canopyGfx.fillStyle(0x2a4a22, 0.65);
        canopyGfx.fillEllipse(x - size * 0.15, y - size * 0.12, size * 1.5, size * 1.2);

        // Highlight (NW, sunlit side)
        canopyGfx.fillStyle(0x3a6a2a, 0.45);
        canopyGfx.fillEllipse(x - size * 0.3, y - size * 0.25, size * 0.9, size * 0.7);

        // Leaf texture dots (scattered darker spots)
        canopyGfx.fillStyle(0x1a3016, 0.3);
        canopyGfx.fillCircle(x + size * 0.3, y + size * 0.15, size * 0.15);
        canopyGfx.fillCircle(x - size * 0.1, y + size * 0.2, size * 0.12);
        canopyGfx.fillCircle(x + size * 0.15, y - size * 0.15, size * 0.1);

        // Bright leaf spot
        canopyGfx.fillStyle(0x4a7a3a, 0.3);
        canopyGfx.fillCircle(x - size * 0.35, y - size * 0.3, size * 0.2);
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
        const rockTarget = 45;
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
        const strips = 20;

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
        const dotSpacing = 40;
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
        this.ambientParticles = Array.from({ length: 200 }, () => ({
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

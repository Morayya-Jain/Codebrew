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

// Collision barrier definition
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

    constructor() {
        super('GameScene');
    }

    create(): void {
        const { WORLD_WIDTH, WORLD_HEIGHT } = CONSTANTS;

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // Create top-down landscape layers
        this.createGroundBase(WORLD_WIDTH, WORLD_HEIGHT);
        this.createGroundVariation(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRiver(WORLD_WIDTH, WORLD_HEIGHT);
        this.createPaths(WORLD_WIDTH, WORLD_HEIGHT);

        // Create collision barrier group
        this.barriers = this.physics.add.staticGroup();

        // Draw terrain features AND create collision bodies
        this.createTrees(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRocks(WORLD_WIDTH, WORLD_HEIGHT);
        this.createRiverCollisions();
        this.createBoundaryTrees(WORLD_WIDTH, WORLD_HEIGHT);

        // Ambient particles (fireflies/dust)
        this.particleGraphics = this.add.graphics();
        this.particleGraphics.setDepth(8);
        this.initAmbientParticles(WORLD_WIDTH, WORLD_HEIGHT);

        // Create player near center campfire
        this.player = new Player(this, 1000, 870);

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

    private openStoryCard(data: LandmarkData): void {
        this.isPaused = true;
        this.player.setVelocity(0, 0);

        const uiScene = this.scene.get('UIScene');
        uiScene.events.emit('openStoryCard', data);

        this.scene.pause();
    }

    // =========================================================================
    // LANDSCAPE RENDERING (top-down view)
    // =========================================================================

    private createGroundBase(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        // Base earth tone fill
        gfx.fillStyle(0x3a2e22, 1);
        gfx.fillRect(0, 0, width, height);

        // Subtle terrain noise — patches of lighter/darker ground
        const rng = this.createSeededRandom(42);
        for (let i = 0; i < 200; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const size = 30 + rng() * 80;
            const lightness = rng() > 0.5 ? 0x443828 : 0x302418;
            const alpha = 0.2 + rng() * 0.3;
            gfx.fillStyle(lightness, alpha);
            gfx.fillEllipse(px, py, size, size * (0.6 + rng() * 0.8));
        }
    }

    private createGroundVariation(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        const rng = this.createSeededRandom(99);

        // Sandy patches (lighter areas)
        for (let i = 0; i < 30; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const size = 40 + rng() * 60;
            gfx.fillStyle(0x5a4a38, 0.15);
            gfx.fillEllipse(px, py, size, size * 0.7);
        }

        // Sparse grass tufts (small green dots)
        gfx.fillStyle(0x3a5a2a, 0.3);
        for (let i = 0; i < 300; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const size = 2 + rng() * 5;
            gfx.fillCircle(px, py, size);
        }

        // Darker undergrowth patches
        for (let i = 0; i < 20; i++) {
            const px = rng() * width;
            const py = rng() * height;
            const size = 20 + rng() * 40;
            gfx.fillStyle(0x2a3a1a, 0.2);
            gfx.fillEllipse(px, py, size, size);
        }
    }

    private createRiver(_width: number, _height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(1);

        // River flows from upper-left area down through the middle-right
        // It creates a natural barrier that the player must find crossings for
        const riverPoints = [
            { x: 0, y: 600 },
            { x: 150, y: 620 },
            { x: 300, y: 660 },
            { x: 450, y: 700 },
            { x: 550, y: 720 },
            // GAP: crossing near waterhole path (550-700)
            { x: 700, y: 740 },
            { x: 850, y: 730 },
            { x: 950, y: 700 },
            // GAP: crossing near campfire (950-1100)
            { x: 1100, y: 680 },
            { x: 1250, y: 650 },
            { x: 1400, y: 620 },
            { x: 1500, y: 590 },
            // GAP: crossing to rock art area (1500-1650)
            { x: 1650, y: 560 },
            { x: 1800, y: 530 },
            { x: 2000, y: 500 },
        ];

        // Draw the river water (wide)
        gfx.lineStyle(40, 0x1a4a6a, 0.6);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Inner lighter water
        gfx.lineStyle(24, 0x2a6a8a, 0.5);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Water shimmer dots
        gfx.fillStyle(0x4a8aaa, 0.3);
        for (let i = 0; i < riverPoints.length - 1; i++) {
            const p1 = riverPoints[i];
            const p2 = riverPoints[i + 1];
            for (let t = 0; t < 1; t += 0.15) {
                const x = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 20;
                const y = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * 20;
                gfx.fillCircle(x, y, 1.5);
            }
        }

        // River banks (darker edges)
        gfx.lineStyle(48, 0x2a2018, 0.3);
        gfx.beginPath();
        gfx.moveTo(riverPoints[0].x, riverPoints[0].y);
        for (let i = 1; i < riverPoints.length; i++) {
            gfx.lineTo(riverPoints[i].x, riverPoints[i].y);
        }
        gfx.strokePath();

        // Draw crossing indicators (lighter ground at gaps)
        const crossings = [
            { x: 625, y: 730 },   // West crossing
            { x: 1025, y: 690 },  // Center crossing (near campfire)
            { x: 1575, y: 605 },  // East crossing
        ];
        crossings.forEach(({ x, y }) => {
            gfx.fillStyle(0x4a3a28, 0.6);
            gfx.fillEllipse(x, y, 80, 50);
            // Stepping stones
            gfx.fillStyle(0x6a5a48, 0.7);
            gfx.fillCircle(x - 15, y - 5, 6);
            gfx.fillCircle(x + 5, y + 5, 7);
            gfx.fillCircle(x + 25, y - 3, 5);
            // Dot art around crossing
            gfx.fillStyle(0xe8c170, 0.15);
            for (let a = 0; a < 8; a++) {
                const angle = (a / 8) * Math.PI * 2;
                gfx.fillCircle(x + Math.cos(angle) * 35, y + Math.sin(angle) * 25, 2);
            }
        });
    }

    private createPaths(_width: number, _height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(1);

        // Center campfire position
        const center = { x: 1000, y: 800 };

        // Paths from center to each landmark
        const pathTargets = [
            { x: 350, y: 450 },    // Waterhole (NW)
            { x: 1650, y: 350 },   // Rock Art (NE)
            { x: 1600, y: 1250 },  // Corroboree (SE)
            { x: 400, y: 1200 },   // Bush Tucker (SW)
            { x: 1000, y: 200 },   // Songline (N)
        ];

        pathTargets.forEach(target => {
            this.drawDotPath(gfx, center.x, center.y, target.x, target.y);
        });

        // Additional connecting paths between some landmarks
        this.drawDotPath(gfx, 350, 450, 1000, 200);   // Waterhole -> Songline
        this.drawDotPath(gfx, 1000, 200, 1650, 350);   // Songline -> Rock Art
        this.drawDotPath(gfx, 400, 1200, 1600, 1250);  // Bush Tucker -> Corroboree

        // Central clearing around campfire
        gfx.fillStyle(0x4a3a28, 0.3);
        gfx.fillCircle(center.x, center.y, 80);
        gfx.fillStyle(0x5a4a38, 0.2);
        gfx.fillCircle(center.x, center.y, 50);

        // Dot-art ring around center
        gfx.fillStyle(0xe8c170, 0.12);
        for (let a = 0; a < 24; a++) {
            const angle = (a / 24) * Math.PI * 2;
            gfx.fillCircle(center.x + Math.cos(angle) * 70, center.y + Math.sin(angle) * 70, 3);
        }
        for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            gfx.fillCircle(center.x + Math.cos(angle) * 90, center.y + Math.sin(angle) * 90, 2);
        }
    }

    private drawDotPath(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
        const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
        const steps = Math.floor(dist / 20);

        // Path ground (worn earth)
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            // Slight curve to path
            const perpOffset = Math.sin(t * Math.PI * 3) * 8;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;

            gfx.fillStyle(0x3d2e1e, 0.3);
            gfx.fillCircle(x + dx * perpOffset, y + dy * perpOffset, 10);
        }

        // Dot-art trail along path
        gfx.fillStyle(0xe8c170, 0.18);
        for (let i = 0; i <= steps; i += 2) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            const perpOffset = Math.sin(t * Math.PI * 3) * 8;
            const dx = -(y2 - y1) / dist;
            const dy = (x2 - x1) / dist;

            gfx.fillCircle(x + dx * perpOffset, y + dy * perpOffset, 2.5);

            // Small surrounding dots
            gfx.fillStyle(0xe8c170, 0.08);
            for (let a = 0; a < 4; a++) {
                const angle = (a / 4) * Math.PI * 2 + t * 2;
                gfx.fillCircle(
                    x + dx * perpOffset + Math.cos(angle) * 7,
                    y + dy * perpOffset + Math.sin(angle) * 7,
                    1.5
                );
            }
            gfx.fillStyle(0xe8c170, 0.18);
        }
    }

    // =========================================================================
    // COLLISION BARRIERS
    // =========================================================================

    private createTrees(_width: number, _height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(6); // Above player for overhead canopy feel

        const treeShadowGfx = this.add.graphics();
        treeShadowGfx.setDepth(2);

        // Scattered trees — carefully positioned to NOT block landmarks or paths
        // Each tree: top-down canopy circle with a collision body at the trunk
        const treePositions = [
            // North area (between songline and edges)
            { x: 800, y: 150, size: 28 }, { x: 1200, y: 180, size: 24 },
            { x: 750, y: 300, size: 30 }, { x: 1250, y: 280, size: 26 },
            { x: 850, y: 400, size: 22 }, { x: 1150, y: 370, size: 28 },

            // Northwest (around waterhole but not blocking it)
            { x: 200, y: 300, size: 26 }, { x: 500, y: 350, size: 24 },
            { x: 250, y: 550, size: 28 }, { x: 480, y: 520, size: 22 },

            // Northeast (around rock art)
            { x: 1500, y: 250, size: 24 }, { x: 1800, y: 300, size: 26 },
            { x: 1750, y: 450, size: 30 }, { x: 1550, y: 480, size: 22 },

            // Center-west
            { x: 600, y: 700, size: 26 }, { x: 700, y: 850, size: 24 },
            { x: 550, y: 950, size: 28 },

            // Center-east
            { x: 1350, y: 750, size: 26 }, { x: 1300, y: 900, size: 22 },
            { x: 1450, y: 850, size: 24 },

            // Southwest (around bush tucker)
            { x: 250, y: 1100, size: 24 }, { x: 550, y: 1100, size: 28 },
            { x: 300, y: 1350, size: 26 }, { x: 500, y: 1300, size: 22 },

            // Southeast (around corroboree)
            { x: 1450, y: 1150, size: 24 }, { x: 1750, y: 1200, size: 26 },
            { x: 1500, y: 1350, size: 28 }, { x: 1700, y: 1350, size: 22 },

            // South center
            { x: 900, y: 1100, size: 26 }, { x: 1100, y: 1050, size: 24 },
            { x: 800, y: 1250, size: 22 }, { x: 1050, y: 1300, size: 28 },
            { x: 950, y: 1400, size: 24 },
        ];

        treePositions.forEach(({ x, y, size }) => {
            this.drawTopDownTree(gfx, treeShadowGfx, x, y, size);

            // Collision body at trunk (smaller than visual canopy)
            this.addBarrier({ x, y, width: 0, height: 0, isCircle: true, radius: size * 0.5 });
        });
    }

    private drawTopDownTree(
        canopyGfx: Phaser.GameObjects.Graphics,
        shadowGfx: Phaser.GameObjects.Graphics,
        x: number, y: number, size: number
    ): void {
        // Shadow (offset slightly)
        shadowGfx.fillStyle(0x000000, 0.15);
        shadowGfx.fillCircle(x + 4, y + 4, size + 2);

        // Outer canopy (darker)
        canopyGfx.fillStyle(0x1a3a16, 0.7);
        canopyGfx.fillCircle(x, y, size);

        // Inner canopy variation
        canopyGfx.fillStyle(0x2a4a22, 0.6);
        canopyGfx.fillCircle(x - size * 0.2, y - size * 0.15, size * 0.7);

        // Highlight
        canopyGfx.fillStyle(0x3a5a2a, 0.4);
        canopyGfx.fillCircle(x - size * 0.25, y - size * 0.25, size * 0.4);

        // Trunk visible through canopy (dark center dot)
        canopyGfx.fillStyle(0x2a1a10, 0.5);
        canopyGfx.fillCircle(x, y, size * 0.15);
    }

    private createRocks(_width: number, _height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(3);

        // Rock clusters — positioned to create interesting navigation choices
        const rockClusters = [
            // Northern rocks
            { x: 900, y: 250, rocks: [{ dx: 0, dy: 0, w: 30, h: 20 }, { dx: 25, dy: 15, w: 20, h: 15 }] },
            { x: 1100, y: 220, rocks: [{ dx: 0, dy: 0, w: 25, h: 18 }, { dx: -15, dy: 20, w: 22, h: 14 }] },

            // Western rocks
            { x: 150, y: 700, rocks: [{ dx: 0, dy: 0, w: 35, h: 22 }, { dx: 30, dy: -10, w: 20, h: 16 }] },
            { x: 300, y: 900, rocks: [{ dx: 0, dy: 0, w: 28, h: 20 }] },

            // Eastern rocks
            { x: 1800, y: 700, rocks: [{ dx: 0, dy: 0, w: 32, h: 22 }, { dx: -20, dy: 18, w: 24, h: 16 }] },
            { x: 1850, y: 900, rocks: [{ dx: 0, dy: 0, w: 26, h: 18 }] },

            // Central rocks (creating navigation interest)
            { x: 800, y: 650, rocks: [{ dx: 0, dy: 0, w: 30, h: 20 }, { dx: 20, dy: 12, w: 18, h: 14 }] },
            { x: 1200, y: 650, rocks: [{ dx: 0, dy: 0, w: 28, h: 18 }] },

            // Southern rocks
            { x: 700, y: 1400, rocks: [{ dx: 0, dy: 0, w: 32, h: 20 }, { dx: 25, dy: 10, w: 20, h: 15 }] },
            { x: 1300, y: 1400, rocks: [{ dx: 0, dy: 0, w: 26, h: 20 }] },
        ];

        rockClusters.forEach(cluster => {
            cluster.rocks.forEach(rock => {
                const rx = cluster.x + rock.dx;
                const ry = cluster.y + rock.dy;

                // Rock shadow
                gfx.fillStyle(0x000000, 0.12);
                gfx.fillEllipse(rx + 3, ry + 3, rock.w + 2, rock.h + 2);

                // Rock body
                gfx.fillStyle(0x5a4a38, 0.7);
                gfx.fillEllipse(rx, ry, rock.w, rock.h);

                // Rock highlight
                gfx.fillStyle(0x7a6a58, 0.4);
                gfx.fillEllipse(rx - rock.w * 0.15, ry - rock.h * 0.15, rock.w * 0.6, rock.h * 0.6);

                // Collision body
                this.addBarrier({ x: rx, y: ry, width: rock.w, height: rock.h });
            });
        });
    }

    private createRiverCollisions(): void {
        // River collision segments — blocks of the river that are NOT crossings
        // Three crossing gaps (~120px wide each), centered on the visual indicators:
        //   - West crossing at x=625:  gap x=565-685
        //   - Center crossing at x=1025: gap x=965-1085
        //   - East crossing at x=1575: gap x=1515-1635

        const riverSegments: BarrierDef[] = [
            // Segment 1: left edge to west crossing gap
            { x: 280, y: 645, width: 560, height: 38 },

            // Segment 2: west crossing to center crossing
            { x: 825, y: 720, width: 280, height: 38 },

            // Segment 3: center crossing to east crossing
            { x: 1300, y: 660, width: 430, height: 38 },

            // Segment 4: east crossing to right edge
            { x: 1815, y: 540, width: 360, height: 38 },
        ];

        riverSegments.forEach(seg => {
            this.addBarrier(seg);
        });
    }

    private createBoundaryTrees(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(6);
        const shadowGfx = this.add.graphics();
        shadowGfx.setDepth(2);

        const margin = 60;
        const spacing = 55;

        // Top edge
        for (let x = margin; x < width - margin; x += spacing) {
            const y = margin + (Math.sin(x * 0.05) * 10);
            const size = 22 + Math.abs(Math.sin(x * 0.03)) * 12;
            this.drawTopDownTree(gfx, shadowGfx, x, y, size);
            this.addBarrier({ x, y, width: 0, height: 0, isCircle: true, radius: size * 0.5 });
        }

        // Bottom edge
        for (let x = margin; x < width - margin; x += spacing) {
            const y = height - margin + (Math.sin(x * 0.05) * 10);
            const size = 22 + Math.abs(Math.sin(x * 0.03)) * 12;
            this.drawTopDownTree(gfx, shadowGfx, x, y, size);
            this.addBarrier({ x, y, width: 0, height: 0, isCircle: true, radius: size * 0.5 });
        }

        // Left edge
        for (let y = margin; y < height - margin; y += spacing) {
            const x = margin + (Math.sin(y * 0.05) * 10);
            const size = 22 + Math.abs(Math.sin(y * 0.03)) * 12;
            this.drawTopDownTree(gfx, shadowGfx, x, y, size);
            this.addBarrier({ x, y, width: 0, height: 0, isCircle: true, radius: size * 0.5 });
        }

        // Right edge
        for (let y = margin; y < height - margin; y += spacing) {
            const x = width - margin + (Math.sin(y * 0.05) * 10);
            const size = 22 + Math.abs(Math.sin(y * 0.03)) * 12;
            this.drawTopDownTree(gfx, shadowGfx, x, y, size);
            this.addBarrier({ x, y, width: 0, height: 0, isCircle: true, radius: size * 0.5 });
        }
    }

    private addBarrier(def: BarrierDef): void {
        if (def.isCircle && def.radius) {
            // For circular barriers: create a tiny zone, then set a circle body centered on it
            const zone = this.add.zone(def.x, def.y, 1, 1);
            this.barriers.add(zone);
            const body = zone.body as Phaser.Physics.Arcade.StaticBody;
            body.setCircle(def.radius);
            body.setOffset(-def.radius, -def.radius);
        } else {
            // For rectangular barriers: create zone with full dimensions — body auto-centers
            const zone = this.add.zone(def.x, def.y, def.width, def.height);
            this.barriers.add(zone);
        }
    }

    // =========================================================================
    // AMBIENT PARTICLES
    // =========================================================================

    private initAmbientParticles(width: number, height: number): void {
        this.ambientParticles = Array.from({ length: 60 }, () => ({
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

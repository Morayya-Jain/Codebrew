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

export class GameScene extends Scene {
    private player!: Player;
    private landmarks: Landmark[] = [];
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

        // Create layered landscape
        this.createSkyLayer(WORLD_WIDTH, WORLD_HEIGHT);
        this.createMidgroundLayer(WORLD_WIDTH, WORLD_HEIGHT);
        this.createGroundLayer(WORLD_WIDTH, WORLD_HEIGHT);
        this.createTerrainDetails(WORLD_WIDTH, WORLD_HEIGHT);

        // Ambient particles (fireflies/dust)
        this.particleGraphics = this.add.graphics();
        this.particleGraphics.setDepth(8);
        this.initAmbientParticles(WORLD_WIDTH, WORLD_HEIGHT);

        // Create player
        this.player = new Player(this, 150, WORLD_HEIGHT / 2 + 40);

        // Setup camera
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBackgroundColor(0x0a0604);

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
            // Small delay before accepting input again
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

    // --- Landscape Rendering ---

    private createSkyLayer(width: number, height: number): void {
        const gfx = this.add.graphics();
        const skyHeight = height * 0.45;

        // Night sky gradient
        for (let y = 0; y < skyHeight; y++) {
            const t = y / skyHeight;
            const r = Math.floor(12 + t * 18);
            const g = Math.floor(8 + t * 20);
            const b = Math.floor(30 + t * 15);
            gfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            gfx.fillRect(0, y, width, 1);
        }

        // Stars
        gfx.setDepth(0);
        for (let i = 0; i < 120; i++) {
            const x = Math.random() * width;
            const y = Math.random() * skyHeight * 0.8;
            const size = 0.5 + Math.random() * 1.8;
            const brightness = 0.3 + Math.random() * 0.7;
            gfx.fillStyle(0xffffff, brightness);
            gfx.fillCircle(x, y, size);
        }

        // Southern Cross constellation (approximate)
        const crossX = width * 0.3;
        const crossY = 60;
        const crossStars = [
            { dx: 0, dy: 0 }, { dx: 0, dy: 30 }, { dx: 0, dy: 60 },
            { dx: -15, dy: 30 }, { dx: 15, dy: 30 },
        ];
        crossStars.forEach(({ dx, dy }) => {
            gfx.fillStyle(0xffffff, 0.9);
            gfx.fillCircle(crossX + dx, crossY + dy, 2);
            gfx.fillStyle(0xffffff, 0.15);
            gfx.fillCircle(crossX + dx, crossY + dy, 6);
        });
    }

    private createMidgroundLayer(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        // Distant hills silhouette
        gfx.fillStyle(0x1a1510, 0.8);
        for (let x = 0; x < width; x += 2) {
            const hillY = height * 0.35 +
                Math.sin(x * 0.003) * 40 +
                Math.sin(x * 0.007) * 20 +
                Math.sin(x * 0.001) * 60;
            gfx.fillRect(x, hillY, 2, height - hillY);
        }

        // Closer hills
        gfx.fillStyle(0x221a12, 0.9);
        for (let x = 0; x < width; x += 2) {
            const hillY = height * 0.42 +
                Math.sin(x * 0.005 + 1) * 30 +
                Math.sin(x * 0.012) * 15;
            gfx.fillRect(x, hillY, 2, height - hillY);
        }
    }

    private createGroundLayer(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(0);

        // Main ground
        for (let y = Math.floor(height * 0.45); y < height; y++) {
            const t = (y - height * 0.45) / (height * 0.55);
            const r = Math.floor(40 + t * 25);
            const g = Math.floor(28 + t * 15);
            const b = Math.floor(18 + t * 8);
            gfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
            gfx.fillRect(0, y, width, 1);
        }
    }

    private createTerrainDetails(width: number, height: number): void {
        const gfx = this.add.graphics();
        gfx.setDepth(2);

        // Walking path with Aboriginal dot-art style
        for (let x = 0; x < width; x += 3) {
            const pathY = height / 2 + 40 + Math.sin(x * 0.004) * 25;

            // Path ground
            gfx.fillStyle(0x3d2e1e, 0.4);
            gfx.fillRect(x, pathY - 12, 3, 24);
        }

        // Dot trail along path (connected circles pattern)
        gfx.fillStyle(0xe8c170, 0.2);
        for (let x = 10; x < width; x += 28) {
            const pathY = height / 2 + 40 + Math.sin(x * 0.004) * 25;
            gfx.fillCircle(x, pathY, 3);

            // Smaller surrounding dots
            gfx.fillStyle(0xe8c170, 0.1);
            for (let a = 0; a < 6; a++) {
                const angle = (a / 6) * Math.PI * 2;
                gfx.fillCircle(x + Math.cos(angle) * 8, pathY + Math.sin(angle) * 8, 1.5);
            }
            gfx.fillStyle(0xe8c170, 0.2);
        }

        // Trees (eucalyptus-style)
        const treePositions = [
            { x: 80, y: 330 }, { x: 300, y: 280 }, { x: 580, y: 520 },
            { x: 750, y: 290 }, { x: 1050, y: 530 }, { x: 1200, y: 300 },
            { x: 1550, y: 510 }, { x: 1700, y: 280 }, { x: 2050, y: 290 },
            { x: 2200, y: 520 }, { x: 2550, y: 310 }, { x: 2700, y: 540 },
            { x: 2850, y: 280 }, { x: 3050, y: 510 }, { x: 3150, y: 300 },
        ];
        treePositions.forEach(({ x, y }) => {
            this.drawTree(gfx, x, y);
        });

        // Scattered rocks
        const rockPositions = [
            { x: 200, y: 500 }, { x: 650, y: 310 }, { x: 1100, y: 520 },
            { x: 1600, y: 290 }, { x: 1850, y: 540 }, { x: 2300, y: 310 },
            { x: 2650, y: 500 }, { x: 3000, y: 350 },
        ];
        rockPositions.forEach(({ x, y }) => {
            gfx.fillStyle(0x4a3828, 0.5);
            gfx.fillEllipse(x, y, 25 + Math.random() * 20, 12 + Math.random() * 8);
            gfx.fillStyle(0x5a4838, 0.3);
            gfx.fillEllipse(x - 3, y - 3, 15 + Math.random() * 10, 8 + Math.random() * 5);
        });

        // Grass tufts
        gfx.fillStyle(0x3a5a2a, 0.35);
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * width;
            const y = height * 0.48 + Math.random() * height * 0.42;
            const size = 3 + Math.random() * 6;
            gfx.fillCircle(x, y, size);
        }
    }

    private drawTree(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
        const height = 60 + Math.random() * 40;
        const lean = (Math.random() - 0.5) * 10;

        // Trunk
        gfx.fillStyle(0x4a3520, 0.7);
        gfx.fillRect(x + lean - 3, y - height, 6, height);
        gfx.fillRect(x + lean - 2, y - height - 5, 4, 10);

        // Canopy (sparse eucalyptus style)
        gfx.fillStyle(0x2a4a22, 0.5);
        gfx.fillCircle(x + lean - 8, y - height + 5, 12);
        gfx.fillCircle(x + lean + 10, y - height - 5, 10);
        gfx.fillCircle(x + lean + 2, y - height - 12, 14);

        gfx.fillStyle(0x3a5a2a, 0.4);
        gfx.fillCircle(x + lean - 5, y - height - 8, 8);
        gfx.fillCircle(x + lean + 8, y - height + 2, 9);
    }

    // --- Ambient Particles ---

    private initAmbientParticles(width: number, height: number): void {
        this.ambientParticles = Array.from({ length: 50 }, () => ({
            x: Math.random() * width,
            y: height * 0.3 + Math.random() * height * 0.6,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.1 - Math.random() * 0.3,
            alpha: 0.1 + Math.random() * 0.4,
            size: 1 + Math.random() * 2.5,
            life: Math.random() * 3000,
            maxLife: 3000 + Math.random() * 4000,
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
                    y: WORLD_HEIGHT * 0.4 + Math.random() * WORLD_HEIGHT * 0.5,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: -0.1 - Math.random() * 0.3,
                    alpha: 0.1 + Math.random() * 0.4,
                    size: 1 + Math.random() * 2.5,
                    life: 0,
                    maxLife: 3000 + Math.random() * 4000,
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
                x: p.x + p.vx * delta * 0.05 + Math.sin(newLife * 0.002) * 0.2,
                y: p.y + p.vy * delta * 0.05,
                life: newLife,
            };
        });
    }
}

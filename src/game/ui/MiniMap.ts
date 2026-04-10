import { Scene } from 'phaser';
import { CONSTANTS } from '../types';
import type { GameScene } from '../scenes/GameScene';

export class MiniMap {
    private scene: Scene;
    private x: number;
    private y: number;
    private mapWidth: number;
    private mapHeight: number;
    private gameScene: GameScene;

    private terrainTexture!: Phaser.GameObjects.RenderTexture;
    private fogTexture!: Phaser.GameObjects.RenderTexture;
    private playerDot!: Phaser.GameObjects.Graphics;
    private landmarkDots!: Phaser.GameObjects.Graphics;
    private border!: Phaser.GameObjects.Graphics;

    private lastRevealX = -999;
    private lastRevealY = -999;

    constructor(scene: Scene, x: number, y: number, width: number, height: number, gameScene: GameScene) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.mapWidth = width;
        this.mapHeight = height;
        this.gameScene = gameScene;

        this.createTerrain();
        this.createFog();
        this.createOverlayElements();
    }

    private worldToMap(worldX: number, worldY: number): { mx: number; my: number } {
        return {
            mx: (worldX / CONSTANTS.WORLD_WIDTH) * this.mapWidth,
            my: (worldY / CONSTANTS.WORLD_HEIGHT) * this.mapHeight,
        };
    }

    private createTerrain(): void {
        this.terrainTexture = this.scene.add.renderTexture(
            this.x, this.y, this.mapWidth, this.mapHeight
        ).setOrigin(0).setScrollFactor(0).setDepth(50);

        const gfx = this.scene.add.graphics();

        // Background
        gfx.fillStyle(0x0a0604, 0.75);
        gfx.fillRect(0, 0, this.mapWidth, this.mapHeight);

        // Base terrain
        gfx.fillStyle(0x2a2218, 1);
        gfx.fillRect(2, 2, this.mapWidth - 4, this.mapHeight - 4);

        // Ground variation
        gfx.fillStyle(0x343020, 0.5);
        const rng = this.createSimpleRng(88);
        for (let i = 0; i < 30; i++) {
            const px = rng() * this.mapWidth;
            const py = rng() * this.mapHeight;
            gfx.fillEllipse(px, py, 15 + rng() * 20, 10 + rng() * 14);
        }

        // Green patches (grass areas)
        gfx.fillStyle(0x2a3a1a, 0.4);
        for (let i = 0; i < 20; i++) {
            const px = rng() * this.mapWidth;
            const py = rng() * this.mapHeight;
            gfx.fillEllipse(px, py, 10 + rng() * 18, 8 + rng() * 12);
        }

        // River (simplified as a blue line)
        const riverPoints = [
            { x: 0, y: 2400 }, { x: 800, y: 2560 }, { x: 1600, y: 2680 },
            { x: 2500, y: 2700 }, { x: 3400, y: 2600 }, { x: 4300, y: 2480 },
            { x: 5100, y: 2400 }, { x: 5900, y: 2280 }, { x: 6800, y: 2140 },
            { x: 8000, y: 1960 },
        ];

        gfx.lineStyle(3, 0x1a5a8a, 0.7);
        gfx.beginPath();
        const firstPt = this.worldToMap(riverPoints[0].x, riverPoints[0].y);
        gfx.moveTo(firstPt.mx, firstPt.my);
        for (let i = 1; i < riverPoints.length; i++) {
            const pt = this.worldToMap(riverPoints[i].x, riverPoints[i].y);
            gfx.lineTo(pt.mx, pt.my);
        }
        gfx.strokePath();

        // Paths (simplified as faint brown lines)
        const center = this.worldToMap(4000, 3200);
        const pathTargets = [
            { x: 1400, y: 1800 }, { x: 6600, y: 1400 }, { x: 6400, y: 5000 },
            { x: 1600, y: 4800 }, { x: 4000, y: 800 }, { x: 2800, y: 600 },
            { x: 5600, y: 2800 }, { x: 3200, y: 5600 }, { x: 6800, y: 3800 },
        ];

        gfx.lineStyle(1, 0x5a4a38, 0.4);
        pathTargets.forEach(target => {
            const pt = this.worldToMap(target.x, target.y);
            gfx.beginPath();
            gfx.moveTo(center.mx, center.my);
            gfx.lineTo(pt.mx, pt.my);
            gfx.strokePath();
        });

        this.terrainTexture.draw(gfx, 0, 0);
        gfx.destroy();
    }

    private createFog(): void {
        this.fogTexture = this.scene.add.renderTexture(
            this.x, this.y, this.mapWidth, this.mapHeight
        ).setOrigin(0).setScrollFactor(0).setDepth(51);

        // Fill with black (fully fogged)
        this.fogTexture.fill(0x000000, 1);
    }

    private createOverlayElements(): void {
        // Landmark dots (drawn above fog)
        this.landmarkDots = this.scene.add.graphics()
            .setScrollFactor(0).setDepth(52);

        // Player dot
        this.playerDot = this.scene.add.graphics()
            .setScrollFactor(0).setDepth(53);

        // Border
        this.border = this.scene.add.graphics()
            .setScrollFactor(0).setDepth(54);

        this.border.lineStyle(1, 0xe8c170, 0.3);
        this.border.strokeRect(this.x, this.y, this.mapWidth, this.mapHeight);

        // Corner accents
        const cornerSize = 6;
        this.border.lineStyle(1, 0xe8c170, 0.5);
        // Top-left
        this.border.beginPath();
        this.border.moveTo(this.x, this.y + cornerSize);
        this.border.lineTo(this.x, this.y);
        this.border.lineTo(this.x + cornerSize, this.y);
        this.border.strokePath();
        // Top-right
        this.border.beginPath();
        this.border.moveTo(this.x + this.mapWidth - cornerSize, this.y);
        this.border.lineTo(this.x + this.mapWidth, this.y);
        this.border.lineTo(this.x + this.mapWidth, this.y + cornerSize);
        this.border.strokePath();
        // Bottom-left
        this.border.beginPath();
        this.border.moveTo(this.x, this.y + this.mapHeight - cornerSize);
        this.border.lineTo(this.x, this.y + this.mapHeight);
        this.border.lineTo(this.x + cornerSize, this.y + this.mapHeight);
        this.border.strokePath();
        // Bottom-right
        this.border.beginPath();
        this.border.moveTo(this.x + this.mapWidth - cornerSize, this.y + this.mapHeight);
        this.border.lineTo(this.x + this.mapWidth, this.y + this.mapHeight);
        this.border.lineTo(this.x + this.mapWidth, this.y + this.mapHeight - cornerSize);
        this.border.strokePath();
    }

    update(playerWorldX: number, playerWorldY: number, discoveredIds: Set<string>): void {
        const { mx, my } = this.worldToMap(playerWorldX, playerWorldY);

        // Reveal fog around player position (debounce: only when moved >2px on minimap)
        const dx = mx - this.lastRevealX;
        const dy = my - this.lastRevealY;
        if (dx * dx + dy * dy > 4) {
            this.fogTexture.erase('minimap-reveal-brush', mx - 20, my - 20);
            this.lastRevealX = mx;
            this.lastRevealY = my;
        }

        // Update player dot
        this.playerDot.clear();
        this.playerDot.fillStyle(0xffffff, 0.9);
        this.playerDot.fillCircle(this.x + mx, this.y + my, 3);
        // Outer ring
        this.playerDot.lineStyle(1, 0xffffff, 0.4);
        this.playerDot.strokeCircle(this.x + mx, this.y + my, 5);

        // Update landmark dots
        this.landmarkDots.clear();
        const landmarks = this.gameScene.getLandmarkPositions();
        landmarks.forEach(lm => {
            const lmPos = this.worldToMap(lm.x, lm.y);
            const isDiscovered = discoveredIds.has(lm.id);

            // Show landmark if discovered OR if fog is revealed in that area
            // For simplicity, show all landmarks that are within revealed fog
            // (We always show discovered ones brightly; others are dim if visible)
            if (isDiscovered) {
                // Bright colored dot
                const color = parseInt(lm.iconColor.replace('#', ''), 16);
                this.landmarkDots.fillStyle(color, 0.9);
                this.landmarkDots.fillCircle(this.x + lmPos.mx, this.y + lmPos.my, 4);
                // Outline
                this.landmarkDots.lineStyle(1, 0xffffff, 0.5);
                this.landmarkDots.strokeCircle(this.x + lmPos.mx, this.y + lmPos.my, 4);
            } else {
                // Dim dot for undiscovered but visible landmarks
                this.landmarkDots.fillStyle(0x6a5a4a, 0.4);
                this.landmarkDots.fillCircle(this.x + lmPos.mx, this.y + lmPos.my, 3);
            }
        });
    }

    private createSimpleRng(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }
}

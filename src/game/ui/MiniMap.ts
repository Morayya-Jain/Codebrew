import { Scene } from 'phaser';
import { CONSTANTS } from '../types';
import type { GameScene } from '../scenes/GameScene';

/**
 * Bottom-right minimap that can expand to a large centered overlay.
 *
 * All visuals (terrain RenderTexture, fog RenderTexture, dot overlays,
 * gold-accent border) are children of a single Container positioned in
 * screen space. The container is tweened between its compact and expanded
 * layouts, which preserves the fog-reveal state (baked into the RenderTexture)
 * across toggles — no redraw cost.
 */
export class MiniMap {
    private scene: Scene;
    private compactX: number;
    private compactY: number;
    private mapWidth: number;
    private mapHeight: number;
    private gameScene: GameScene;

    private rootContainer!: Phaser.GameObjects.Container;
    private scrim!: Phaser.GameObjects.Graphics;
    private terrainTexture!: Phaser.GameObjects.RenderTexture;
    private fogTexture!: Phaser.GameObjects.RenderTexture;
    private playerDot!: Phaser.GameObjects.Graphics;
    private landmarkDots!: Phaser.GameObjects.Graphics;
    private undiscoveredDots!: Phaser.GameObjects.Graphics;
    private border!: Phaser.GameObjects.Graphics;

    private lastRevealX = -999;
    private lastRevealY = -999;

    private expanded_ = false;
    private isTweening_ = false;

    constructor(scene: Scene, x: number, y: number, width: number, height: number, gameScene: GameScene) {
        this.scene = scene;
        this.compactX = x;
        this.compactY = y;
        this.mapWidth = width;
        this.mapHeight = height;
        this.gameScene = gameScene;

        this.createScrim();
        this.createRoot();
        this.createTerrain();
        this.createFog();
        this.createOverlayElements();
    }

    get isExpanded(): boolean {
        return this.expanded_;
    }

    private worldToMap(worldX: number, worldY: number): { mx: number; my: number } {
        return {
            mx: Math.max(0, Math.min(this.mapWidth, (worldX / CONSTANTS.WORLD_WIDTH) * this.mapWidth)),
            my: Math.max(0, Math.min(this.mapHeight, (worldY / CONSTANTS.WORLD_HEIGHT) * this.mapHeight)),
        };
    }

    private createScrim(): void {
        const cam = this.scene.cameras.main;
        this.scrim = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(49);
        this.scrim.fillStyle(0x000000, 1);
        this.scrim.fillRect(0, 0, cam.width, cam.height);
        this.scrim.setAlpha(0);
        this.scrim.disableInteractive();
    }

    private createRoot(): void {
        this.rootContainer = this.scene.add.container(this.compactX, this.compactY)
            .setScrollFactor(0)
            .setDepth(50);
    }

    private createTerrain(): void {
        this.terrainTexture = this.scene.add.renderTexture(0, 0, this.mapWidth, this.mapHeight)
            .setOrigin(0)
            .setScrollFactor(0);

        const gfx = this.scene.add.graphics();

        gfx.fillStyle(0x0a0604, 0.75);
        gfx.fillRect(0, 0, this.mapWidth, this.mapHeight);

        gfx.fillStyle(0x2a2218, 1);
        gfx.fillRect(2, 2, this.mapWidth - 4, this.mapHeight - 4);

        gfx.fillStyle(0x343020, 0.5);
        const rng = this.createSimpleRng(88);
        for (let i = 0; i < 30; i++) {
            const px = rng() * this.mapWidth;
            const py = rng() * this.mapHeight;
            gfx.fillEllipse(px, py, 15 + rng() * 20, 10 + rng() * 14);
        }

        gfx.fillStyle(0x2a3a1a, 0.4);
        for (let i = 0; i < 20; i++) {
            const px = rng() * this.mapWidth;
            const py = rng() * this.mapHeight;
            gfx.fillEllipse(px, py, 10 + rng() * 18, 8 + rng() * 12);
        }

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

        this.rootContainer.add(this.terrainTexture);
    }

    private createFog(): void {
        this.fogTexture = this.scene.add.renderTexture(0, 0, this.mapWidth, this.mapHeight)
            .setOrigin(0)
            .setScrollFactor(0);
        this.fogTexture.fill(0x000000, 1);
        this.rootContainer.add(this.fogTexture);
    }

    private createOverlayElements(): void {
        this.undiscoveredDots = this.scene.add.graphics().setScrollFactor(0);
        this.landmarkDots = this.scene.add.graphics().setScrollFactor(0);
        this.playerDot = this.scene.add.graphics().setScrollFactor(0);
        this.border = this.scene.add.graphics().setScrollFactor(0);

        this.border.lineStyle(1, 0xe8c170, 0.3);
        this.border.strokeRect(0, 0, this.mapWidth, this.mapHeight);

        const cornerSize = 6;
        this.border.lineStyle(1, 0xe8c170, 0.5);
        this.border.beginPath();
        this.border.moveTo(0, cornerSize);
        this.border.lineTo(0, 0);
        this.border.lineTo(cornerSize, 0);
        this.border.strokePath();
        this.border.beginPath();
        this.border.moveTo(this.mapWidth - cornerSize, 0);
        this.border.lineTo(this.mapWidth, 0);
        this.border.lineTo(this.mapWidth, cornerSize);
        this.border.strokePath();
        this.border.beginPath();
        this.border.moveTo(0, this.mapHeight - cornerSize);
        this.border.lineTo(0, this.mapHeight);
        this.border.lineTo(cornerSize, this.mapHeight);
        this.border.strokePath();
        this.border.beginPath();
        this.border.moveTo(this.mapWidth - cornerSize, this.mapHeight);
        this.border.lineTo(this.mapWidth, this.mapHeight);
        this.border.lineTo(this.mapWidth, this.mapHeight - cornerSize);
        this.border.strokePath();

        // Child order defines draw order inside the container: fog sits above
        // terrain (added first), undiscovered dots peek through as fog clears,
        // discovered dots and the player dot sit above fog, border on top.
        this.rootContainer.add(this.undiscoveredDots);
        this.rootContainer.add(this.landmarkDots);
        this.rootContainer.add(this.playerDot);
        this.rootContainer.add(this.border);
    }

    update(playerWorldX: number, playerWorldY: number, discoveredIds: Set<string>): void {
        const { mx, my } = this.worldToMap(playerWorldX, playerWorldY);

        const dx = mx - this.lastRevealX;
        const dy = my - this.lastRevealY;
        if (dx * dx + dy * dy > 4) {
            this.fogTexture.erase('minimap-reveal-brush', mx - 20, my - 20);
            this.lastRevealX = mx;
            this.lastRevealY = my;
        }

        this.playerDot.clear();
        this.playerDot.fillStyle(0xffffff, 0.9);
        this.playerDot.fillCircle(mx, my, 3);
        this.playerDot.lineStyle(1, 0xffffff, 0.4);
        this.playerDot.strokeCircle(mx, my, 5);

        this.landmarkDots.clear();
        this.undiscoveredDots.clear();
        const landmarks = this.gameScene.getLandmarkPositions();
        landmarks.forEach(lm => {
            const lmPos = this.worldToMap(lm.x, lm.y);
            const isDiscovered = discoveredIds.has(lm.id);

            if (isDiscovered) {
                const color = parseInt(lm.iconColor.replace('#', ''), 16);
                this.landmarkDots.fillStyle(color, 0.9);
                this.landmarkDots.fillCircle(lmPos.mx, lmPos.my, 4);
                this.landmarkDots.lineStyle(1, 0xffffff, 0.5);
                this.landmarkDots.strokeCircle(lmPos.mx, lmPos.my, 4);
            } else {
                this.undiscoveredDots.fillStyle(0x6a5a4a, 0.4);
                this.undiscoveredDots.fillCircle(lmPos.mx, lmPos.my, 3);
            }
        });
    }

    toggle(): void {
        if (this.expanded_) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    expand(): void {
        if (this.expanded_ || this.isTweening_) return;
        const cam = this.scene.cameras.main;

        // Aspect-correct target size: fit in ~70% width, ~75% height.
        const aspect = this.mapWidth / this.mapHeight;
        let targetW = Math.min(cam.width * 0.7, cam.height * 0.75 * aspect);
        let targetH = targetW / aspect;
        if (targetH > cam.height * 0.8) {
            targetH = cam.height * 0.8;
            targetW = targetH * aspect;
        }

        const targetScale = targetW / this.mapWidth;
        const targetX = (cam.width - targetW) / 2;
        const targetY = (cam.height - targetH) / 2;

        this.isTweening_ = true;
        this.expanded_ = true;
        this.scene.tweens.add({
            targets: this.scrim,
            alpha: 0.65,
            duration: 250,
            ease: 'Quad.easeOut',
        });
        this.scene.tweens.add({
            targets: this.rootContainer,
            x: targetX,
            y: targetY,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 280,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.isTweening_ = false;
            },
        });
    }

    collapse(): void {
        if (!this.expanded_ || this.isTweening_) return;
        this.isTweening_ = true;
        this.expanded_ = false;
        this.scene.tweens.add({
            targets: this.scrim,
            alpha: 0,
            duration: 220,
            ease: 'Quad.easeIn',
        });
        this.scene.tweens.add({
            targets: this.rootContainer,
            x: this.compactX,
            y: this.compactY,
            scaleX: 1,
            scaleY: 1,
            duration: 260,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.isTweening_ = false;
            },
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

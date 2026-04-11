import { Scene } from 'phaser';

/** Deterministic mulberry32 RNG — same seed yields the same texture every boot. */
function seededRng(seed: number): () => number {
    let a = seed >>> 0;
    return (): number => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class BootScene extends Scene {
    constructor() {
        super('BootScene');
    }

    create(): void {
        this.generatePlayerFrames();
        this.generateLandmarkIcons();
        this.generateMiniMapBrush();
        this.generateGroundTiles();
        this.generateGrassTuft();
        this.generateBarkFlake();
        this.generateEucalyptTrees();
        this.generateFaunaSprites();
        this.generateNpcSprites();
        this.generateParticleTextures();
        this.scene.start('TitleScene');
    }

    /**
     * Bake small particle textures used by the Phase 6 emitters:
     * a soft circle (for smoke/dust/fireflies), a small ember, a leaf.
     */
    private generateParticleTextures(): void {
        // Soft circle — white, 16×16, radial alpha falloff via concentric discs
        {
            const gfx = this.add.graphics();
            for (let r = 8; r > 0; r--) {
                gfx.fillStyle(0xffffff, (9 - r) / 9 * 0.18);
                gfx.fillCircle(8, 8, r);
            }
            gfx.generateTexture('particle-soft', 16, 16);
            gfx.destroy();
        }
        // Ember — warm orange core
        {
            const gfx = this.add.graphics();
            gfx.fillStyle(0xffcc44, 0.85);
            gfx.fillCircle(4, 4, 3);
            gfx.fillStyle(0xff6624, 0.9);
            gfx.fillCircle(4, 4, 2);
            gfx.fillStyle(0xffffff, 0.8);
            gfx.fillCircle(4, 4, 1);
            gfx.generateTexture('particle-ember', 8, 8);
            gfx.destroy();
        }
        // Leaf — small eucalypt silhouette
        {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x6a4a28, 1);
            const pts = [
                new Phaser.Math.Vector2(6, 1),
                new Phaser.Math.Vector2(10, 6),
                new Phaser.Math.Vector2(6, 11),
                new Phaser.Math.Vector2(2, 6),
            ];
            gfx.fillPoints(pts, true);
            gfx.generateTexture('particle-leaf', 12, 12);
            gfx.destroy();
        }
    }

    /**
     * Bake four eucalypt variants in 3/4 perspective — trunk at the bottom,
     * canopy above. Trunk origin at (cx, h - 6) so when placed by world y,
     * the base of the tree sits on that y-value and depth-sorts naturally.
     *
     * River red gum / yellow box / manna gum / dead snag — four visual moods.
     */
    private generateEucalyptTrees(): void {
        const configs: Array<{
            key: string;
            trunkColor: number;
            trunkHighlight: number;
            canopyColor: number;
            canopyShadow: number;
            canopyHighlight: number;
            leafClusters: number;
            dead: boolean;
        }> = [
            {
                key: 'tree-redgum',
                trunkColor: 0x6a5a44,
                trunkHighlight: 0x9a8a70,
                canopyColor: 0x4a6a28,
                canopyShadow: 0x2a3e14,
                canopyHighlight: 0x6a8a32,
                leafClusters: 7,
                dead: false,
            },
            {
                key: 'tree-yellowbox',
                trunkColor: 0x8a7050,
                trunkHighlight: 0xb8a078,
                canopyColor: 0x5a7028,
                canopyShadow: 0x2e4014,
                canopyHighlight: 0x7a9030,
                leafClusters: 6,
                dead: false,
            },
            {
                key: 'tree-mannagum',
                trunkColor: 0x7a6a50,
                trunkHighlight: 0xa89870,
                canopyColor: 0x3a5a20,
                canopyShadow: 0x1e3010,
                canopyHighlight: 0x547a26,
                leafClusters: 8,
                dead: false,
            },
            {
                key: 'tree-snag',
                trunkColor: 0x5a4a38,
                trunkHighlight: 0x8a7858,
                canopyColor: 0x2a2010,
                canopyShadow: 0x0e0a04,
                canopyHighlight: 0x3a2810,
                leafClusters: 0,
                dead: true,
            },
        ];

        const w = 200;
        const h = 300;
        const cx = w / 2;
        const groundY = h - 8;

        for (const cfg of configs) {
            const gfx = this.add.graphics();

            // Ground shadow ellipse (soft, offset to the east to match sun angle)
            gfx.fillStyle(0x000000, 0.32);
            gfx.fillEllipse(cx + 14, groundY, 140, 30);
            gfx.fillStyle(0x000000, 0.18);
            gfx.fillEllipse(cx + 14, groundY, 180, 42);

            // Trunk — slightly curved, a bit taller than the shadow
            const trunkTop = cfg.dead ? h * 0.35 : h * 0.45;
            const trunkBaseW = 22;
            const trunkTopW = 10;
            const lean = cfg.dead ? -8 : 2;
            const trunkPts: Phaser.Math.Vector2[] = [
                new Phaser.Math.Vector2(cx - trunkBaseW / 2, groundY - 2),
                new Phaser.Math.Vector2(cx - trunkTopW / 2 + lean, trunkTop),
                new Phaser.Math.Vector2(cx + trunkTopW / 2 + lean, trunkTop),
                new Phaser.Math.Vector2(cx + trunkBaseW / 2, groundY - 2),
            ];
            gfx.fillStyle(cfg.trunkColor, 1);
            gfx.fillPoints(trunkPts, true);

            // Trunk highlight stripe (lit side)
            gfx.fillStyle(cfg.trunkHighlight, 0.5);
            const hiPts: Phaser.Math.Vector2[] = [
                new Phaser.Math.Vector2(cx - trunkBaseW / 2 + 3, groundY - 6),
                new Phaser.Math.Vector2(cx - trunkTopW / 2 + lean + 2, trunkTop + 4),
                new Phaser.Math.Vector2(cx - trunkTopW / 2 + lean + 5, trunkTop + 4),
                new Phaser.Math.Vector2(cx - trunkBaseW / 2 + 7, groundY - 6),
            ];
            gfx.fillPoints(hiPts, true);

            // Bark texture lines
            gfx.lineStyle(1, 0x2a1a10, 0.4);
            for (let k = 0; k < 5; k++) {
                const y = groundY - 20 - k * 30;
                gfx.lineBetween(cx - 8, y, cx + 8, y - 3);
            }

            // Branches — 3 branches for live trees, 5 for dead snag
            const branchCount = cfg.dead ? 5 : 3;
            gfx.lineStyle(4, cfg.trunkColor, 1);
            for (let k = 0; k < branchCount; k++) {
                const side = k % 2 === 0 ? 1 : -1;
                const startY = trunkTop + 10 + k * 12;
                const endX = cx + side * (40 + k * 10);
                const endY = trunkTop - 30 - k * 18;
                gfx.lineBetween(cx + (cfg.dead ? lean : 0), startY, endX, endY);
            }

            if (cfg.dead) {
                // Bare branch texture: thin forked stubs
                gfx.lineStyle(2, cfg.trunkColor, 0.9);
                gfx.lineBetween(cx - 30, trunkTop - 10, cx - 48, trunkTop - 60);
                gfx.lineBetween(cx - 48, trunkTop - 60, cx - 55, trunkTop - 90);
                gfx.lineBetween(cx + 25, trunkTop - 14, cx + 55, trunkTop - 50);
                gfx.lineBetween(cx + 55, trunkTop - 50, cx + 65, trunkTop - 80);
            } else {
                // Canopy: multiple overlapping clusters with shadow/mid/highlight
                const canopyCY = trunkTop - 30;
                const canopyRX = 90;
                const canopyRY = 70;
                // Shadow layer (back)
                gfx.fillStyle(cfg.canopyShadow, 0.85);
                gfx.fillEllipse(cx + 8, canopyCY + 8, canopyRX * 2, canopyRY * 2);
                // Mid
                gfx.fillStyle(cfg.canopyColor, 0.92);
                gfx.fillEllipse(cx, canopyCY, canopyRX * 1.85, canopyRY * 1.85);
                // Highlight (sunlit top-left)
                gfx.fillStyle(cfg.canopyHighlight, 0.75);
                gfx.fillEllipse(cx - 20, canopyCY - 18, canopyRX * 1.3, canopyRY * 1.2);

                // Random leaf clusters for silhouette irregularity
                for (let k = 0; k < cfg.leafClusters; k++) {
                    const a = (k / cfg.leafClusters) * Math.PI * 2;
                    const rr = canopyRX * 0.8;
                    const lx = cx + Math.cos(a) * rr;
                    const ly = canopyCY + Math.sin(a) * canopyRY * 0.7;
                    gfx.fillStyle(cfg.canopyColor, 0.6);
                    gfx.fillEllipse(lx, ly, 42, 32);
                    gfx.fillStyle(cfg.canopyHighlight, 0.4);
                    gfx.fillEllipse(lx - 5, ly - 5, 22, 18);
                }
            }

            gfx.generateTexture(cfg.key, w, h);
            gfx.destroy();
        }
    }

    /**
     * Bake small fauna silhouettes for ambient life: kangaroo, emu, cockatoo.
     * Two separate textures per animal (frame-0 and frame-1) so we can drive
     * a cheap setTexture-based idle animation from a scene timer without
     * registering Phaser anims (which want spritesheets, not plain textures).
     */
    private generateFaunaSprites(): void {
        // Kangaroo — 2 frames, 80x72 each, side profile
        {
            const w = 80;
            const h = 72;
            for (let f = 0; f < 2; f++) {
                const gfx = this.add.graphics();
                const xo = 0;
                const bodyY = f === 0 ? 0 : -2;
                // Shadow
                gfx.fillStyle(0x000000, 0.3);
                gfx.fillEllipse(xo + 40, h - 4, 46, 8);
                // Tail
                gfx.lineStyle(6, 0x6a4a2a, 1);
                gfx.lineBetween(xo + 14, h - 16 + bodyY, xo + 26, h - 22 + bodyY);
                // Body
                gfx.fillStyle(0x7a5630, 1);
                gfx.fillEllipse(xo + 38, h - 28 + bodyY, 46, 26);
                // Chest (lighter)
                gfx.fillStyle(0x9a7040, 0.85);
                gfx.fillEllipse(xo + 46, h - 24 + bodyY, 20, 18);
                // Legs (bent hind)
                gfx.lineStyle(5, 0x5a3e20, 1);
                gfx.lineBetween(xo + 30, h - 22 + bodyY, xo + 24, h - 8);
                gfx.lineBetween(xo + 36, h - 20 + bodyY, xo + 30, h - 8);
                // Front paws
                gfx.lineStyle(3, 0x6a4a2a, 1);
                gfx.lineBetween(xo + 54, h - 26 + bodyY, xo + 58, h - 16 + bodyY);
                gfx.lineBetween(xo + 56, h - 26 + bodyY, xo + 60, h - 16 + bodyY);
                // Head
                gfx.fillStyle(0x7a5630, 1);
                gfx.fillEllipse(xo + 58, h - 40 + bodyY, 18, 14);
                // Ears
                gfx.fillStyle(0x5a3a20, 1);
                gfx.fillTriangle(
                    xo + 56, h - 46 + bodyY,
                    xo + 54, h - 52 + bodyY,
                    xo + 60, h - 47 + bodyY,
                );
                gfx.fillTriangle(
                    xo + 60, h - 46 + bodyY,
                    xo + 58, h - 52 + bodyY,
                    xo + 64, h - 47 + bodyY,
                );
                // Eye
                gfx.fillStyle(0x000000, 1);
                gfx.fillCircle(xo + 62, h - 40 + bodyY, 1.2);
                gfx.generateTexture(`fauna-kangaroo-${f}`, w, h);
                gfx.destroy();
            }
        }

        // Emu — tall bird, 60x100 (2 frames)
        {
            const w = 60;
            const h = 100;
            for (let f = 0; f < 2; f++) {
                const gfx = this.add.graphics();
                const xo = 0;
                const legShift = f === 0 ? 0 : 3;
                // Shadow
                gfx.fillStyle(0x000000, 0.3);
                gfx.fillEllipse(xo + 30, h - 3, 34, 6);
                // Legs
                gfx.lineStyle(3, 0x3a2a14, 1);
                gfx.lineBetween(xo + 26, h - 40, xo + 22 + legShift, h - 5);
                gfx.lineBetween(xo + 32, h - 40, xo + 34 - legShift, h - 5);
                // Body — fluffy feather shape
                gfx.fillStyle(0x4a3a28, 1);
                gfx.fillEllipse(xo + 30, h - 50, 38, 32);
                gfx.fillStyle(0x6a4e30, 0.7);
                gfx.fillEllipse(xo + 26, h - 56, 24, 18);
                // Feather scraggle
                gfx.fillStyle(0x3a2a18, 0.8);
                gfx.fillCircle(xo + 42, h - 46, 3);
                gfx.fillCircle(xo + 44, h - 50, 2.5);
                gfx.fillCircle(xo + 40, h - 54, 2);
                // Neck
                gfx.lineStyle(5, 0x4a3a28, 1);
                gfx.lineBetween(xo + 22, h - 60, xo + 18, h - 82);
                // Head
                gfx.fillStyle(0x4a3a28, 1);
                gfx.fillEllipse(xo + 18, h - 85, 12, 10);
                // Beak
                gfx.fillStyle(0x2a1a10, 1);
                gfx.fillTriangle(xo + 12, h - 85, xo + 6, h - 84, xo + 12, h - 82);
                // Eye
                gfx.fillStyle(0xffffff, 1);
                gfx.fillCircle(xo + 18, h - 86, 1.5);
                gfx.fillStyle(0x000000, 1);
                gfx.fillCircle(xo + 18, h - 86, 0.8);
                gfx.generateTexture(`fauna-emu-${f}`, w, h);
                gfx.destroy();
            }
        }

        // Cockatoo — small white bird, 40x40 (2 frames)
        {
            const w = 40;
            const h = 40;
            for (let f = 0; f < 2; f++) {
                const gfx = this.add.graphics();
                const xo = 0;
                const wingLift = f === 0 ? 0 : -2;
                // Body
                gfx.fillStyle(0xf0ecdc, 1);
                gfx.fillEllipse(xo + 20, h - 18, 22, 18);
                // Wing
                gfx.fillStyle(0xd8d0b8, 1);
                gfx.fillEllipse(xo + 16, h - 18 + wingLift, 14, 10);
                // Head
                gfx.fillStyle(0xf0ecdc, 1);
                gfx.fillCircle(xo + 26, h - 26, 7);
                // Crest (yellow)
                gfx.fillStyle(0xf0c848, 1);
                gfx.fillTriangle(xo + 26, h - 32, xo + 22, h - 38, xo + 24, h - 32);
                gfx.fillTriangle(xo + 26, h - 32, xo + 28, h - 38, xo + 30, h - 32);
                // Beak
                gfx.fillStyle(0x4a3a1a, 1);
                gfx.fillTriangle(xo + 30, h - 26, xo + 34, h - 24, xo + 30, h - 22);
                // Eye
                gfx.fillStyle(0x000000, 1);
                gfx.fillCircle(xo + 28, h - 27, 1);
                // Feet
                gfx.lineStyle(2, 0x3a2a14, 1);
                gfx.lineBetween(xo + 18, h - 10, xo + 16, h - 3);
                gfx.lineBetween(xo + 22, h - 10, xo + 24, h - 3);
                // Shadow
                gfx.fillStyle(0x000000, 0.25);
                gfx.fillEllipse(xo + 20, h - 2, 18, 4);
                gfx.generateTexture(`fauna-cockatoo-${f}`, w, h);
                gfx.destroy();
            }
        }

        // Wombat - squat low body, 64x44 (2 frames)
        {
            const w = 64;
            const h = 44;
            for (let f = 0; f < 2; f++) {
                const gfx = this.add.graphics();
                const bodyY = f === 0 ? 0 : -1;
                // Shadow
                gfx.fillStyle(0x000000, 0.3);
                gfx.fillEllipse(32, h - 3, 44, 6);
                // Body
                gfx.fillStyle(0x6a4e30, 1);
                gfx.fillEllipse(32, h - 18 + bodyY, 46, 22);
                // Back lighter
                gfx.fillStyle(0x8a6840, 0.6);
                gfx.fillEllipse(30, h - 22 + bodyY, 30, 10);
                // Legs
                gfx.lineStyle(4, 0x3a2a18, 1);
                gfx.lineBetween(18, h - 12 + bodyY, 16, h - 4);
                gfx.lineBetween(28, h - 12 + bodyY, 26, h - 4);
                gfx.lineBetween(38, h - 12 + bodyY, 40, h - 4);
                gfx.lineBetween(46, h - 12 + bodyY, 48, h - 4);
                // Head
                gfx.fillStyle(0x6a4e30, 1);
                gfx.fillEllipse(50, h - 22 + bodyY, 18, 16);
                // Ear
                gfx.fillStyle(0x4a3220, 1);
                gfx.fillCircle(52, h - 30 + bodyY, 3);
                // Eye
                gfx.fillStyle(0x000000, 1);
                gfx.fillCircle(54, h - 22 + bodyY, 1.2);
                // Snout
                gfx.fillStyle(0x2a1a10, 1);
                gfx.fillCircle(58, h - 20 + bodyY, 1.6);
                gfx.generateTexture(`fauna-wombat-${f}`, w, h);
                gfx.destroy();
            }
        }

        // Wallaby - smaller reddish kangaroo, 60x56 (2 frames)
        {
            const w = 60;
            const h = 56;
            for (let f = 0; f < 2; f++) {
                const gfx = this.add.graphics();
                const bodyY = f === 0 ? 0 : -2;
                // Shadow
                gfx.fillStyle(0x000000, 0.3);
                gfx.fillEllipse(30, h - 3, 36, 6);
                // Tail
                gfx.lineStyle(5, 0x8a4020, 1);
                gfx.lineBetween(10, h - 12 + bodyY, 20, h - 18 + bodyY);
                // Body
                gfx.fillStyle(0x9a5030, 1);
                gfx.fillEllipse(28, h - 22 + bodyY, 34, 20);
                // Chest
                gfx.fillStyle(0xba6848, 0.85);
                gfx.fillEllipse(34, h - 20 + bodyY, 16, 14);
                // Hind legs
                gfx.lineStyle(4, 0x6a3018, 1);
                gfx.lineBetween(22, h - 16 + bodyY, 18, h - 4);
                gfx.lineBetween(28, h - 14 + bodyY, 24, h - 4);
                // Front paws
                gfx.lineStyle(2.5, 0x8a4020, 1);
                gfx.lineBetween(40, h - 20 + bodyY, 42, h - 12 + bodyY);
                // Head
                gfx.fillStyle(0x9a5030, 1);
                gfx.fillEllipse(44, h - 32 + bodyY, 14, 12);
                // Ears
                gfx.fillStyle(0x6a3018, 1);
                gfx.fillTriangle(43, h - 36 + bodyY, 41, h - 42 + bodyY, 46, h - 37 + bodyY);
                gfx.fillTriangle(46, h - 36 + bodyY, 44, h - 42 + bodyY, 48, h - 37 + bodyY);
                // Eye
                gfx.fillStyle(0x000000, 1);
                gfx.fillCircle(47, h - 32 + bodyY, 1);
                gfx.generateTexture(`fauna-wallaby-${f}`, w, h);
                gfx.destroy();
            }
        }

        // Goanna - long low lizard, 88x28 (2 frames)
        {
            const w = 88;
            const h = 28;
            for (let f = 0; f < 2; f++) {
                const gfx = this.add.graphics();
                const bend = f === 0 ? 0 : 1;
                // Shadow
                gfx.fillStyle(0x000000, 0.25);
                gfx.fillEllipse(44, h - 3, 60, 4);
                // Tail
                gfx.lineStyle(5, 0x4a5030, 1);
                gfx.lineBetween(2, h - 10, 20, h - 12 + bend);
                // Body
                gfx.fillStyle(0x5a6038, 1);
                gfx.fillEllipse(42, h - 12, 46, 10);
                // Back stripes
                gfx.fillStyle(0x3a4020, 0.8);
                gfx.fillEllipse(34, h - 13, 6, 3);
                gfx.fillEllipse(44, h - 13, 6, 3);
                gfx.fillEllipse(52, h - 13, 6, 3);
                // Legs
                gfx.lineStyle(3, 0x3a4020, 1);
                gfx.lineBetween(30, h - 10, 28 + bend, h - 4);
                gfx.lineBetween(38, h - 10, 40 - bend, h - 4);
                gfx.lineBetween(50, h - 10, 48 + bend, h - 4);
                gfx.lineBetween(58, h - 10, 60 - bend, h - 4);
                // Head
                gfx.fillStyle(0x5a6038, 1);
                gfx.fillEllipse(68, h - 14, 14, 8);
                // Eye
                gfx.fillStyle(0x000000, 1);
                gfx.fillCircle(72, h - 16, 0.9);
                // Tongue flick (frame 1)
                if (f === 1) {
                    gfx.lineStyle(1, 0xaa2020, 1);
                    gfx.lineBetween(76, h - 14, 82, h - 14);
                }
                gfx.generateTexture(`fauna-goanna-${f}`, w, h);
                gfx.destroy();
            }
        }
    }

    /**
     * Bake a neutral humanoid silhouette used as a placeholder for NPC
     * sprites when hand-drawn painted-npc-*.png assets are not yet present.
     * Deliberately abstract - no facial or skin-tone detail - so the
     * placeholder itself never conveys identity. The real art ships later
     * via SpriteFactory's painted-* upgrade path.
     */
    private generateNpcSprites(): void {
        const w = 48;
        const h = 80;
        for (let f = 0; f < 2; f++) {
            const gfx = this.add.graphics();
            const stride = f === 0 ? 0 : 2;
            // Shadow
            gfx.fillStyle(0x000000, 0.3);
            gfx.fillEllipse(24, h - 4, 28, 6);
            // Legs
            gfx.lineStyle(5, 0x2a1a10, 1);
            gfx.lineBetween(20, h - 36, 18 - stride, h - 6);
            gfx.lineBetween(28, h - 36, 30 + stride, h - 6);
            // Body / torso
            gfx.fillStyle(0x4a3020, 1);
            gfx.fillEllipse(24, h - 46, 22, 26);
            // Upper body highlight
            gfx.fillStyle(0x6a4430, 0.6);
            gfx.fillEllipse(22, h - 52, 14, 10);
            // Arms
            gfx.lineStyle(4, 0x2a1a10, 1);
            gfx.lineBetween(14, h - 48, 12 + stride, h - 30);
            gfx.lineBetween(34, h - 48, 36 - stride, h - 30);
            // Neck
            gfx.lineStyle(3, 0x2a1a10, 1);
            gfx.lineBetween(24, h - 60, 24, h - 64);
            // Head (neutral silhouette - no features)
            gfx.fillStyle(0x2a1a10, 1);
            gfx.fillCircle(24, h - 68, 8);
            gfx.generateTexture(`npc-default-${f}`, w, h);
            gfx.destroy();
        }
    }

    /**
     * Bake three 512×512 tileable ground textures that GameScene samples as
     * TileSprites for the entire world. Procedural, but far richer than the
     * old ellipse-scatter base: three-octave ellipse noise for pebble detail,
     * scattered grass tufts baked into variants, leaf-litter dots.
     *
     * Tileability: every ellipse drawn near an edge is also mirrored to the
     * opposite edge so there is no visible seam when the sprite repeats.
     */
    private generateGroundTiles(): void {
        const size = 512;

        // ---- Base loam: warm earth with multi-octave brown noise ----
        {
            const gfx = this.add.graphics();
            gfx.fillStyle(0x3a2e22, 1);
            gfx.fillRect(0, 0, size, size);
            const rng = seededRng(42);
            // Large patches
            for (let i = 0; i < 60; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const w = 80 + rng() * 160;
                const h = w * (0.5 + rng() * 0.7);
                const colors = [0x443828, 0x302418, 0x4a3a28, 0x342820, 0x3f3420];
                const c = colors[Math.floor(rng() * colors.length)];
                gfx.fillStyle(c, 0.22 + rng() * 0.2);
                gfx.fillEllipse(x, y, w, h);
                // Wrap mirror for seamless tiling
                if (x < 100) gfx.fillEllipse(x + size, y, w, h);
                if (x > size - 100) gfx.fillEllipse(x - size, y, w, h);
                if (y < 100) gfx.fillEllipse(x, y + size, w, h);
                if (y > size - 100) gfx.fillEllipse(x, y - size, w, h);
            }
            // Medium speckle
            for (let i = 0; i < 250; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const r = 8 + rng() * 18;
                const colors = [0x5a4a30, 0x2a2018, 0x4a3830, 0x302418];
                const c = colors[Math.floor(rng() * colors.length)];
                gfx.fillStyle(c, 0.12 + rng() * 0.18);
                gfx.fillEllipse(x, y, r, r * (0.6 + rng() * 0.6));
                if (x < 40) gfx.fillEllipse(x + size, y, r, r);
                if (x > size - 40) gfx.fillEllipse(x - size, y, r, r);
                if (y < 40) gfx.fillEllipse(x, y + size, r, r);
                if (y > size - 40) gfx.fillEllipse(x, y - size, r, r);
            }
            // High-frequency pebble/grit
            for (let i = 0; i < 2200; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const r = 0.6 + rng() * 2.2;
                const shade = rng();
                const c = shade < 0.5 ? 0x1f1812 : shade < 0.85 ? 0x5a4a38 : 0x7a5a3a;
                gfx.fillStyle(c, 0.22 + rng() * 0.35);
                gfx.fillCircle(x, y, r);
            }
            gfx.generateTexture('ground-loam', size, size);
            gfx.destroy();
        }

        // ---- Grass biome tile (semi-transparent so it alpha-blends over loam) ----
        {
            const gfx = this.add.graphics();
            const rng = seededRng(77);
            // Sparse green wash
            gfx.fillStyle(0x2a4a1c, 0.12);
            gfx.fillRect(0, 0, size, size);
            // Grass blade clusters — 300 small 3-stroke tufts
            for (let i = 0; i < 320; i++) {
                const cx = rng() * size;
                const cy = rng() * size;
                const tuftColor = rng() < 0.5 ? 0x3a5a2a : 0x2a4a1a;
                gfx.fillStyle(tuftColor, 0.45 + rng() * 0.25);
                for (let k = 0; k < 3; k++) {
                    const bx = cx + (rng() * 6 - 3);
                    const by = cy + (rng() * 4 - 2);
                    gfx.fillEllipse(bx, by, 1.8, 4.5);
                }
            }
            gfx.generateTexture('ground-grass', size, size);
            gfx.destroy();
        }

        // ---- Leaf-litter biome tile ----
        {
            const gfx = this.add.graphics();
            const rng = seededRng(123);
            gfx.fillStyle(0x000000, 0);
            gfx.fillRect(0, 0, size, size);
            // Eucalypt leaves — thin elongated shapes
            for (let i = 0; i < 180; i++) {
                const x = rng() * size;
                const y = rng() * size;
                const rot = rng() * Math.PI;
                const len = 8 + rng() * 14;
                const wid = 2 + rng() * 2;
                const shade = rng();
                const c = shade < 0.4 ? 0x6a4a2a : shade < 0.75 ? 0x7a5a2e : 0x8a6a38;
                gfx.fillStyle(c, 0.35 + rng() * 0.25);
                // Approximate rotated ellipse with 5 points
                const pts: Phaser.Math.Vector2[] = [];
                for (let p = 0; p < 8; p++) {
                    const a = (p / 8) * Math.PI * 2;
                    const ex = Math.cos(a) * len * 0.5;
                    const ey = Math.sin(a) * wid * 0.5;
                    const rx = ex * Math.cos(rot) - ey * Math.sin(rot);
                    const ry = ex * Math.sin(rot) + ey * Math.cos(rot);
                    pts.push(new Phaser.Math.Vector2(x + rx, y + ry));
                }
                gfx.fillPoints(pts, true);
            }
            gfx.generateTexture('ground-litter', size, size);
            gfx.destroy();
        }
    }

    /**
     * Bake a single 24×32 grass tuft with a small drop shadow so GameScene
     * can scatter hundreds of them across the world as depth-sorted sprites.
     */
    private generateGrassTuft(): void {
        const gfx = this.add.graphics();
        const w = 24;
        const h = 32;
        // Shadow
        gfx.fillStyle(0x000000, 0.22);
        gfx.fillEllipse(w / 2, h - 3, 14, 4);
        // Back blades — darker
        gfx.fillStyle(0x243e18, 0.9);
        for (let i = 0; i < 5; i++) {
            const bx = w / 2 + (i - 2) * 2.5;
            const bh = 18 + ((i * 13) % 5);
            const pts = [
                new Phaser.Math.Vector2(bx, h - 4),
                new Phaser.Math.Vector2(bx - 1.4, h - 4 - bh),
                new Phaser.Math.Vector2(bx + 1.4, h - 4 - bh + 1.5),
            ];
            gfx.fillPoints(pts, true);
        }
        // Front blades — lighter sunlit
        gfx.fillStyle(0x486a22, 0.95);
        for (let i = 0; i < 6; i++) {
            const bx = w / 2 + (i - 2.5) * 2.2;
            const bh = 14 + ((i * 7) % 6);
            const lean = ((i * 5) % 4) - 1.5;
            const pts = [
                new Phaser.Math.Vector2(bx, h - 3),
                new Phaser.Math.Vector2(bx + lean - 1, h - 3 - bh),
                new Phaser.Math.Vector2(bx + lean + 1, h - 3 - bh + 2),
            ];
            gfx.fillPoints(pts, true);
        }
        // Highlight stroke
        gfx.lineStyle(1, 0x6a8a30, 0.6);
        gfx.lineBetween(w / 2 - 1, h - 3, w / 2 - 2, h - 16);
        gfx.lineBetween(w / 2 + 2, h - 3, w / 2 + 3, h - 14);
        gfx.generateTexture('grass-tuft', w, h);
        gfx.destroy();
    }

    /** Small fallen eucalypt-bark flake used to scatter detail near trees. */
    private generateBarkFlake(): void {
        const gfx = this.add.graphics();
        const w = 18;
        const h = 10;
        gfx.fillStyle(0x000000, 0.18);
        gfx.fillEllipse(w / 2, h - 2, 12, 3);
        const shades = [0x7a5a3a, 0x8a6a44, 0x5a3e24];
        for (let i = 0; i < 3; i++) {
            gfx.fillStyle(shades[i], 0.7);
            const pts = [
                new Phaser.Math.Vector2(2 + i, 2 + i * 0.5),
                new Phaser.Math.Vector2(w - 3 - i * 0.5, 2 + i * 0.7),
                new Phaser.Math.Vector2(w - 4, h - 3),
                new Phaser.Math.Vector2(3, h - 3),
            ];
            gfx.fillPoints(pts, true);
        }
        gfx.generateTexture('bark-flake', w, h);
        gfx.destroy();
    }

    private generatePlayerFrames(): void {
        // Neutral contemporary bushwalker — hat, boots, backpack silhouette.
        // 4 frames for the walk cycle: two idle stances alternating, plus two
        // walk poses with opposite leg positions.
        for (let i = 0; i < 4; i++) {
            const gfx = this.add.graphics();
            const bobY = (i % 2 === 0) ? 0 : -2;
            const legL = [0, 4, 0, -4][i];
            const legR = [0, -4, 0, 4][i];

            const cx = 32;

            // Drop shadow
            gfx.fillStyle(0x000000, 0.28);
            gfx.fillEllipse(cx, 60, 22, 6);

            // Backpack (behind the torso) — warm dark canvas
            gfx.fillStyle(0x4a3a26, 1);
            gfx.fillRoundedRect(cx - 9, 21 + bobY, 18, 22, 3);
            // Pack top flap
            gfx.fillStyle(0x5a4830, 1);
            gfx.fillRoundedRect(cx - 9, 19 + bobY, 18, 6, 2);
            // Strap
            gfx.fillStyle(0x2a1f14, 1);
            gfx.fillRect(cx - 12, 22 + bobY, 3, 18);
            gfx.fillRect(cx + 9, 22 + bobY, 3, 18);
            // Rolled sleeping mat on top
            gfx.fillStyle(0x7a5a3a, 1);
            gfx.fillEllipse(cx, 18 + bobY, 20, 5);

            // Torso — long-sleeve shirt
            gfx.fillStyle(0x6a7a5c, 1);
            gfx.fillRoundedRect(cx - 8, 24 + bobY, 16, 20, 4);
            // Shirt shade side
            gfx.fillStyle(0x4a5a3c, 0.8);
            gfx.fillRoundedRect(cx + 2, 24 + bobY, 6, 20, 3);

            // Arms — visible on the sides
            gfx.fillStyle(0x6a7a5c, 1);
            gfx.fillRoundedRect(cx - 12, 26 + bobY, 5, 14, 2);
            gfx.fillRoundedRect(cx + 7, 26 + bobY, 5, 14, 2);
            // Hands
            gfx.fillStyle(0xbe9878, 1);
            gfx.fillCircle(cx - 10, 41 + bobY, 2.2);
            gfx.fillCircle(cx + 9, 41 + bobY, 2.2);

            // Neck
            gfx.fillStyle(0xbe9878, 1);
            gfx.fillRect(cx - 2, 18 + bobY, 4, 4);

            // Head
            gfx.fillStyle(0xbe9878, 1);
            gfx.fillCircle(cx, 14 + bobY, 7);
            // Subtle face shadow
            gfx.fillStyle(0x8a6850, 0.5);
            gfx.fillEllipse(cx + 2, 15 + bobY, 10, 8);

            // Wide-brim hat — crown + brim
            gfx.fillStyle(0x2a1f14, 1);
            gfx.fillEllipse(cx, 10 + bobY, 24, 5);
            gfx.fillStyle(0x3a2a18, 1);
            gfx.fillRoundedRect(cx - 7, 4 + bobY, 14, 7, 3);
            // Hat band
            gfx.fillStyle(0x8a6a38, 1);
            gfx.fillRect(cx - 7, 9 + bobY, 14, 1.5);

            // Eyes — tiny shadowed dots under the hat brim
            gfx.fillStyle(0x1a1210, 1);
            gfx.fillCircle(cx - 2, 14 + bobY, 0.9);
            gfx.fillCircle(cx + 2, 14 + bobY, 0.9);

            // Trousers / cargo pants
            gfx.fillStyle(0x403020, 1);
            gfx.fillRoundedRect(cx - 8 + legL, 43 + bobY, 7, 14, 2);
            gfx.fillRoundedRect(cx + 1 + legR, 43 + bobY, 7, 14, 2);

            // Boots
            gfx.fillStyle(0x1a120a, 1);
            gfx.fillEllipse(cx - 4 + legL, 58, 9, 4);
            gfx.fillEllipse(cx + 4 + legR, 58, 9, 4);

            gfx.generateTexture(`player-frame-${i}`, 64, 64);
            gfx.destroy();
        }
    }

    private generateLandmarkIcons(): void {
        const size = 128;
        const cx = size / 2;
        const cy = size / 2;

        this.drawBudjBimIcon(cx, cy, size);
        this.drawMountEcclesIcon(cx, cy, size);
        this.drawTyrendarraIcon(cx, cy, size);
        this.drawLakeCondahIcon(cx, cy, size);
        this.drawKurtonitjIcon(cx, cy, size);
        this.drawBrambukIcon(cx, cy, size);
        this.drawBunjilShelterIcon(cx, cy, size);
        this.drawGulgurnManjaIcon(cx, cy, size);
        this.drawNgamadjidjIcon(cx, cy, size);
        this.drawBilliminaIcon(cx, cy, size);
        this.drawMudadgadjiinIcon(cx, cy, size);
        this.drawDjabWurrungIcon(cx, cy, size);
        this.drawMountWilliamIcon(cx, cy, size);
        this.drawWurdiYouangIcon(cx, cy, size);
        this.drawKowSwampIcon(cx, cy, size);
        this.drawScarredTreesIcon(cx, cy, size);
        this.drawBuchanCavesIcon(cx, cy, size);
        this.drawGippslandLakesIcon(cx, cy, size);
        this.drawTarraBulgaIcon(cx, cy, size);
        this.drawPointNepeanIcon(cx, cy, size);
    }

    // =========================================================================
    // 1. BUDJ BIM — eel trap channels with water flow
    // =========================================================================
    private drawBudjBimIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x3a7d5c, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 14, 64, 28);

        gfx.fillStyle(0x3a3a3a, 0.7);
        gfx.fillEllipse(cx, cy + 4, 70, 42);
        gfx.fillStyle(0x4a4a44, 0.6);
        gfx.fillEllipse(cx, cy + 2, 62, 36);

        gfx.fillStyle(0x1a5a7a, 0.8);
        gfx.fillRect(cx - 30, cy - 2, 18, 5);
        gfx.fillRect(cx - 14, cy - 2, 6, 14);
        gfx.fillRect(cx - 14, cy + 8, 22, 5);
        gfx.fillRect(cx + 4, cy - 6, 5, 18);
        gfx.fillRect(cx + 4, cy - 6, 20, 5);
        gfx.fillRect(cx + 20, cy - 6, 5, 20);

        gfx.fillStyle(0x4a9aba, 0.4);
        gfx.fillRect(cx - 28, cy - 1, 6, 3);
        gfx.fillRect(cx - 12, cy + 9, 6, 3);
        gfx.fillRect(cx + 6, cy - 5, 6, 3);

        gfx.lineStyle(2.5, 0x2a4a3a, 0.7);
        gfx.beginPath();
        gfx.moveTo(cx - 26, cy);
        gfx.lineTo(cx - 20, cy + 1);
        gfx.lineTo(cx - 16, cy - 1);
        gfx.strokePath();

        gfx.fillStyle(0x5a5a50, 0.6);
        gfx.fillCircle(cx - 14, cy - 5, 3);
        gfx.fillCircle(cx - 14, cy + 16, 3);
        gfx.fillCircle(cx + 4, cy - 9, 3);
        gfx.fillCircle(cx + 24, cy - 9, 3);

        gfx.fillStyle(0x8ac8a0, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-budj-bim', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 2. MOUNT ECCLES — volcanic crater with crater lake
    // =========================================================================
    private drawMountEcclesIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x4a4a4a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 16, 64, 26);

        gfx.fillStyle(0x3a3a3a, 0.85);
        gfx.fillTriangle(cx - 40, cy + 18, cx - 6, cy - 28, cx + 40, cy + 18);
        gfx.fillStyle(0x4a4a42, 0.7);
        gfx.fillTriangle(cx - 34, cy + 16, cx - 4, cy - 22, cx + 36, cy + 16);

        gfx.fillStyle(0x5a5a50, 0.6);
        gfx.fillEllipse(cx, cy - 10, 30, 10);

        gfx.fillStyle(0x1a5a8a, 0.8);
        gfx.fillEllipse(cx, cy - 8, 22, 7);
        gfx.fillStyle(0x3a8aba, 0.4);
        gfx.fillEllipse(cx - 2, cy - 9, 12, 4);

        gfx.fillStyle(0x5a2a1a, 0.5);
        gfx.fillCircle(cx - 16, cy + 4, 3);
        gfx.fillCircle(cx + 18, cy + 6, 2.5);
        gfx.fillCircle(cx - 8, cy + 12, 2);

        gfx.fillStyle(0x3a5a2a, 0.5);
        gfx.fillEllipse(cx - 22, cy + 14, 10, 5);
        gfx.fillEllipse(cx + 24, cy + 12, 8, 4);

        gfx.fillStyle(0x6a6a5a, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-mount-eccles', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 3. TYRENDARRA — coastal stone house foundations
    // =========================================================================
    private drawTyrendarraIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x5a8a8a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 16, 66, 24);

        gfx.fillStyle(0x2a6a8a, 0.4);
        gfx.fillRect(cx - 40, cy - 30, 80, 24);
        gfx.lineStyle(1.5, 0x6aaacc, 0.3);
        gfx.beginPath();
        gfx.moveTo(cx - 36, cy - 10);
        gfx.lineTo(cx - 20, cy - 14);
        gfx.lineTo(cx - 4, cy - 10);
        gfx.lineTo(cx + 12, cy - 14);
        gfx.lineTo(cx + 36, cy - 10);
        gfx.strokePath();

        gfx.fillStyle(0xb0a070, 0.6);
        gfx.fillEllipse(cx, cy + 6, 72, 30);

        gfx.fillStyle(0x5a5a4a, 0.85);
        gfx.strokeCircle(cx - 14, cy + 2, 12);
        gfx.lineStyle(3, 0x5a5a4a, 0.8);
        gfx.strokeCircle(cx - 14, cy + 2, 12);
        gfx.strokeCircle(cx + 16, cy + 4, 10);

        gfx.fillStyle(0x6a6a5a, 0.7);
        gfx.fillCircle(cx - 22, cy - 2, 3);
        gfx.fillCircle(cx - 8, cy - 6, 2.5);
        gfx.fillCircle(cx - 18, cy + 10, 2.5);
        gfx.fillCircle(cx + 10, cy - 2, 2.5);
        gfx.fillCircle(cx + 22, cy + 8, 2);
        gfx.fillCircle(cx + 24, cy, 2.5);

        gfx.fillStyle(0x4a3a28, 0.4);
        gfx.fillCircle(cx - 14, cy + 2, 4);
        gfx.fillCircle(cx + 16, cy + 4, 3);

        gfx.fillStyle(0x8ac8c8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-tyrendarra', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 4. LAKE CONDAH — lake with mission ruins
    // =========================================================================
    private drawLakeCondahIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x6b4226, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 16, 64, 24);

        gfx.fillStyle(0x1a5a8a, 0.7);
        gfx.fillEllipse(cx - 6, cy + 6, 50, 28);
        gfx.fillStyle(0x2a7aaa, 0.4);
        gfx.fillEllipse(cx - 10, cy + 2, 30, 14);

        gfx.fillStyle(0x4a3a28, 0.6);
        gfx.fillEllipse(cx - 6, cy + 6, 56, 34);
        gfx.fillStyle(0x1a5a8a, 0.7);
        gfx.fillEllipse(cx - 6, cy + 6, 48, 26);

        gfx.fillStyle(0x6a5a4a, 0.85);
        gfx.fillRect(cx + 10, cy - 22, 14, 22);
        gfx.fillStyle(0x5a4a3a, 0.8);
        gfx.fillRect(cx + 12, cy - 20, 10, 18);

        gfx.fillStyle(0x6a5a4a, 0.9);
        gfx.fillRect(cx + 20, cy - 28, 5, 10);

        gfx.lineStyle(0.5, 0x8a7a6a, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx + 10, cy - 14); gfx.lineTo(cx + 24, cy - 14);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 10, cy - 8); gfx.lineTo(cx + 24, cy - 8);
        gfx.strokePath();

        gfx.lineStyle(1, 0x4a9aba, 0.3);
        gfx.beginPath();
        gfx.arc(cx - 10, cy + 6, 10, -0.5, 1.0);
        gfx.strokePath();

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-lake-condah', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 5. KURTONITJ — stone house ruins on grassy plain
    // =========================================================================
    private drawKurtonitjIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x5a6a3a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 16, 66, 24);

        gfx.fillStyle(0x3a5a2a, 0.5);
        gfx.fillEllipse(cx, cy + 6, 72, 36);
        gfx.fillStyle(0x4a6a3a, 0.3);
        gfx.fillEllipse(cx, cy + 4, 64, 28);

        gfx.fillStyle(0x5a5a4a, 0.85);
        gfx.fillRect(cx - 20, cy - 8, 4, 20);
        gfx.fillRect(cx + 16, cy - 6, 4, 18);
        gfx.fillRect(cx - 20, cy - 8, 40, 4);
        gfx.fillRect(cx - 16, cy + 8, 32, 4);

        gfx.fillStyle(0x6a6a5a, 0.7);
        gfx.fillCircle(cx - 20, cy - 6, 3);
        gfx.fillCircle(cx + 18, cy - 4, 2.5);
        gfx.fillCircle(cx - 18, cy + 10, 2.5);
        gfx.fillCircle(cx + 16, cy + 10, 2.5);

        gfx.fillStyle(0x4a4a3a, 0.6);
        gfx.fillCircle(cx - 8, cy + 14, 3);
        gfx.fillCircle(cx + 6, cy + 16, 2.5);
        gfx.fillCircle(cx - 2, cy + 18, 2);

        gfx.fillStyle(0x4a6a3a, 0.5);
        for (let i = 0; i < 6; i++) {
            gfx.fillTriangle(
                cx - 30 + i * 12, cy + 16,
                cx - 28 + i * 12, cy + 8,
                cx - 26 + i * 12, cy + 16
            );
        }

        gfx.fillStyle(0x8aa870, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-kurtonitj', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 6. BRAMBUK — cultural centre building with cockatoo-wing roof
    // =========================================================================
    private drawBrambukIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0xe8651a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 64, 20);

        gfx.fillStyle(0x5a4a38, 0.8);
        gfx.fillRect(cx - 24, cy, 48, 18);

        gfx.fillStyle(0x6a5a48, 0.9);
        gfx.fillTriangle(cx - 34, cy + 4, cx, cy - 28, cx + 34, cy);
        gfx.fillStyle(0x7a6a58, 0.7);
        gfx.fillTriangle(cx - 30, cy + 2, cx, cy - 24, cx + 30, cy - 2);

        gfx.fillStyle(0x3a2a1a, 0.7);
        gfx.fillRoundedRect(cx - 4, cy + 4, 8, 14, 2);

        gfx.fillStyle(0x8ac8e8, 0.4);
        gfx.fillRect(cx - 18, cy + 4, 6, 6);
        gfx.fillRect(cx + 12, cy + 4, 6, 6);

        gfx.fillStyle(0xc44b2a, 0.6);
        gfx.fillCircle(cx - 15, cy + 14, 1.5);
        gfx.fillCircle(cx + 15, cy + 14, 1.5);
        gfx.fillStyle(0xe8a050, 0.5);
        gfx.fillCircle(cx - 12, cy + 16, 1);
        gfx.fillCircle(cx + 12, cy + 16, 1);

        gfx.fillStyle(0x3a6a2a, 0.5);
        gfx.fillEllipse(cx - 30, cy + 14, 8, 10);
        gfx.fillEllipse(cx + 30, cy + 12, 7, 9);

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-brambuk', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 7. BUNJIL SHELTER — rock overhang with eagle painting
    // =========================================================================
    private drawBunjilShelterIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x8b5e3c, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 20);

        gfx.fillStyle(0x5a4a3a, 0.85);
        gfx.fillTriangle(cx - 36, cy - 10, cx + 36, cy - 18, cx + 38, cy + 8);
        gfx.fillTriangle(cx - 36, cy - 10, cx + 38, cy + 8, cx - 34, cy + 14);

        gfx.fillStyle(0x3a2a1a, 0.7);
        gfx.fillTriangle(cx - 30, cy, cx + 30, cy - 6, cx + 28, cy + 14);
        gfx.fillTriangle(cx - 30, cy, cx + 28, cy + 14, cx - 28, cy + 14);

        gfx.fillStyle(0x6a5a48, 0.6);
        gfx.fillTriangle(cx - 28, cy - 4, cx + 28, cy - 10, cx + 26, cy + 2);
        gfx.fillTriangle(cx - 28, cy - 4, cx + 26, cy + 2, cx - 26, cy + 4);

        gfx.fillStyle(0xc44b2a, 0.85);
        gfx.fillCircle(cx, cy - 2, 4);
        gfx.fillTriangle(cx - 20, cy + 4, cx - 4, cy - 4, cx - 6, cy + 2);
        gfx.fillTriangle(cx + 20, cy + 2, cx + 4, cy - 4, cx + 6, cy + 2);
        gfx.fillTriangle(cx - 3, cy + 2, cx + 3, cy + 2, cx, cy + 10);

        gfx.fillStyle(0xe8a050, 0.7);
        gfx.fillCircle(cx - 14, cy - 8, 2);
        gfx.fillCircle(cx + 14, cy - 10, 2);

        gfx.fillStyle(0x4a3a2a, 0.5);
        gfx.fillEllipse(cx - 8, cy + 18, 10, 4);
        gfx.fillEllipse(cx + 12, cy + 16, 8, 3);

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-bunjil-shelter', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 8. GULGURN MANJA — rock wall covered in hand stencils
    // =========================================================================
    private drawGulgurnManjaIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0xc44b2a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 62, 20);

        gfx.fillStyle(0x6a5a48, 0.85);
        gfx.fillRoundedRect(cx - 32, cy - 24, 64, 44, 4);
        gfx.fillStyle(0x7a6a58, 0.5);
        gfx.fillRoundedRect(cx - 28, cy - 20, 56, 36, 3);

        const handPositions = [
            { x: -18, y: -10 }, { x: 4, y: -14 }, { x: 20, y: -6 },
            { x: -10, y: 4 }, { x: 12, y: 2 }, { x: -20, y: 12 },
            { x: 6, y: 12 }, { x: 22, y: 10 }
        ];
        for (const hp of handPositions) {
            const hx = cx + hp.x;
            const hy = cy + hp.y;
            const col = hp.y < 0 ? 0xc44b2a : 0xe8a050;
            gfx.fillStyle(col, 0.8);
            gfx.fillCircle(hx, hy, 3);
            gfx.fillRect(hx - 3, hy - 8, 1.5, 5);
            gfx.fillRect(hx - 1, hy - 9, 1.5, 5);
            gfx.fillRect(hx + 1, hy - 8, 1.5, 5);
        }

        gfx.fillStyle(0x4a3a2a, 0.5);
        gfx.fillEllipse(cx - 10, cy + 20, 12, 4);
        gfx.fillEllipse(cx + 14, cy + 18, 10, 3);

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-gulgurn-manja', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 9. NGAMADJIDJ — rock shelter with white ghost-like figures
    // =========================================================================
    private drawNgamadjidjIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x6a5a7a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 20);

        gfx.fillStyle(0x5a4a3a, 0.85);
        gfx.fillTriangle(cx - 38, cy + 16, cx - 4, cy - 28, cx + 38, cy + 16);
        gfx.fillStyle(0x3a2a1a, 0.7);
        gfx.fillEllipse(cx, cy + 4, 44, 28);

        const ghostX = [cx - 14, cx + 2, cx + 16];
        for (const gx of ghostX) {
            gfx.fillStyle(0xe8e0d0, 0.85);
            gfx.fillCircle(gx, cy - 6, 5);
            gfx.fillRect(gx - 3, cy - 1, 6, 12);
            gfx.fillStyle(0x1a1a2a, 0.9);
            gfx.fillCircle(gx - 2, cy - 7, 1.2);
            gfx.fillCircle(gx + 2, cy - 7, 1.2);
            gfx.fillEllipse(gx, cy - 4, 3, 2);
        }

        gfx.fillStyle(0xe8e0d0, 0.3);
        gfx.lineStyle(1, 0xe8e0d0, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx - 24, cy - 2);
        gfx.lineTo(cx - 22, cy + 6);
        gfx.lineTo(cx - 20, cy - 1);
        gfx.strokePath();

        gfx.fillStyle(0x4a3a2a, 0.5);
        gfx.fillEllipse(cx, cy + 18, 30, 5);

        gfx.fillStyle(0xc8b8d8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-ngamadjidj', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 10. BILLIMINA — rock shelter entrance with layered paintings
    // =========================================================================
    private drawBilliminaIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x8b5e3c, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 20);

        gfx.fillStyle(0x6a5a48, 0.85);
        gfx.fillTriangle(cx - 36, cy - 6, cx + 36, cy - 16, cx + 38, cy + 14);
        gfx.fillTriangle(cx - 36, cy - 6, cx + 38, cy + 14, cx - 34, cy + 18);

        gfx.fillStyle(0x2a1a0a, 0.8);
        gfx.fillEllipse(cx, cy + 4, 40, 24);

        gfx.fillStyle(0xc44b2a, 0.7);
        gfx.lineStyle(2, 0xc44b2a, 0.7);
        gfx.beginPath();
        gfx.moveTo(cx - 12, cy - 6);
        gfx.lineTo(cx - 8, cy - 2);
        gfx.lineTo(cx - 14, cy + 2);
        gfx.strokePath();

        gfx.fillStyle(0xe8e0d0, 0.7);
        gfx.fillCircle(cx + 6, cy - 4, 3);
        gfx.fillRect(cx + 3, cy - 10, 1.5, 4);
        gfx.fillRect(cx + 5, cy - 12, 1.5, 5);
        gfx.fillRect(cx + 7, cy - 11, 1.5, 4);

        gfx.fillStyle(0xe8a050, 0.6);
        gfx.fillCircle(cx - 4, cy + 4, 2);
        gfx.fillCircle(cx + 10, cy + 2, 1.5);
        gfx.lineStyle(1, 0xd4813a, 0.5);
        gfx.strokeCircle(cx + 2, cy - 2, 4);
        gfx.strokeCircle(cx + 2, cy - 2, 7);

        gfx.fillStyle(0x4a3a2a, 0.5);
        gfx.fillEllipse(cx - 10, cy + 18, 14, 4);
        gfx.fillEllipse(cx + 14, cy + 16, 10, 3);

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-billimina', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 11. MUDADGADJIIN — rock shelter with ochre art
    // =========================================================================
    private drawMudadgadjiinIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0xc44b2a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 18);

        gfx.fillStyle(0x6a6a6a, 0.8);
        gfx.fillCircle(cx - 10, cy - 6, 22);
        gfx.fillCircle(cx + 16, cy - 2, 18);
        gfx.fillCircle(cx + 2, cy + 12, 16);

        gfx.fillStyle(0x8a8a8a, 0.4);
        gfx.fillCircle(cx - 14, cy - 12, 10);
        gfx.fillCircle(cx + 14, cy - 8, 8);

        gfx.fillStyle(0x2a2a2a, 0.7);
        gfx.fillEllipse(cx, cy + 2, 18, 12);

        gfx.fillStyle(0xc44b2a, 0.8);
        gfx.fillCircle(cx - 16, cy - 12, 3);
        gfx.fillRect(cx - 19, cy - 20, 1.5, 5);
        gfx.fillRect(cx - 17, cy - 22, 1.5, 6);
        gfx.fillRect(cx - 15, cy - 22, 1.5, 6);
        gfx.fillRect(cx - 13, cy - 20, 1.5, 5);

        gfx.fillStyle(0xe8a050, 0.7);
        gfx.fillCircle(cx + 8, cy - 14, 2);
        gfx.fillCircle(cx + 12, cy - 12, 1.5);
        gfx.fillCircle(cx + 16, cy - 14, 1.5);

        gfx.lineStyle(1.5, 0xe8e0d0, 0.5);
        gfx.beginPath();
        gfx.moveTo(cx + 4, cy - 16);
        gfx.lineTo(cx + 2, cy - 10);
        gfx.lineTo(cx + 6, cy - 6);
        gfx.strokePath();

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-mudadgadjiin', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 12. DJAB WURRUNG — large ancient tree with hollow (birthing tree)
    // =========================================================================
    private drawDjabWurrungIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x4a6a2a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 18);

        gfx.fillStyle(0x3a5a2a, 0.4);
        gfx.fillEllipse(cx, cy + 14, 60, 16);

        gfx.fillStyle(0x4a3018, 0.9);
        gfx.fillRoundedRect(cx - 12, cy - 14, 24, 36, 4);
        gfx.fillStyle(0x3a2010, 0.8);
        gfx.fillRoundedRect(cx - 10, cy - 12, 20, 32, 3);

        gfx.lineStyle(1, 0x2a1808, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx - 6, cy - 10); gfx.lineTo(cx - 5, cy + 18);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 6, cy - 8); gfx.lineTo(cx + 7, cy + 20);
        gfx.strokePath();

        gfx.fillStyle(0x1a0a00, 0.9);
        gfx.fillEllipse(cx, cy + 4, 10, 16);
        gfx.fillStyle(0x2a1a0a, 0.6);
        gfx.fillEllipse(cx, cy + 2, 6, 10);

        gfx.fillStyle(0x4a3018, 0.8);
        gfx.fillTriangle(cx - 10, cy - 10, cx - 28, cy - 6, cx - 12, cy - 6);
        gfx.fillTriangle(cx + 10, cy - 8, cx + 26, cy - 12, cx + 12, cy - 4);

        gfx.fillStyle(0x3a6a2a, 0.8);
        gfx.fillCircle(cx - 8, cy - 24, 14);
        gfx.fillCircle(cx + 10, cy - 22, 12);
        gfx.fillCircle(cx + 2, cy - 30, 11);
        gfx.fillCircle(cx - 16, cy - 18, 10);
        gfx.fillCircle(cx + 18, cy - 16, 9);
        gfx.fillStyle(0x4a8a3a, 0.5);
        gfx.fillCircle(cx - 4, cy - 28, 8);
        gfx.fillCircle(cx + 8, cy - 26, 7);

        gfx.fillStyle(0x8aa870, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-djab-wurrung', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 13. MOUNT WILLIAM — rocky hillside with quarry pits and stone flakes
    // =========================================================================
    private drawMountWilliamIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x6a6a5a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 18, 66, 20);

        gfx.fillStyle(0x5a5a4a, 0.6);
        gfx.fillTriangle(cx - 38, cy + 18, cx - 2, cy - 26, cx + 40, cy + 18);
        gfx.fillStyle(0x6a6a58, 0.5);
        gfx.fillTriangle(cx - 30, cy + 16, cx, cy - 20, cx + 34, cy + 16);

        gfx.fillStyle(0x7a7a6a, 0.4);
        gfx.fillTriangle(cx - 14, cy + 8, cx + 4, cy - 10, cx + 18, cy + 8);

        gfx.fillStyle(0x2a2a1a, 0.7);
        gfx.fillEllipse(cx - 10, cy + 2, 10, 6);
        gfx.fillEllipse(cx + 12, cy + 6, 8, 5);
        gfx.fillEllipse(cx + 2, cy - 4, 7, 4);

        gfx.fillStyle(0x8a8a7a, 0.7);
        gfx.fillTriangle(cx - 20, cy + 12, cx - 18, cy + 8, cx - 16, cy + 12);
        gfx.fillTriangle(cx + 16, cy + 14, cx + 19, cy + 10, cx + 22, cy + 14);
        gfx.fillTriangle(cx - 4, cy + 16, cx - 2, cy + 12, cx, cy + 16);
        gfx.fillTriangle(cx + 6, cy + 14, cx + 8, cy + 10, cx + 10, cy + 14);

        gfx.fillStyle(0x9a9a8a, 0.5);
        gfx.fillCircle(cx - 14, cy + 14, 2);
        gfx.fillCircle(cx + 8, cy + 16, 1.5);
        gfx.fillCircle(cx + 20, cy + 16, 1.5);
        gfx.fillCircle(cx - 6, cy + 10, 1);

        gfx.fillStyle(0x8a8a7a, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-mount-william', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 14. WURDI YOUANG — egg-shaped stone arrangement
    // =========================================================================
    private drawWurdiYouangIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x7a7a6a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 3, cy + 8, 68, 36);

        gfx.fillStyle(0x3a4a2a, 0.4);
        gfx.fillEllipse(cx, cy + 4, 72, 40);

        gfx.fillStyle(0x5a5a4a, 0.85);
        for (let a = 0; a < 20; a++) {
            const angle = (a / 20) * Math.PI * 2;
            const rx = 28;
            const ry = 18;
            const sx = cx + Math.cos(angle) * rx;
            const sy = cy + 2 + Math.sin(angle) * ry;
            const stoneSize = 3 + (a % 3) * 0.5;
            gfx.fillCircle(sx, sy, stoneSize);
        }

        gfx.fillStyle(0x6a6a5a, 0.9);
        gfx.fillCircle(cx - 28, cy + 2, 5);
        gfx.fillCircle(cx + 28, cy + 2, 5);
        gfx.fillCircle(cx, cy - 16, 4.5);

        gfx.lineStyle(1, 0xe8c170, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx + 34, cy + 2);
        gfx.lineTo(cx + 44, cy - 4);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 34, cy + 2);
        gfx.lineTo(cx + 44, cy + 8);
        gfx.strokePath();

        gfx.fillStyle(0xe8a050, 0.25);
        gfx.fillCircle(cx + 42, cy + 2, 8);

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-wurdi-youang', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 15. KOW SWAMP — wetland/swamp landscape with reeds
    // =========================================================================
    private drawKowSwampIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x3a6a4a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 14, 66, 26);

        gfx.fillStyle(0x4a3a28, 0.5);
        gfx.fillEllipse(cx, cy + 6, 72, 36);

        gfx.fillStyle(0x1a4a3a, 0.7);
        gfx.fillEllipse(cx, cy + 4, 56, 24);
        gfx.fillStyle(0x2a6a5a, 0.4);
        gfx.fillEllipse(cx - 4, cy + 2, 36, 14);

        gfx.lineStyle(1, 0x4a8a7a, 0.3);
        gfx.beginPath();
        gfx.arc(cx - 8, cy + 4, 8, -0.5, 1.0);
        gfx.strokePath();
        gfx.beginPath();
        gfx.arc(cx + 10, cy + 2, 6, -0.8, 0.8);
        gfx.strokePath();

        const reedPositions = [-24, -16, -8, 4, 14, 22, 28];
        for (const rx of reedPositions) {
            gfx.lineStyle(1.5, 0x3a5a2a, 0.7);
            gfx.beginPath();
            gfx.moveTo(cx + rx, cy + 10);
            gfx.lineTo(cx + rx - 1, cy - 10 - Math.abs(rx) * 0.3);
            gfx.strokePath();
            gfx.fillStyle(0x4a6a3a, 0.6);
            gfx.fillEllipse(cx + rx - 1, cy - 12 - Math.abs(rx) * 0.3, 3, 5);
        }

        gfx.fillStyle(0x3a5a2a, 0.5);
        gfx.fillEllipse(cx - 30, cy + 10, 8, 5);
        gfx.fillEllipse(cx + 32, cy + 8, 7, 4);

        gfx.fillStyle(0x6a9a7a, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-kow-swamp', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 16. SCARRED TREES — tree trunk with oval bark scar
    // =========================================================================
    private drawScarredTreesIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x4a8c3f, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 18);

        gfx.fillStyle(0x2a3a1a, 0.5);
        gfx.fillCircle(cx - 24, cy - 14, 12);
        gfx.fillCircle(cx + 22, cy - 10, 10);
        gfx.fillCircle(cx - 18, cy - 22, 10);
        gfx.fillCircle(cx + 16, cy - 20, 9);

        gfx.fillStyle(0x4a3a20, 0.5);
        gfx.fillRect(cx - 26, cy - 4, 4, 20);
        gfx.fillRect(cx + 20, cy - 2, 4, 18);

        gfx.fillStyle(0x4a3018, 0.9);
        gfx.fillRoundedRect(cx - 8, cy - 16, 16, 38, 3);

        gfx.lineStyle(1, 0x3a2010, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx - 4, cy - 12); gfx.lineTo(cx - 3, cy + 16);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 4, cy - 10); gfx.lineTo(cx + 5, cy + 18);
        gfx.strokePath();

        gfx.fillStyle(0x8a7a5a, 0.8);
        gfx.fillEllipse(cx, cy, 8, 16);
        gfx.fillStyle(0xb0a070, 0.7);
        gfx.fillEllipse(cx, cy, 5, 12);
        gfx.lineStyle(1.5, 0x5a4a30, 0.6);
        gfx.strokeEllipse(cx, cy, 8, 16);

        gfx.fillStyle(0x3a6a2a, 0.7);
        gfx.fillCircle(cx - 6, cy - 26, 12);
        gfx.fillCircle(cx + 8, cy - 24, 11);
        gfx.fillCircle(cx + 2, cy - 30, 10);

        gfx.fillStyle(0x4a6a3a, 0.4);
        gfx.fillEllipse(cx - 14, cy + 18, 10, 4);
        gfx.fillEllipse(cx + 12, cy + 16, 8, 3);

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-scarred-trees', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 17. BUCHAN CAVES — cave entrance with stalactites
    // =========================================================================
    private drawBuchanCavesIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x5a4a6a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 20);

        gfx.fillStyle(0x5a5a4a, 0.8);
        gfx.fillTriangle(cx - 36, cy + 18, cx - 10, cy - 30, cx + 10, cy + 18);
        gfx.fillTriangle(cx - 10, cy + 18, cx + 10, cy - 28, cx + 38, cy + 18);

        gfx.fillStyle(0x1a1a2a, 0.9);
        gfx.fillEllipse(cx, cy + 4, 32, 28);

        gfx.fillStyle(0x0a0a1a, 0.7);
        gfx.fillEllipse(cx, cy + 6, 24, 20);

        gfx.fillStyle(0x6a6a5a, 0.8);
        gfx.fillTriangle(cx - 10, cy - 8, cx - 8, cy - 8, cx - 9, cy + 2);
        gfx.fillTriangle(cx - 3, cy - 10, cx - 1, cy - 10, cx - 2, cy + 4);
        gfx.fillTriangle(cx + 5, cy - 8, cx + 7, cy - 8, cx + 6, cy + 0);
        gfx.fillTriangle(cx + 11, cy - 6, cx + 13, cy - 6, cx + 12, cy - 1);

        gfx.fillStyle(0x5a5a4a, 0.7);
        gfx.fillTriangle(cx - 6, cy + 16, cx - 4, cy + 16, cx - 5, cy + 8);
        gfx.fillTriangle(cx + 4, cy + 16, cx + 6, cy + 16, cx + 5, cy + 10);

        gfx.fillStyle(0x8a8aaa, 0.3);
        gfx.fillCircle(cx - 4, cy - 4, 1.5);
        gfx.fillCircle(cx + 8, cy - 2, 1);
        gfx.fillCircle(cx - 8, cy + 6, 1);

        gfx.fillStyle(0xc8b8e8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-buchan-caves', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 18. GIPPSLAND LAKES — large lake/lagoon with waterbirds
    // =========================================================================
    private drawGippslandLakesIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x2a6a9a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 14, 68, 26);

        gfx.fillStyle(0x6a9aba, 0.3);
        gfx.fillEllipse(cx, cy - 6, 72, 30);

        gfx.fillStyle(0x1a5a8a, 0.7);
        gfx.fillEllipse(cx, cy + 2, 66, 28);
        gfx.fillStyle(0x2a7aaa, 0.4);
        gfx.fillEllipse(cx - 6, cy, 44, 16);

        gfx.lineStyle(1, 0x4a9aba, 0.3);
        gfx.beginPath();
        gfx.arc(cx - 10, cy + 2, 10, -0.4, 0.8);
        gfx.strokePath();
        gfx.beginPath();
        gfx.arc(cx + 14, cy, 8, -0.6, 0.6);
        gfx.strokePath();

        gfx.fillStyle(0x3a5a2a, 0.6);
        gfx.fillEllipse(cx - 30, cy + 8, 10, 12);
        gfx.fillEllipse(cx + 30, cy + 6, 8, 10);

        gfx.fillStyle(0xb0a070, 0.5);
        gfx.fillEllipse(cx + 28, cy + 14, 12, 4);
        gfx.fillEllipse(cx - 26, cy + 16, 10, 3);

        const birdXs = [-12, 0, 14];
        for (const bx of birdXs) {
            gfx.lineStyle(1.5, 0xe8e0d0, 0.7);
            gfx.beginPath();
            gfx.moveTo(cx + bx - 4, cy - 14);
            gfx.lineTo(cx + bx, cy - 18);
            gfx.lineTo(cx + bx + 4, cy - 14);
            gfx.strokePath();
        }

        gfx.fillStyle(0x8ac8e8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-gippsland-lakes', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 19. TARRA BULGA — tall forest with ferns (rainforest)
    // =========================================================================
    private drawTarraBulgaIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x2a5a2a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 18, 60, 18);

        gfx.fillStyle(0x3a2a18, 0.8);
        gfx.fillRect(cx - 20, cy - 20, 5, 40);
        gfx.fillRect(cx - 4, cy - 26, 6, 46);
        gfx.fillRect(cx + 14, cy - 18, 5, 38);

        gfx.fillStyle(0x2a1a10, 0.6);
        gfx.fillRect(cx - 32, cy - 8, 4, 28);
        gfx.fillRect(cx + 26, cy - 6, 4, 26);

        gfx.fillStyle(0x1a4a1a, 0.85);
        gfx.fillCircle(cx - 18, cy - 28, 14);
        gfx.fillCircle(cx, cy - 34, 13);
        gfx.fillCircle(cx + 16, cy - 26, 12);
        gfx.fillStyle(0x2a6a2a, 0.7);
        gfx.fillCircle(cx - 8, cy - 30, 10);
        gfx.fillCircle(cx + 8, cy - 30, 9);

        gfx.fillStyle(0x1a5a1a, 0.6);
        gfx.fillCircle(cx - 30, cy - 14, 8);
        gfx.fillCircle(cx + 28, cy - 12, 7);

        const fernPositions = [
            { x: -26, y: 8 }, { x: -12, y: 12 },
            { x: 6, y: 10 }, { x: 22, y: 14 }
        ];
        for (const fp of fernPositions) {
            gfx.fillStyle(0x2a7a2a, 0.6);
            gfx.fillTriangle(
                cx + fp.x - 8, cy + fp.y + 2,
                cx + fp.x, cy + fp.y - 6,
                cx + fp.x + 8, cy + fp.y + 2
            );
            gfx.fillStyle(0x3a8a3a, 0.4);
            gfx.fillTriangle(
                cx + fp.x - 5, cy + fp.y + 1,
                cx + fp.x, cy + fp.y - 3,
                cx + fp.x + 5, cy + fp.y + 1
            );
        }

        gfx.fillStyle(0x4a8a4a, 0.15);
        gfx.fillEllipse(cx, cy, 50, 30);

        gfx.fillStyle(0x6aa86a, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-tarra-bulga', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // 20. POINT NEPEAN — coastal headland with waves
    // =========================================================================
    private drawPointNepeanIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        gfx.fillStyle(0x3a7a9a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 4, cy + 16, 68, 22);

        gfx.fillStyle(0x1a5a8a, 0.6);
        gfx.fillEllipse(cx, cy + 2, 74, 40);
        gfx.fillStyle(0x2a7aaa, 0.3);
        gfx.fillEllipse(cx + 8, cy - 4, 50, 24);

        gfx.lineStyle(1.5, 0x6aaacc, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx - 36, cy + 10);
        gfx.lineTo(cx - 24, cy + 6);
        gfx.lineTo(cx - 12, cy + 10);
        gfx.lineTo(cx, cy + 6);
        gfx.lineTo(cx + 12, cy + 10);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx - 30, cy + 16);
        gfx.lineTo(cx - 18, cy + 12);
        gfx.lineTo(cx - 6, cy + 16);
        gfx.lineTo(cx + 6, cy + 12);
        gfx.lineTo(cx + 18, cy + 16);
        gfx.strokePath();

        gfx.fillStyle(0xb0a070, 0.7);
        gfx.fillTriangle(cx - 36, cy + 4, cx - 10, cy - 20, cx + 6, cy + 4);

        gfx.fillStyle(0x5a5a4a, 0.8);
        gfx.fillTriangle(cx - 30, cy + 2, cx - 12, cy - 16, cx + 2, cy + 2);

        gfx.fillStyle(0x3a5a2a, 0.6);
        gfx.fillCircle(cx - 20, cy - 8, 6);
        gfx.fillCircle(cx - 14, cy - 4, 5);
        gfx.fillCircle(cx - 8, cy - 10, 5);

        gfx.fillStyle(0x6a6a5a, 0.6);
        gfx.fillCircle(cx - 4, cy + 2, 3);
        gfx.fillCircle(cx - 28, cy + 2, 2.5);

        gfx.fillStyle(0xe8e0d0, 0.5);
        gfx.fillEllipse(cx + 20, cy - 4, 16, 3);
        gfx.fillEllipse(cx + 26, cy + 2, 12, 2);

        gfx.fillStyle(0x8ac8e8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-point-nepean', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // MINI-MAP BRUSH — radial gradient for fog reveal
    // =========================================================================
    private generateMiniMapBrush(): void {
        const gfx = this.add.graphics();
        const brushSize = 40;
        const center = brushSize / 2;

        for (let r = center; r > 0; r -= 1) {
            const alpha = r / center;
            gfx.fillStyle(0xffffff, alpha);
            gfx.fillCircle(center, center, r);
        }

        gfx.generateTexture('minimap-reveal-brush', brushSize, brushSize);
        gfx.destroy();
    }
}

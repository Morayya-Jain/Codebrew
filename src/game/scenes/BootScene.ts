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

        this.drawCampfireIcon(cx, cy, size);
        this.drawWaterholeIcon(cx, cy, size);
        this.drawRockArtIcon(cx, cy, size);
        this.drawMeetingPlaceIcon(cx, cy, size);
        this.drawBushTuckerIcon(cx, cy, size);
        this.drawSonglineIcon(cx, cy, size);
        this.drawAncestorTreeIcon(cx, cy, size);
        this.drawGrindingStonesIcon(cx, cy, size);
        this.drawEmuDreamingIcon(cx, cy, size);
        this.drawPossumCloakIcon(cx, cy, size);
    }

    // =========================================================================
    // CAMPFIRE — crossed logs with flames and ember dots
    // =========================================================================
    private drawCampfireIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Outer glow
        gfx.fillStyle(0xe8651a, 0.1);
        gfx.fillCircle(cx, cy, 58);

        // Ground shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 14, 60, 28);

        // Ash circle on ground
        gfx.fillStyle(0x2a2018, 0.6);
        gfx.fillEllipse(cx, cy + 8, 56, 26);

        // Crossed logs
        gfx.fillStyle(0x5a3a1a, 0.9);
        // Log 1 (bottom-left to top-right)
        gfx.fillRect(cx - 26, cy + 2, 52, 7);
        // Log 2 (top-left to bottom-right, rotated via two triangles approach)
        gfx.fillRect(cx - 4, cy - 12, 7, 36);

        // Log bark texture
        gfx.fillStyle(0x3a2410, 0.5);
        gfx.fillRect(cx - 20, cy + 4, 8, 3);
        gfx.fillRect(cx + 10, cy + 3, 6, 3);
        gfx.fillRect(cx - 2, cy - 6, 3, 8);

        // Flames — layered triangles
        // Outer flame (red-orange)
        gfx.fillStyle(0xc44010, 0.8);
        gfx.fillTriangle(cx - 14, cy + 2, cx, cy - 30, cx + 14, cy + 2);
        // Mid flame (orange)
        gfx.fillStyle(0xe8651a, 0.85);
        gfx.fillTriangle(cx - 10, cy + 2, cx - 2, cy - 22, cx + 8, cy + 2);
        // Inner flame (yellow)
        gfx.fillStyle(0xf0a030, 0.9);
        gfx.fillTriangle(cx - 5, cy + 2, cx + 2, cy - 14, cx + 7, cy + 2);
        // Core (bright yellow-white)
        gfx.fillStyle(0xf8d070, 0.95);
        gfx.fillTriangle(cx - 2, cy + 2, cx + 1, cy - 8, cx + 4, cy + 2);

        // Side flame wisps
        gfx.fillStyle(0xe8651a, 0.6);
        gfx.fillTriangle(cx + 10, cy + 4, cx + 16, cy - 10, cx + 18, cy + 4);
        gfx.fillTriangle(cx - 12, cy + 4, cx - 16, cy - 8, cx - 8, cy + 4);

        // Ember dots scattered around
        gfx.fillStyle(0xf0a030, 0.7);
        gfx.fillCircle(cx - 18, cy - 8, 1.5);
        gfx.fillCircle(cx + 20, cy - 6, 1.5);
        gfx.fillCircle(cx - 8, cy - 26, 1);
        gfx.fillCircle(cx + 10, cy - 22, 1);
        gfx.fillCircle(cx + 4, cy - 32, 1);
        gfx.fillCircle(cx - 12, cy - 18, 1);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-campfire', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // WATERHOLE — isometric oval with depth, ripples, bank
    // =========================================================================
    private drawWaterholeIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Outer glow
        gfx.fillStyle(0x1a8fe8, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground/bank shadow
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 3, cy + 6, 72, 44);

        // Outer bank (earth)
        gfx.fillStyle(0x4a3a28, 0.7);
        gfx.fillEllipse(cx, cy + 2, 68, 42);

        // Inner bank ring
        gfx.fillStyle(0x3a2a18, 0.6);
        gfx.fillEllipse(cx, cy + 2, 58, 36);

        // Deep water (dark)
        gfx.fillStyle(0x0a3a5a, 0.85);
        gfx.fillEllipse(cx, cy + 2, 50, 30);

        // Mid water
        gfx.fillStyle(0x1a5a8a, 0.7);
        gfx.fillEllipse(cx - 2, cy, 42, 24);

        // Shallow water / reflection highlight
        gfx.fillStyle(0x2a7aaa, 0.5);
        gfx.fillEllipse(cx - 6, cy - 3, 26, 14);

        // Light reflection spot
        gfx.fillStyle(0x8ac8e8, 0.4);
        gfx.fillEllipse(cx - 10, cy - 5, 12, 6);

        // Ripple arcs
        gfx.lineStyle(1, 0x4a9aba, 0.3);
        gfx.beginPath();
        gfx.arc(cx + 6, cy + 4, 14, -0.5, 1.2);
        gfx.strokePath();

        gfx.lineStyle(1, 0x4a9aba, 0.2);
        gfx.beginPath();
        gfx.arc(cx + 8, cy + 4, 20, -0.3, 0.8);
        gfx.strokePath();

        // Small reeds/plants at edges
        gfx.fillStyle(0x3a6a2a, 0.6);
        gfx.fillEllipse(cx + 28, cy - 4, 6, 10);
        gfx.fillEllipse(cx + 24, cy - 8, 5, 8);
        gfx.fillEllipse(cx - 26, cy + 8, 5, 9);

        // Dot-art ring
        gfx.fillStyle(0x8ac8e8, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-waterhole', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // ROCK ART — tilted rock face with ochre markings
    // =========================================================================
    private drawRockArtIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0xc44b2a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 5, cy + 20, 56, 18);

        // Rock face — tilted slab (parallelogram via triangles)
        // Back face (darker)
        gfx.fillStyle(0x4a3a30, 0.8);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 28, cy - 32, cx + 32, cy + 16);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 32, cy + 16, cx - 20, cy + 20);

        // Front face (lighter)
        gfx.fillStyle(0x6a5a48, 0.85);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 28, cy - 32, cx + 26, cy + 12);
        gfx.fillTriangle(cx - 24, cy - 28, cx + 26, cy + 12, cx - 22, cy + 16);

        // Rock surface highlight
        gfx.fillStyle(0x7a6a58, 0.4);
        gfx.fillTriangle(cx - 18, cy - 22, cx + 14, cy - 26, cx + 12, cy - 4);
        gfx.fillTriangle(cx - 18, cy - 22, cx + 12, cy - 4, cx - 16, cy + 0);

        // Ochre paintings on rock
        // Hand stencil (simplified)
        gfx.fillStyle(0xc44b2a, 0.8);
        gfx.fillCircle(cx - 4, cy - 10, 5);
        // Fingers
        gfx.fillStyle(0xc44b2a, 0.7);
        gfx.fillRect(cx - 8, cy - 20, 2, 8);
        gfx.fillRect(cx - 5, cy - 22, 2, 9);
        gfx.fillRect(cx - 2, cy - 22, 2, 9);
        gfx.fillRect(cx + 1, cy - 20, 2, 8);

        // Wavy lines (serpent/river)
        gfx.lineStyle(2, 0xd4813a, 0.7);
        gfx.beginPath();
        gfx.moveTo(cx + 6, cy - 6);
        gfx.lineTo(cx + 12, cy - 2);
        gfx.lineTo(cx + 8, cy + 2);
        gfx.lineTo(cx + 14, cy + 6);
        gfx.strokePath();

        // Animal track dots
        gfx.fillStyle(0xe8a050, 0.7);
        gfx.fillCircle(cx - 10, cy + 4, 2);
        gfx.fillCircle(cx - 6, cy + 8, 1.5);
        gfx.fillCircle(cx - 2, cy + 6, 1.5);

        // Concentric circles (sacred site symbol)
        gfx.lineStyle(1.5, 0xc44b2a, 0.6);
        gfx.strokeCircle(cx + 16, cy - 14, 4);
        gfx.strokeCircle(cx + 16, cy - 14, 7);

        // Dot-art accent
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-rock-art', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // MEETING PLACE — circular ground with seated figures/logs
    // =========================================================================
    private drawMeetingPlaceIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x8b5e3c, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground shadow
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 3, cy + 8, 70, 40);

        // Cleared ground area (isometric ellipse)
        gfx.fillStyle(0x4a3a28, 0.7);
        gfx.fillEllipse(cx, cy + 4, 66, 38);

        // Inner cleared area (lighter)
        gfx.fillStyle(0x5a4a38, 0.6);
        gfx.fillEllipse(cx, cy + 4, 50, 28);

        // Center dance area
        gfx.fillStyle(0x3a2a1a, 0.5);
        gfx.fillEllipse(cx, cy + 4, 28, 16);

        // Seated figures/logs around perimeter
        const seats = [
            { angle: 0, dist: 24 }, { angle: Math.PI * 0.33, dist: 22 },
            { angle: Math.PI * 0.67, dist: 24 }, { angle: Math.PI, dist: 22 },
            { angle: Math.PI * 1.33, dist: 24 }, { angle: Math.PI * 1.67, dist: 22 },
        ];
        seats.forEach(({ angle, dist }) => {
            const sx = cx + Math.cos(angle) * dist;
            const sy = cy + 4 + Math.sin(angle) * dist * 0.58;
            // Log seat
            gfx.fillStyle(0x5a3a20, 0.7);
            gfx.fillEllipse(sx, sy, 10, 5);
            // Small figure silhouette
            gfx.fillStyle(0x3a2a1a, 0.6);
            gfx.fillCircle(sx, sy - 4, 3);
        });

        // Footprint patterns on ground
        gfx.fillStyle(0x6a5a48, 0.3);
        gfx.fillCircle(cx - 6, cy + 2, 1.5);
        gfx.fillCircle(cx + 4, cy + 6, 1.5);
        gfx.fillCircle(cx - 2, cy + 8, 1.5);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.15);
        for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 38, cy + 4 + Math.sin(angle) * 22, 1.5);
        }

        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-meeting-place', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // BUSH TUCKER — bushy shrub with berries
    // =========================================================================
    private drawBushTuckerIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x4a8c3f, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.12);
        gfx.fillEllipse(cx + 5, cy + 16, 54, 22);

        // Trunk/stem
        gfx.fillStyle(0x4a3220, 0.8);
        gfx.fillRoundedRect(cx - 3, cy + 4, 6, 18, 2);

        // Bush canopy layers (multiple overlapping circles for organic shape)
        // Back leaves (darker)
        gfx.fillStyle(0x2a4a1a, 0.8);
        gfx.fillCircle(cx - 14, cy - 6, 14);
        gfx.fillCircle(cx + 14, cy - 4, 13);
        gfx.fillCircle(cx, cy - 16, 15);

        // Mid leaves
        gfx.fillStyle(0x3a6a2a, 0.8);
        gfx.fillCircle(cx - 8, cy - 10, 13);
        gfx.fillCircle(cx + 10, cy - 8, 12);
        gfx.fillCircle(cx + 2, cy - 4, 14);

        // Front leaves (lighter, highlight)
        gfx.fillStyle(0x4a8a3a, 0.6);
        gfx.fillCircle(cx - 10, cy - 14, 8);
        gfx.fillCircle(cx + 6, cy - 16, 7);

        // Berries (red/yellow dots)
        gfx.fillStyle(0xc43030, 0.85);
        gfx.fillCircle(cx - 16, cy - 2, 3);
        gfx.fillCircle(cx + 12, cy + 0, 2.5);
        gfx.fillCircle(cx - 4, cy - 20, 2.5);
        gfx.fillCircle(cx + 18, cy - 8, 2);

        gfx.fillStyle(0xe8b030, 0.8);
        gfx.fillCircle(cx - 8, cy - 22, 2);
        gfx.fillCircle(cx + 8, cy + 2, 2.5);
        gfx.fillCircle(cx - 18, cy - 10, 2);

        // Small flowers
        gfx.fillStyle(0xf0e060, 0.7);
        gfx.fillCircle(cx + 16, cy - 14, 2);
        gfx.fillCircle(cx - 12, cy - 18, 1.5);

        // Ground herbs/grass at base
        gfx.fillStyle(0x3a5a2a, 0.5);
        gfx.fillEllipse(cx - 10, cy + 14, 8, 4);
        gfx.fillEllipse(cx + 8, cy + 12, 7, 3);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-bush-tucker', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // SONGLINE — winding path with dot-art trail
    // =========================================================================
    private drawSonglineIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x9b59b6, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground shadow
        gfx.fillStyle(0x000000, 0.1);
        gfx.fillEllipse(cx + 3, cy + 4, 60, 50);

        // Winding path base (earth tone)
        gfx.lineStyle(10, 0x4a3a28, 0.5);
        gfx.beginPath();
        gfx.moveTo(cx - 36, cy + 20);
        gfx.lineTo(cx - 20, cy + 8);
        gfx.lineTo(cx - 8, cy - 4);
        gfx.lineTo(cx + 4, cy - 14);
        gfx.lineTo(cx + 16, cy - 8);
        gfx.lineTo(cx + 28, cy - 18);
        gfx.lineTo(cx + 38, cy - 26);
        gfx.strokePath();

        // Path inner line (lighter)
        gfx.lineStyle(5, 0x6a5a48, 0.4);
        gfx.beginPath();
        gfx.moveTo(cx - 36, cy + 20);
        gfx.lineTo(cx - 20, cy + 8);
        gfx.lineTo(cx - 8, cy - 4);
        gfx.lineTo(cx + 4, cy - 14);
        gfx.lineTo(cx + 16, cy - 8);
        gfx.lineTo(cx + 28, cy - 18);
        gfx.lineTo(cx + 38, cy - 26);
        gfx.strokePath();

        // Dot-art trail along path (the traditional songline depiction)
        const pathPoints = [
            { x: cx - 36, y: cy + 20 }, { x: cx - 20, y: cy + 8 },
            { x: cx - 8, y: cy - 4 }, { x: cx + 4, y: cy - 14 },
            { x: cx + 16, y: cy - 8 }, { x: cx + 28, y: cy - 18 },
            { x: cx + 38, y: cy - 26 },
        ];

        // Main trail dots (purple-tinted)
        gfx.fillStyle(0x9b59b6, 0.7);
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const p1 = pathPoints[i];
            const p2 = pathPoints[i + 1];
            for (let t = 0; t < 1; t += 0.25) {
                const x = p1.x + (p2.x - p1.x) * t;
                const y = p1.y + (p2.y - p1.y) * t;
                gfx.fillCircle(x, y, 2.5);
            }
        }

        // Surrounding spirit dots (smaller, fading outward)
        gfx.fillStyle(0xb07ad0, 0.4);
        for (let i = 0; i < pathPoints.length; i++) {
            const p = pathPoints[i];
            for (let a = 0; a < 4; a++) {
                const angle = (a / 4) * Math.PI * 2 + i * 0.8;
                gfx.fillCircle(p.x + Math.cos(angle) * 10, p.y + Math.sin(angle) * 10, 1.5);
            }
        }

        // Wavy energy lines emanating from path
        gfx.lineStyle(1, 0x9b59b6, 0.3);
        gfx.beginPath();
        gfx.moveTo(cx - 14, cy + 16);
        gfx.lineTo(cx - 18, cy + 24);
        gfx.lineTo(cx - 12, cy + 30);
        gfx.strokePath();

        gfx.beginPath();
        gfx.moveTo(cx + 20, cy - 2);
        gfx.lineTo(cx + 26, cy + 6);
        gfx.lineTo(cx + 22, cy + 14);
        gfx.strokePath();

        // Concentric circles at key points (sacred sites along songline)
        gfx.lineStyle(1, 0xe8c170, 0.4);
        gfx.strokeCircle(cx - 8, cy - 4, 6);
        gfx.strokeCircle(cx - 8, cy - 4, 10);
        gfx.strokeCircle(cx + 16, cy - 8, 5);
        gfx.strokeCircle(cx + 16, cy - 8, 9);

        // Outer dot ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-songline', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // ANCESTOR TREE — tree trunk with scar mark + canopy
    // =========================================================================
    private drawAncestorTreeIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x6b4226, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 6, cy + 18, 48, 20);

        // Trunk
        gfx.fillStyle(0x4a3018, 0.9);
        gfx.fillRoundedRect(cx - 10, cy - 16, 20, 40, 4);

        // Bark texture lines
        gfx.lineStyle(1, 0x3a2010, 0.5);
        gfx.beginPath();
        gfx.moveTo(cx - 6, cy - 12); gfx.lineTo(cx - 5, cy + 16);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 4, cy - 10); gfx.lineTo(cx + 5, cy + 18);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx - 2, cy - 14); gfx.lineTo(cx - 1, cy + 20);
        gfx.strokePath();

        // Scar mark (lighter oval cut into trunk)
        gfx.fillStyle(0x8a7a5a, 0.8);
        gfx.fillEllipse(cx, cy, 10, 18);

        // Inner scar (raw wood color)
        gfx.fillStyle(0xb0a070, 0.7);
        gfx.fillEllipse(cx, cy, 7, 14);

        // Scar edge line
        gfx.lineStyle(1.5, 0x5a4a30, 0.6);
        gfx.strokeEllipse(cx, cy, 10, 18);

        // Canopy above (multiple green circles)
        gfx.fillStyle(0x1a3a16, 0.7);
        gfx.fillCircle(cx - 8, cy - 28, 16);
        gfx.fillCircle(cx + 10, cy - 26, 14);
        gfx.fillCircle(cx + 2, cy - 34, 15);

        // Canopy highlight
        gfx.fillStyle(0x2a5a22, 0.5);
        gfx.fillCircle(cx - 10, cy - 32, 9);
        gfx.fillCircle(cx + 4, cy - 38, 8);

        // Branches visible at trunk-canopy junction
        gfx.fillStyle(0x4a3018, 0.6);
        gfx.fillRect(cx - 16, cy - 18, 12, 3);
        gfx.fillRect(cx + 6, cy - 16, 10, 3);

        // Roots at base
        gfx.fillStyle(0x4a3018, 0.5);
        gfx.fillEllipse(cx - 12, cy + 22, 10, 4);
        gfx.fillEllipse(cx + 10, cy + 20, 8, 3);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-ancestor-tree', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // GRINDING STONES — mortar + pestle + scattered seeds
    // =========================================================================
    private drawGrindingStonesIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x7a7a6a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 12, 60, 28);

        // Large flat base stone (mortar)
        gfx.fillStyle(0x5a5a4a, 0.85);
        gfx.fillEllipse(cx, cy + 6, 52, 28);

        // Base stone depth (darker bottom edge)
        gfx.fillStyle(0x3a3a2a, 0.6);
        gfx.fillEllipse(cx, cy + 12, 52, 16);

        // Base stone top surface (lighter)
        gfx.fillStyle(0x6a6a5a, 0.7);
        gfx.fillEllipse(cx, cy + 2, 46, 22);

        // Grinding groove worn into stone
        gfx.fillStyle(0x4a4a3a, 0.6);
        gfx.fillEllipse(cx - 2, cy + 2, 28, 12);

        // Groove highlight (smooth worn surface)
        gfx.fillStyle(0x7a7a6a, 0.4);
        gfx.fillEllipse(cx - 6, cy, 16, 7);

        // Pestle stone (smaller, on top)
        gfx.fillStyle(0x5a5a4a, 0.9);
        gfx.fillEllipse(cx + 8, cy - 6, 20, 10);

        // Pestle highlight
        gfx.fillStyle(0x8a8a7a, 0.5);
        gfx.fillEllipse(cx + 5, cy - 8, 12, 5);

        // Pestle shadow on mortar
        gfx.fillStyle(0x000000, 0.1);
        gfx.fillEllipse(cx + 8, cy, 18, 6);

        // Scattered seeds around
        gfx.fillStyle(0x8a7a4a, 0.7);
        gfx.fillCircle(cx - 28, cy + 2, 1.5);
        gfx.fillCircle(cx - 24, cy - 4, 1);
        gfx.fillCircle(cx + 26, cy + 8, 1.5);
        gfx.fillCircle(cx - 20, cy + 10, 1);
        gfx.fillCircle(cx + 22, cy - 2, 1);

        // Ochre powder traces (reddish)
        gfx.fillStyle(0xc46030, 0.3);
        gfx.fillCircle(cx - 14, cy + 4, 3);
        gfx.fillCircle(cx + 14, cy + 6, 2);

        // Flour/seed dust
        gfx.fillStyle(0xd0c8a0, 0.25);
        gfx.fillEllipse(cx - 4, cy + 16, 16, 6);

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-grinding-stones', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // EMU DREAMING — three-toed footprint + trailing prints
    // =========================================================================
    private drawEmuDreamingIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x8b6b3a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Ground base
        gfx.fillStyle(0x3a2a1a, 0.3);
        gfx.fillEllipse(cx, cy + 4, 64, 50);

        // Main large footprint — three toes
        const drawEmuFoot = (fx: number, fy: number, scale: number, alpha: number) => {
            // Center pad
            gfx.fillStyle(0x8b6b3a, alpha);
            gfx.fillCircle(fx, fy, 5 * scale);

            // Three toes (forward-pointing, slight splay)
            // Left toe
            gfx.fillStyle(0x8b6b3a, alpha);
            gfx.fillEllipse(fx - 8 * scale, fy - 16 * scale, 5 * scale, 14 * scale);
            // Center toe (longest)
            gfx.fillEllipse(fx, fy - 20 * scale, 5 * scale, 16 * scale);
            // Right toe
            gfx.fillEllipse(fx + 8 * scale, fy - 16 * scale, 5 * scale, 14 * scale);

            // Toe tips (claws)
            gfx.fillStyle(0x6a4a2a, alpha * 0.8);
            gfx.fillCircle(fx - 8 * scale, fy - 22 * scale, 2 * scale);
            gfx.fillCircle(fx, fy - 27 * scale, 2 * scale);
            gfx.fillCircle(fx + 8 * scale, fy - 22 * scale, 2 * scale);
        };

        // Main footprint (large, center)
        drawEmuFoot(cx - 4, cy + 8, 1.6, 0.85);

        // Trailing smaller footprints
        drawEmuFoot(cx + 16, cy - 18, 0.8, 0.5);
        drawEmuFoot(cx - 14, cy - 30, 0.6, 0.35);

        // Dreaming energy dots around main footprint
        gfx.fillStyle(0xb08a50, 0.5);
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            gfx.fillCircle(cx - 4 + Math.cos(angle) * 28, cy + 8 + Math.sin(angle) * 28, 2);
        }

        // Outer spirit dots
        gfx.fillStyle(0xb08a50, 0.3);
        for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2;
            gfx.fillCircle(cx - 4 + Math.cos(angle) * 38, cy + 4 + Math.sin(angle) * 38, 1.5);
        }

        // Dot-art ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-emu-dreaming', size, size);
        gfx.destroy();
    }

    // =========================================================================
    // POSSUM SKIN CLOAK — draped cloak shape with panel markings
    // =========================================================================
    private drawPossumCloakIcon(cx: number, cy: number, size: number): void {
        const gfx = this.add.graphics();

        // Glow
        gfx.fillStyle(0x5a4a3a, 0.08);
        gfx.fillCircle(cx, cy, 58);

        // Shadow
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillEllipse(cx + 4, cy + 18, 50, 18);

        // Cloak shape — draped trapezoid (wider at shoulders, narrower at bottom)
        // Back/darker layer
        gfx.fillStyle(0x3a2a1a, 0.8);
        gfx.fillTriangle(cx - 26, cy - 24, cx + 26, cy - 24, cx + 20, cy + 22);
        gfx.fillTriangle(cx - 26, cy - 24, cx + 20, cy + 22, cx - 20, cy + 22);

        // Main cloak surface
        gfx.fillStyle(0x5a4a3a, 0.9);
        gfx.fillTriangle(cx - 24, cy - 22, cx + 24, cy - 22, cx + 18, cy + 20);
        gfx.fillTriangle(cx - 24, cy - 22, cx + 18, cy + 20, cx - 18, cy + 20);

        // Fur texture highlight (top/left = lighter)
        gfx.fillStyle(0x7a6a5a, 0.4);
        gfx.fillTriangle(cx - 20, cy - 18, cx + 10, cy - 18, cx + 4, cy + 2);
        gfx.fillTriangle(cx - 20, cy - 18, cx + 4, cy + 2, cx - 16, cy + 2);

        // Panel dividing lines (etched patterns)
        gfx.lineStyle(1.5, 0x3a2a1a, 0.6);
        // Horizontal panels
        gfx.beginPath();
        gfx.moveTo(cx - 22, cy - 8); gfx.lineTo(cx + 20, cy - 8);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx - 20, cy + 6); gfx.lineTo(cx + 18, cy + 6);
        gfx.strokePath();
        // Vertical panels
        gfx.beginPath();
        gfx.moveTo(cx - 6, cy - 22); gfx.lineTo(cx - 4, cy + 20);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(cx + 8, cy - 22); gfx.lineTo(cx + 10, cy + 20);
        gfx.strokePath();

        // Decorative dots in panels (clan markings)
        gfx.fillStyle(0xe8c170, 0.5);
        // Top-left panel
        gfx.fillCircle(cx - 14, cy - 16, 2);
        // Top-center panel
        gfx.fillCircle(cx + 2, cy - 16, 2);
        // Mid-left panel
        gfx.fillCircle(cx - 14, cy - 2, 1.5);
        gfx.fillCircle(cx - 12, cy + 2, 1.5);
        // Mid-center panel — concentric circles (totem)
        gfx.lineStyle(1, 0xe8c170, 0.45);
        gfx.strokeCircle(cx + 2, cy - 1, 3);
        gfx.strokeCircle(cx + 2, cy - 1, 6);
        // Bottom panels
        gfx.fillStyle(0xe8c170, 0.4);
        gfx.fillCircle(cx - 12, cy + 12, 1.5);
        gfx.fillCircle(cx + 4, cy + 12, 1.5);
        gfx.fillCircle(cx + 14, cy + 10, 1.5);

        // Shoulder/collar line
        gfx.lineStyle(2, 0x4a3a2a, 0.7);
        gfx.beginPath();
        gfx.moveTo(cx - 24, cy - 22);
        gfx.lineTo(cx, cy - 26);
        gfx.lineTo(cx + 24, cy - 22);
        gfx.strokePath();

        // Outer dot ring
        gfx.fillStyle(0xe8c170, 0.2);
        for (let a = 0; a < 10; a++) {
            const angle = (a / 10) * Math.PI * 2;
            gfx.fillCircle(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48, 2);
        }

        gfx.generateTexture('landmark-possum-cloak', size, size);
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

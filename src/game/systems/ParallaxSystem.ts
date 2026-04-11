import { Scene } from 'phaser';

interface ParallaxLayerConfig {
    readonly suffix: string;
    readonly scrollX: number;
    readonly scrollY: number;
    readonly depth: number;
    readonly alpha: number;
}

const LAYERS: ReadonlyArray<ParallaxLayerConfig> = [
    { suffix: 'haze', scrollX: 0.05, scrollY: 0.02, depth: 0.05, alpha: 0.6 },
    { suffix: 'far',  scrollX: 0.12, scrollY: 0.05, depth: 0.08, alpha: 0.85 },
    { suffix: 'mid',  scrollX: 0.28, scrollY: 0.10, depth: 0.12, alpha: 0.9 },
];

/**
 * Chapter-specific painted parallax background. Three layers (haze / far / mid)
 * per chapter, loaded optionally by PreloadScene under the painted-* keyspace.
 *
 * When no PNGs are present, init() is a no-op and the existing procedural
 * hills from GameScene remain the only background visible. When PNGs do
 * exist, they sit at low depth (0.05-0.12) beneath the hills (depth 0.5),
 * creating an atmospheric far-distance effect the procedural layer can't.
 *
 * Scroll factors mean the layers track the camera at fractional rates so
 * they appear far away when the player walks across the 8000x6400 world.
 *
 * Lifecycle:
 *   - init(chapterId) creates the layers for a given chapter
 *   - destroy() removes them
 *   - switchChapter(newId) destroys the old and initialises the new
 */
export class ParallaxSystem {
    private readonly scene: Scene;
    private layers_: Phaser.GameObjects.Image[] = [];
    private currentChapterId_: string | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    init(chapterId: string, worldW: number, worldH: number): void {
        // Skip if the same chapter is already initialised.
        if (this.currentChapterId_ === chapterId && this.layers_.length > 0) {
            return;
        }
        this.destroy();
        this.currentChapterId_ = chapterId;

        for (const cfg of LAYERS) {
            const key = `painted-bg-${chapterId}-${cfg.suffix}`;
            if (!this.scene.textures.exists(key)) continue;
            const source = this.scene.textures.get(key).source[0];
            if (!source || source.width < 2 || source.height < 2) continue;

            const img = this.scene.add.image(worldW / 2, worldH / 2, key);
            img.setScrollFactor(cfg.scrollX, cfg.scrollY);
            img.setDepth(cfg.depth);
            img.setAlpha(cfg.alpha);
            img.setDisplaySize(worldW, worldH);
            this.layers_.push(img);
        }
    }

    switchChapter(newChapterId: string, worldW: number, worldH: number): void {
        this.init(newChapterId, worldW, worldH);
    }

    hasLayers(): boolean {
        return this.layers_.length > 0;
    }

    destroy(): void {
        for (const layer of this.layers_) layer.destroy();
        this.layers_ = [];
        this.currentChapterId_ = null;
    }
}

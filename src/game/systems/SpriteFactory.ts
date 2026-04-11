import { Scene } from 'phaser';

/**
 * Drop-in upgrade helper for painted PNG assets.
 *
 * The game's visual assets are all generated procedurally by BootScene as a
 * fallback. When a painter delivers PNG replacements (trees, rocks, fauna,
 * player, ground tiles, parallax backgrounds), they are loaded optionally
 * by PreloadScene. If the PNG exists, it lands in the scene's texture
 * cache under the SAME key the procedural version uses. SpriteFactory lets
 * caller code ask "do we have a painted version for this key?" and pick
 * the right source without if/else noise.
 *
 * The `width > 1` check is important: Phaser creates a tiny fallback
 * texture when an image fails to load (size 1x1). Without this check,
 * SpriteFactory would mistakenly return the broken 1x1 as if it were a
 * real painted asset.
 */
export class SpriteFactory {
    private readonly scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Returns `key` if a real PNG was loaded under that key, otherwise
     * `fallbackKey` (or `key` again if no fallback was given).
     *
     * Usage:
     *   this.add.image(x, y, factory.textureFor('tree-redgum'))
     */
    textureFor(key: string, fallbackKey?: string): string {
        if (this.hasPainted(key)) return key;
        return fallbackKey ?? key;
    }

    /**
     * True if a real PNG exists in the texture cache under this key.
     * False if the key is missing OR if the texture is the phantom 1x1
     * placeholder Phaser creates when a load fails.
     */
    hasPainted(key: string): boolean {
        if (!this.scene.textures.exists(key)) return false;
        const tex = this.scene.textures.get(key);
        const source = tex.source?.[0];
        if (!source) return false;
        return source.width > 1 && source.height > 1;
    }
}

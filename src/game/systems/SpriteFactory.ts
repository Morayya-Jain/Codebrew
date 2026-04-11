import { Scene } from 'phaser';

/**
 * Drop-in upgrade helper for painted PNG assets.
 *
 * The game's visual assets are all generated procedurally by BootScene as a
 * fallback. When a painter delivers PNG replacements, PreloadScene loads
 * them under a parallel `painted-*` key namespace (e.g. `painted-tree-redgum`).
 * This file asks "is a painted version available for this procedural key?"
 * and returns the correct key to use.
 *
 * Using distinct painted-* keys (rather than overwriting the procedural key)
 * keeps the fallback path airtight: if a PNG load fails, the procedural
 * texture is untouched and usable, no texture manager race conditions.
 *
 * The `width > 1` check guards against Phaser's phantom 1x1 placeholder
 * texture that can appear when a load fails part-way.
 */
export class SpriteFactory {
    private readonly scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Given a procedural key (e.g. 'tree-redgum'), return the painted key
     * if one was loaded, otherwise the procedural key. Callers never need
     * to know whether the texture is painted or not.
     *
     *   this.add.image(x, y, factory.textureFor('tree-redgum'))
     */
    textureFor(proceduralKey: string): string {
        const paintedKey = `painted-${proceduralKey}`;
        if (this.isValid_(paintedKey)) return paintedKey;
        return proceduralKey;
    }

    /**
     * True if a real painted PNG is available for this procedural key.
     * Used by post-FX tuning to soften grain/bloom when painted assets
     * land in the scene.
     */
    hasPainted(proceduralKey: string): boolean {
        return this.isValid_(`painted-${proceduralKey}`);
    }

    private isValid_(key: string): boolean {
        if (!this.scene.textures.exists(key)) return false;
        const tex = this.scene.textures.get(key);
        const source = tex.source?.[0];
        if (!source) return false;
        return source.width > 1 && source.height > 1;
    }
}

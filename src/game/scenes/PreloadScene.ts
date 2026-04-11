import { Scene } from 'phaser';
import type { LandmarksFile, Region } from '../types';

interface PreloadSceneData {
    region?: Region;
}

export class PreloadScene extends Scene {
    private region: Region = 'victoria';

    constructor() {
        super('PreloadScene');
    }

    init(data: PreloadSceneData = {}): void {
        this.region = data.region ?? 'victoria';

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        this.add.text(centerX, centerY - 60, 'Indigenous Australia : The Journey', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '36px',
            color: '#e8c170',
        }).setOrigin(0.5);

        this.add.text(centerX, centerY - 20, 'Loading...', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            color: '#a0886a',
        }).setOrigin(0.5);

        this.add.rectangle(centerX, centerY + 30, 320, 20).setStrokeStyle(2, 0xe8c170);
        const bar = this.add.rectangle(centerX - 155, centerY + 30, 4, 14, 0xe8c170);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (306 * progress);
        });
    }

    preload(): void {
        this.load.setPath('assets');
        // Chapter data - legacy system, no longer wired into gameplay but still
        // loaded so any lingering reference resolves to a valid JSON blob
        // rather than crashing. Treasure hunt mode replaces chapter flow.
        this.load.json('chapters', 'chapters.json');
        // NPC dialogue data - four scripted Aboriginal characters the player
        // can walk up to and talk with. Failure to load is handled at the
        // GameScene consumer side (no NPCs spawn).
        this.load.json('npcs', 'npcs.json');

        // Data-driven hero photograph loading. BootScene preloaded
        // landmarks.json already, so the cache is warm by the time this
        // preload() runs. We iterate the chosen region's landmarks and queue
        // one image load per entry that declares a heroImageFile. Missing
        // files are handled by the loaderror handler below (silent fallback
        // to the procedural icon baked in BootScene).
        const landmarksData = this.cache.json.get('landmarks') as LandmarksFile | undefined;
        if (landmarksData?.landmarks) {
            const regionDir = this.region === 'nsw' ? 'NSW' : 'Victoria';
            for (const lm of landmarksData.landmarks) {
                if (lm.region !== this.region) continue;
                if (!lm.heroImageFile) continue;
                this.load.image(
                    `landmark-hero-${lm.id}`,
                    `landmarks/${regionDir}/${lm.heroImageFile}`,
                );
            }
        }

        // ---------- Phase C painted assets (painted-* keyspace) -----------
        // Each load is optional. Drop the PNG into the matching subdirectory
        // of public/assets/ and it upgrades on next reload. Missing files
        // fall through the loaderror handler silently.

        // Trees
        for (const variant of ['redgum', 'yellowbox', 'mannagum', 'snag']) {
            this.load.image(`painted-tree-${variant}`, `trees/tree_${variant}.png`);
        }

        // Rocks (new sprite path - the procedural rocks will still render if these are absent)
        for (const variant of ['1', '2', '3']) {
            this.load.image(`painted-rock-${variant}`, `rocks/rock_${variant}.png`);
        }

        // Fauna: 6 species, 2 frames each. All optional - procedural fallbacks
        // ship from BootScene.generateFaunaSprites.
        for (const species of ['kangaroo', 'emu', 'cockatoo', 'wombat', 'wallaby', 'goanna']) {
            for (let f = 0; f < 2; f++) {
                this.load.image(`painted-fauna-${species}-${f}`, `fauna/fauna_${species}_${f}.png`);
            }
        }

        // NPCs: 4 characters, 2 frames each. All optional - procedural
        // silhouette fallback ships from BootScene.generateNpcSprites.
        for (const id of ['aunty-marjorie', 'ranger-david', 'young-fisher', 'weaver-nan']) {
            for (let f = 0; f < 2; f++) {
                this.load.image(`painted-npc-${id}-${f}`, `npcs/npc_${id.replace(/-/g, '_')}_${f}.png`);
            }
        }

        // Ground tile replacements (same canonical keys, but Phase C loads
        // them under the painted-* namespace so the SpriteFactory lookup is
        // consistent even for non-sprite tiles).
        for (const kind of ['loam', 'grass', 'litter']) {
            this.load.image(`painted-ground-${kind}`, `ground/ground_${kind}.png`);
        }

        // Player sprite sheet (4 walk frames at 64x64)
        this.load.spritesheet('painted-player-walk', 'player/player_walk.png', {
            frameWidth: 64, frameHeight: 64,
        });
        this.load.image('painted-player-idle', 'player/player_idle.png');

        // Parallax background layers - one set per chapter, three depths each.
        const chapterIds = [
            'the-campfire-welcome', 'following-water', 'reading-the-stone',
            'the-emu-in-the-sky', 'caring-for-country', 'corroboree-night',
        ];
        for (const ch of chapterIds) {
            for (const layer of ['far', 'mid', 'haze']) {
                this.load.image(`painted-bg-${ch}-${layer}`, `bg/${ch}_${layer}.png`);
            }
        }

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            const key = file.key ?? '';
            // Phase C: every painted-* family is optional.
            if (key.startsWith('painted-')) return;
            // Legacy landmark hero path - still tolerated.
            if (key.startsWith('landmark-hero-')) return;
            // chapters.json is optional in the single-chapter fallback path.
            if (key === 'chapters') {
                // eslint-disable-next-line no-console
                console.warn('[PreloadScene] chapters.json not found - running in free-exploration fallback');
                return;
            }
            // npcs.json is optional. Without it, no NPCs spawn but gameplay
            // continues normally.
            if (key === 'npcs') {
                // eslint-disable-next-line no-console
                console.warn('[PreloadScene] npcs.json not found - NPCs disabled');
                return;
            }
            // eslint-disable-next-line no-console
            console.warn(`[PreloadScene] Failed to load: ${key} (${file.url})`);
        });
    }

    create(): void {
        // Pick the player animation source. Painted sprite sheet wins if it
        // loaded successfully (the texture source is larger than 1x1); else
        // fall back to the four individual procedural frames from BootScene.
        const hasPaintedSheet = this.textures.exists('painted-player-walk')
            && this.textures.get('painted-player-walk').source[0]?.width > 1;

        if (hasPaintedSheet) {
            this.anims.create({
                key: 'player-walk',
                frames: this.anims.generateFrameNumbers('painted-player-walk', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1,
            });
            const idleKey = this.textures.exists('painted-player-idle')
                && this.textures.get('painted-player-idle').source[0]?.width > 1
                ? 'painted-player-idle'
                : 'painted-player-walk';
            this.anims.create({
                key: 'player-idle',
                frames: idleKey === 'painted-player-walk'
                    ? [this.anims.generateFrameNumbers('painted-player-walk', { start: 0, end: 0 })[0]]
                    : [{ key: idleKey }],
                frameRate: 1,
                repeat: -1,
            });
        } else {
            // Procedural fallback: use the 4 frames baked by BootScene.
            this.anims.create({
                key: 'player-walk',
                frames: [
                    { key: 'player-frame-0' },
                    { key: 'player-frame-1' },
                    { key: 'player-frame-2' },
                    { key: 'player-frame-3' },
                ],
                frameRate: 8,
                repeat: -1,
            });
            this.anims.create({
                key: 'player-idle',
                frames: [{ key: 'player-frame-0' }],
                frameRate: 1,
                repeat: -1,
            });
        }

        this.scene.start('GameScene', { region: this.region });
    }
}

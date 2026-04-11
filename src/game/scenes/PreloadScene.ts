import { Scene } from 'phaser';

export class PreloadScene extends Scene {
    constructor() {
        super('PreloadScene');
    }

    init(): void {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        this.add.text(centerX, centerY - 60, 'Walking Through Country', {
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
        this.load.json('landmarks', 'landmarks.json');
        // Chapter data - drives the elder-led narrative flow. Failure to load
        // is not fatal: GameScene falls back to the old "all landmarks as
        // primaries" mode, which keeps exploration working without chapters.
        this.load.json('chapters', 'chapters.json');

        // Load hero photographs for each landmark from public/assets/landmarks/Victoria/.
        // Missing files silently fall back to the procedural icons baked in BootScene.
        const heroImages: Array<{ id: string; file: string }> = [
            { id: 'budj-bim', file: 'budj_bim.jpg' },
            { id: 'mount-eccles', file: 'mount_eccels.jpg' },
            { id: 'tyrendarra', file: 'tyrendarra.jpg' },
            { id: 'lake-condah', file: 'lake_condah_mission.jpg' },
            { id: 'kurtonitj', file: 'kurtonitj.jpg' },
            { id: 'brambuk', file: 'brambuk_nationalpark.jpeg' },
            { id: 'bunjil-shelter', file: 'bunjil_shelter.jpg' },
            { id: 'gulgurn-manja', file: 'gulgurn_manja.jpg' },
            { id: 'ngamadjidj', file: 'ngamadjidj.jpg' },
            { id: 'billimina', file: 'billimina_shelter.jpg' },
            { id: 'mudadgadjiin', file: 'mudadgadjiin_shelter.jpg' },
            { id: 'djab-wurrung', file: 'djab_wurrung.jpg' },
            { id: 'mount-william', file: 'mount_william.jpg' },
            { id: 'wurdi-youang', file: 'wurdi_youang.jpg' },
            { id: 'kow-swamp', file: 'kow_swamp.jpg' },
            { id: 'scarred-trees', file: 'scarred_trees.png' },
            { id: 'buchan-caves', file: 'buchan_caves.jpeg' },
            { id: 'gippsland-lakes', file: 'gippsland_lakes.jpg' },
            { id: 'tarra-bulga', file: 'tarra_bulga.jpg' },
            { id: 'point-nepean', file: 'point_nepean.jpg' },
        ];
        for (const { id, file } of heroImages) {
            this.load.image(`landmark-hero-${id}`, `landmarks/Victoria/${file}`);
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

        // Fauna: 3 species, 2 frames each
        for (const species of ['kangaroo', 'emu', 'cockatoo']) {
            for (let f = 0; f < 2; f++) {
                this.load.image(`painted-fauna-${species}-${f}`, `fauna/fauna_${species}_${f}.png`);
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

        this.scene.start('GameScene');
    }
}

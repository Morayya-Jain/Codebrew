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

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            // Expected: missing hero images. Warn but do not fail.
            if (file.key?.startsWith('landmark-hero-')) {
                return;
            }
            // eslint-disable-next-line no-console
            console.warn(`[PreloadScene] Failed to load: ${file.key} (${file.url})`);
        });
    }

    create(): void {
        // Create player animations from individual frame textures
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

        this.scene.start('GameScene');
    }
}

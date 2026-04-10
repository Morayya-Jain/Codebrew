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

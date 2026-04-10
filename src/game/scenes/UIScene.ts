import { Scene } from 'phaser';
import { StoryCard } from '../ui/StoryCard';
import type { LandmarkData } from '../types';

export class UIScene extends Scene {
    private storyCard!: StoryCard;
    private progressText!: Phaser.GameObjects.Text;
    private hintText!: Phaser.GameObjects.Text;
    private discoveredIds: Set<string> = new Set();
    private totalLandmarks = 6;

    constructor() {
        super('UIScene');
    }

    create(): void {
        this.storyCard = new StoryCard();
        const { width, height } = this.cameras.main;

        // Progress tracker (top right)
        this.progressText = this.add.text(width - 20, 20,
            '0 / 6 Stories Discovered', {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '16px',
                color: '#e8c170',
                align: 'right',
            }).setOrigin(1, 0).setAlpha(0.7).setScrollFactor(0);

        // Progress dots
        this.updateProgressDots();

        // HUD hint text (bottom center)
        this.hintText = this.add.text(width / 2, height - 28,
            'WASD / Arrow Keys to move  |  E near landmarks to read stories',
            {
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '14px',
                color: '#a0886a',
                align: 'center',
            }
        ).setOrigin(0.5).setAlpha(0.6).setScrollFactor(0);

        // Fade hint after 8 seconds
        this.time.delayedCall(8000, () => {
            this.tweens.add({
                targets: this.hintText,
                alpha: 0.3,
                duration: 1000,
                ease: 'Quad.easeOut',
            });
        });

        // Listen for story card open events from GameScene
        this.events.on('openStoryCard', (data: LandmarkData) => {
            this.discoveredIds = new Set([...this.discoveredIds, data.id]);
            this.updateProgress();
            this.storyCard.show(data, () => this.closeStoryCard());
        });

        // Fade in
        this.cameras.main.fadeIn(500, 10, 6, 3);
    }

    private closeStoryCard(): void {
        const gameScene = this.scene.get('GameScene');
        gameScene.scene.resume();
        gameScene.events.emit('resume');
    }

    private updateProgress(): void {
        const count = this.discoveredIds.size;
        this.progressText.setText(`${count} / ${this.totalLandmarks} Stories Discovered`);

        if (count === this.totalLandmarks) {
            this.progressText.setColor('#4aff4a');
            this.progressText.setText('All Stories Discovered!');
        }

        // Flash effect on update
        this.tweens.add({
            targets: this.progressText,
            alpha: 1,
            duration: 200,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => { this.progressText.setAlpha(0.7); },
        });

        this.updateProgressDots();
    }

    private updateProgressDots(): void {
        const { width } = this.cameras.main;
        const baseX = width - 20;
        const baseY = 45;

        // Clear previous dots (simple approach: redraw)
        const gfx = this.add.graphics().setScrollFactor(0);
        for (let i = 0; i < this.totalLandmarks; i++) {
            const x = baseX - (this.totalLandmarks - 1 - i) * 18;
            const discovered = i < this.discoveredIds.size;
            gfx.fillStyle(discovered ? 0xe8c170 : 0x3a2a1a, discovered ? 0.9 : 0.5);
            gfx.fillCircle(x, baseY, 5);
        }
    }
}

import { GameObjects, Scene } from 'phaser';
import type { ChapterData, SeasonPresetData } from '../types';

/**
 * Full-viewport chapter intro card: season header, chapter title, subtitle.
 *
 * Used at the start of a chapter (after welcome lines, before walking) and
 * again briefly when the chapter completes as a "Chapter complete" card.
 *
 * Implemented as a Phaser container fixed to the camera. Fades in, holds,
 * fades out; triggers a callback when the hold is over so the caller can
 * advance state.
 */
export class ChapterTitleCard {
    private readonly scene: Scene;
    private readonly container: GameObjects.Container;
    private readonly bg: GameObjects.Graphics;
    private readonly subtitleText: GameObjects.Text;
    private readonly titleText: GameObjects.Text;
    private readonly flourishTop: GameObjects.Graphics;
    private readonly flourishBottom: GameObjects.Graphics;

    constructor(scene: Scene) {
        this.scene = scene;
        const { width, height } = scene.scale;
        const cx = width / 2;
        const cy = height / 2;

        this.container = scene.add.container(cx, cy).setDepth(2500).setScrollFactor(0).setAlpha(0);

        this.bg = scene.add.graphics();
        this.drawBackground_(width, height);

        this.subtitleText = scene.add.text(0, -46, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '20px',
            color: '#a0886a',
            fontStyle: 'italic',
            align: 'center',
        }).setOrigin(0.5);

        this.titleText = scene.add.text(0, 10, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '54px',
            color: '#e8c170',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);
        this.titleText.setShadow(0, 4, '#000000', 12, false, true);

        this.flourishTop = scene.add.graphics();
        this.flourishBottom = scene.add.graphics();
        this.drawFlourishes_();

        this.container.add([
            this.bg,
            this.flourishTop,
            this.subtitleText,
            this.titleText,
            this.flourishBottom,
        ]);

        scene.scale.on('resize', () => this.handleResize_());
    }

    show(chapter: ChapterData, seasonPreset: SeasonPresetData | null, onDismissed?: () => void): void {
        this.titleText.setText(chapter.title);
        const seasonLine = seasonPreset?.displayName ? `${seasonPreset.displayName}  ·  ` : '';
        this.subtitleText.setText(`${seasonLine}${chapter.subtitle}`);

        this.scene.tweens.killTweensOf(this.container);
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            duration: 700,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.scene.time.delayedCall(3200, () => this.hide_(onDismissed));
            },
        });
    }

    showComplete(onDismissed?: () => void): void {
        this.titleText.setText('Chapter Complete');
        this.subtitleText.setText('Thank you for walking with me');
        this.scene.tweens.killTweensOf(this.container);
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            duration: 700,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.scene.time.delayedCall(3000, () => this.hide_(onDismissed));
            },
        });
    }

    destroy(): void {
        this.container.destroy();
    }

    private hide_(onDismissed?: () => void): void {
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 700,
            ease: 'Sine.easeIn',
            onComplete: () => onDismissed?.(),
        });
    }

    private drawBackground_(width: number, height: number): void {
        this.bg.clear();
        // Full-screen warm darkening so the card reads in any scene lighting.
        this.bg.fillStyle(0x0a0604, 0.82);
        this.bg.fillRect(-width / 2, -height / 2, width, height);
        // Soft vertical vignette
        this.bg.fillStyle(0x000000, 0.35);
        this.bg.fillRect(-width / 2, -height / 2, width, 80);
        this.bg.fillRect(-width / 2, height / 2 - 80, width, 80);
    }

    private drawFlourishes_(): void {
        // Simple serif dividers above/below the title.
        this.flourishTop.clear();
        this.flourishTop.lineStyle(1, 0xe8c170, 0.55);
        this.flourishTop.beginPath();
        this.flourishTop.moveTo(-170, -18);
        this.flourishTop.lineTo(170, -18);
        this.flourishTop.strokePath();
        this.flourishTop.fillStyle(0xe8c170, 0.7);
        this.flourishTop.fillCircle(0, -18, 2.5);

        this.flourishBottom.clear();
        this.flourishBottom.lineStyle(1, 0xe8c170, 0.55);
        this.flourishBottom.beginPath();
        this.flourishBottom.moveTo(-170, 68);
        this.flourishBottom.lineTo(170, 68);
        this.flourishBottom.strokePath();
        this.flourishBottom.fillStyle(0xe8c170, 0.7);
        this.flourishBottom.fillCircle(0, 68, 2.5);
    }

    private handleResize_(): void {
        const { width, height } = this.scene.scale;
        this.container.setPosition(width / 2, height / 2);
        this.drawBackground_(width, height);
    }
}

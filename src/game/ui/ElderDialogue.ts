import { GameObjects, Scene } from 'phaser';
import type { ElderLine } from '../types';
import { ChapterSystem, CHAPTER_EVENTS } from '../systems/ChapterSystem';

/**
 * A bottom-of-screen subtitle box driven by the ChapterSystem / ElderVoice
 * queue. Uses Phaser Graphics + Text (not DOM) so it sits inside the render
 * pipeline with all the other HUD elements and scales with the FIT scale mode.
 *
 * Visual intent: a soft parchment band at the lower-third of the viewport,
 * with a warm gold speaker label and slow typewriter-style reveal of the line.
 * The band fades out between lines.
 */
export class ElderDialogue {
    private readonly scene: Scene;
    private readonly container: GameObjects.Container;
    private readonly bg: GameObjects.Graphics;
    private readonly speakerText: GameObjects.Text;
    private readonly bodyText: GameObjects.Text;
    private readonly continueHint: GameObjects.Text;
    private currentLine_: ElderLine | null = null;
    private typewriterTimer_: Phaser.Time.TimerEvent | null = null;
    private fullText_ = '';
    private charIndex_ = 0;
    private hintTween_: Phaser.Tweens.Tween | null = null;

    private static readonly WIDTH = 880;
    private static readonly HEIGHT = 168;

    constructor(scene: Scene, system: ChapterSystem) {
        this.scene = scene;
        const { width, height } = scene.scale;
        const x = width / 2;
        const y = height - 150;

        this.container = scene.add.container(x, y).setDepth(2000).setScrollFactor(0);
        this.container.setAlpha(0);

        this.bg = scene.add.graphics();
        this.drawBackground_();

        this.speakerText = scene.add.text(-ElderDialogue.WIDTH / 2 + 32, -ElderDialogue.HEIGHT / 2 + 18, 'Elder', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#e8c170',
            fontStyle: 'italic',
        });
        this.speakerText.setShadow(0, 2, '#000000', 4, false, true);

        this.bodyText = scene.add.text(-ElderDialogue.WIDTH / 2 + 32, -ElderDialogue.HEIGHT / 2 + 46, '', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '22px',
            color: '#f4e5c8',
            wordWrap: { width: ElderDialogue.WIDTH - 64 },
            lineSpacing: 6,
        });
        this.bodyText.setShadow(0, 2, '#000000', 6, true, true);

        this.continueHint = scene.add.text(ElderDialogue.WIDTH / 2 - 32, ElderDialogue.HEIGHT / 2 - 22, 'Space to continue', {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '13px',
            color: '#a0886a',
            fontStyle: 'italic',
        }).setOrigin(1, 1).setAlpha(0);

        this.container.add([this.bg, this.speakerText, this.bodyText, this.continueHint]);

        system.on(CHAPTER_EVENTS.ELDER_LINE_START, (line: ElderLine) => this.showLine(line));
        system.on(CHAPTER_EVENTS.ELDER_LINE_END, () => this.clearLine());

        scene.scale.on('resize', () => this.handleResize_());
    }

    private drawBackground_(): void {
        const w = ElderDialogue.WIDTH;
        const h = ElderDialogue.HEIGHT;
        this.bg.clear();
        // Drop shadow
        this.bg.fillStyle(0x000000, 0.55);
        this.bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 18);
        // Parchment gradient body — stack two rects for a subtle light-to-dark.
        this.bg.fillStyle(0x2a1f16, 0.92);
        this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
        this.bg.fillStyle(0x14100c, 0.35);
        this.bg.fillRoundedRect(-w / 2, 0, w, h / 2, 18);
        // Warm inset border
        this.bg.lineStyle(1, 0xe8c170, 0.42);
        this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
        this.bg.lineStyle(1, 0xe8c170, 0.18);
        this.bg.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 14);
    }

    showLine(line: ElderLine): void {
        this.currentLine_ = line;
        this.fullText_ = line.text;
        this.charIndex_ = 0;
        this.bodyText.setText('');
        this.speakerText.setText(this.moodLabel_(line.mood));
        this.continueHint.setAlpha(0);
        if (this.hintTween_) {
            this.hintTween_.stop();
            this.hintTween_ = null;
        }

        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            duration: 260,
            ease: 'Sine.easeOut',
        });

        if (this.typewriterTimer_) {
            this.typewriterTimer_.remove(false);
            this.typewriterTimer_ = null;
        }
        this.typewriterTimer_ = this.scene.time.addEvent({
            delay: 24,
            loop: true,
            callback: () => this.tickTypewriter_(),
        });
    }

    clearLine(): void {
        this.currentLine_ = null;
        this.charIndex_ = this.fullText_.length;
        if (this.typewriterTimer_) {
            this.typewriterTimer_.remove(false);
            this.typewriterTimer_ = null;
        }
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 220,
            ease: 'Sine.easeIn',
            onComplete: () => {
                if (this.currentLine_ === null) {
                    this.bodyText.setText('');
                    this.continueHint.setAlpha(0);
                }
            },
        });
    }

    destroy(): void {
        if (this.typewriterTimer_) {
            this.typewriterTimer_.remove(false);
            this.typewriterTimer_ = null;
        }
        if (this.hintTween_) {
            this.hintTween_.stop();
            this.hintTween_ = null;
        }
        this.container.destroy();
    }

    private tickTypewriter_(): void {
        if (this.currentLine_ === null) return;
        this.charIndex_ = Math.min(this.charIndex_ + 1, this.fullText_.length);
        this.bodyText.setText(this.fullText_.slice(0, this.charIndex_));
        if (this.charIndex_ >= this.fullText_.length) {
            if (this.typewriterTimer_) {
                this.typewriterTimer_.remove(false);
                this.typewriterTimer_ = null;
            }
            this.revealContinueHint_();
        }
    }

    private revealContinueHint_(): void {
        this.continueHint.setAlpha(0);
        this.hintTween_ = this.scene.tweens.add({
            targets: this.continueHint,
            alpha: 0.85,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    private moodLabel_(mood: ElderLine['mood']): string {
        switch (mood) {
            case 'welcome': return 'Elder  ·  welcoming you';
            case 'teach': return 'Elder  ·  teaching';
            case 'reflect': return 'Elder  ·  reflecting';
            case 'farewell': return 'Elder  ·  farewell';
            default: return 'Elder';
        }
    }

    private handleResize_(): void {
        const { width, height } = this.scene.scale;
        this.container.setPosition(width / 2, height - 150);
    }
}

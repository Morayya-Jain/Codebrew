import { GameObjects, Scene } from 'phaser';
import type { ProximityState } from '../types';

export class FloatingLabel extends GameObjects.Container {
    private bg: GameObjects.Graphics;
    private nameText: GameObjects.Text;
    private descText: GameObjects.Text;
    private promptText: GameObjects.Text;
    private currentState: ProximityState = 'hidden';
    private activeTweens: Phaser.Tweens.Tween[] = [];

    constructor(
        scene: Scene,
        x: number,
        y: number,
        name: string,
        shortDescription: string,
        promptLabel: string = '[ E ] Read Story',
    ) {
        super(scene, x, y);

        this.bg = scene.add.graphics();
        this.add(this.bg);

        const textResolution = Math.max(2, window.devicePixelRatio || 1);

        this.nameText = scene.add.text(0, 0, name, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            color: '#f5e6d3',
            align: 'center',
            fontStyle: 'bold',
        }).setResolution(textResolution).setOrigin(0.5, 0.5);
        this.add(this.nameText);

        this.descText = scene.add.text(0, 24, shortDescription, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '14px',
            color: '#d4c5b2',
            align: 'center',
            wordWrap: { width: 220 },
        }).setResolution(textResolution).setOrigin(0.5, 0);
        this.descText.setAlpha(0);
        this.add(this.descText);

        this.promptText = scene.add.text(0, 0, promptLabel, {
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '13px',
            color: '#e8c170',
            align: 'center',
            fontStyle: 'bold',
        }).setResolution(textResolution).setOrigin(0.5, 0);
        this.promptText.setAlpha(0);
        this.add(this.promptText);

        this.setAlpha(0);
        this.setScale(0.8);
        this.setDepth(10);

        scene.add.existing(this);
    }

    setProximityState(newState: ProximityState): void {
        if (newState === this.currentState) return;

        this.killTweens();
        const prev = this.currentState;
        this.currentState = newState;

        switch (newState) {
            case 'hidden':
                this.transitionHidden();
                break;
            case 'far':
                this.transitionFar(prev === 'hidden');
                break;
            case 'mid':
                this.transitionMid();
                break;
            case 'near':
                this.transitionNear();
                break;
        }
    }

    setPromptLabel(label: string): void {
        this.promptText.setText(label);
    }

    getState(): ProximityState {
        return this.currentState;
    }

    private transitionHidden(): void {
        this.addTween({
            targets: this,
            alpha: 0,
            scale: 0.8,
            duration: 300,
            ease: 'Quad.easeOut',
        });
    }

    private transitionFar(fromHidden: boolean): void {
        this.descText.setAlpha(0);
        this.promptText.setAlpha(0);

        this.addTween({
            targets: this,
            alpha: 0.75,
            scale: 0.9,
            duration: fromHidden ? 500 : 300,
            ease: 'Back.easeOut',
        });

        this.drawBackground(140, 36);
    }

    private transitionMid(): void {
        this.descText.setAlpha(0);
        this.promptText.setAlpha(0);

        this.addTween({
            targets: this,
            alpha: 1,
            scale: 1,
            duration: 300,
            ease: 'Quad.easeOut',
        });

        this.drawBackground(160, 40);
    }

    private transitionNear(): void {
        const descH = this.descText.height;
        this.promptText.y = 24 + descH + 8;

        this.addTween({
            targets: this,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Back.easeOut',
        });

        this.addTween({
            targets: this.descText,
            alpha: 1,
            duration: 400,
            delay: 150,
            ease: 'Quad.easeOut',
        });

        this.addTween({
            targets: this.promptText,
            alpha: 1,
            duration: 400,
            delay: 300,
            ease: 'Quad.easeOut',
        });

        const totalH = 36 + descH + 30;
        this.drawBackground(250, totalH);
    }

    private drawBackground(width: number, height: number): void {
        this.bg.clear();
        this.bg.fillStyle(0x1a1210, 0.85);
        this.bg.fillRoundedRect(-width / 2, -20, width, height, 10);
        this.bg.lineStyle(1, 0xe8c170, 0.4);
        this.bg.strokeRoundedRect(-width / 2, -20, width, height, 10);
    }

    private addTween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
        const tween = this.scene.tweens.add(config);
        this.activeTweens = [...this.activeTweens, tween];
    }

    private killTweens(): void {
        this.activeTweens.forEach(t => t.destroy());
        this.activeTweens = [];
        this.setScale(1);
    }
}

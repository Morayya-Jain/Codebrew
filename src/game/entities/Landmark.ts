import { GameObjects, Scene, Math as PMath } from 'phaser';
import { FloatingLabel } from '../ui/FloatingLabel';
import type { LandmarkData, ProximityState } from '../types';
import { CONSTANTS } from '../types';

export class Landmark extends GameObjects.Container {
    readonly data_: LandmarkData;
    private icon: GameObjects.Sprite;
    private glowGraphics: GameObjects.Graphics;
    private label: FloatingLabel;
    private _isNear = false;
    private lastGlowState: ProximityState = 'hidden';

    constructor(scene: Scene, data: LandmarkData) {
        super(scene, data.position.x, data.position.y);
        this.data_ = data;

        // Glow effect behind icon
        this.glowGraphics = scene.add.graphics();
        this.glowGraphics.setPosition(data.position.x, data.position.y);
        this.glowGraphics.setAlpha(0);
        this.glowGraphics.setDepth(1);

        // Landmark icon sprite
        this.icon = scene.add.sprite(0, 0, `landmark-${data.id}`);
        this.icon.setDisplaySize(64, 64);
        this.add(this.icon);

        // Floating label positioned above the icon
        this.label = new FloatingLabel(
            scene,
            data.position.x,
            data.position.y - 60,
            data.name,
            data.shortDescription
        );

        // Gentle bob animation on the icon
        scene.tweens.add({
            targets: this.icon,
            y: -6,
            duration: 1500 + Math.random() * 500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });

        this.setDepth(3);
        scene.add.existing(this);
    }

    get isNear(): boolean {
        return this._isNear;
    }

    updateProximity(playerX: number, playerY: number): void {
        const dist = PMath.Distance.Between(
            playerX, playerY,
            this.data_.position.x, this.data_.position.y
        );

        let state: ProximityState;

        if (dist > CONSTANTS.FAR_THRESHOLD) {
            state = 'hidden';
        } else if (dist > CONSTANTS.MID_THRESHOLD) {
            state = 'far';
        } else if (dist > CONSTANTS.NEAR_THRESHOLD) {
            state = 'mid';
        } else {
            state = 'near';
        }

        this._isNear = state === 'near';
        this.label.setState(state);
        this.updateGlow(state, dist);
    }

    private updateGlow(state: ProximityState, _dist: number): void {
        if (state === this.lastGlowState) return;
        this.lastGlowState = state;

        const targetAlpha = state === 'near' ? 0.4 : state === 'mid' ? 0.2 : 0;

        this.scene.tweens.add({
            targets: this.glowGraphics,
            alpha: targetAlpha,
            duration: 300,
            ease: 'Quad.easeOut',
        });

        if (state === 'mid' || state === 'near') {
            this.glowGraphics.clear();
            const color = parseInt(this.data_.iconColor.replace('#', ''), 16);
            this.glowGraphics.fillStyle(color, 0.3);
            this.glowGraphics.fillCircle(0, 0, 50);
        }
    }

    destroy(fromScene?: boolean): void {
        this.glowGraphics.destroy();
        this.label.destroy();
        super.destroy(fromScene);
    }
}

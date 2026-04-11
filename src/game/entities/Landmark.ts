import { GameObjects, Scene, Math as PMath } from 'phaser';
import { FloatingLabel } from '../ui/FloatingLabel';
import type { LandmarkData, ProximityState, WaypointRole } from '../types';
import { CONSTANTS } from '../types';

export const LANDMARK_EVENTS = {
    NEAR_ENTER: 'landmark-near-enter',
    NEAR_LEAVE: 'landmark-near-leave',
} as const;

/**
 * The role a landmark plays in the current chapter (see ChapterSystem).
 *   - 'primary'  : the visitor can press E to open the StoryCard
 *   - 'waypoint' : proximity triggers elder dialogue but no StoryCard
 * Landmarks not referenced by the current chapter are not spawned at all.
 */
export type LandmarkChapterRole = WaypointRole;

export class Landmark extends GameObjects.Container {
    readonly data_: LandmarkData;
    readonly role: LandmarkChapterRole;
    private icon: GameObjects.Sprite;
    private heroBg_: GameObjects.Image | null = null;
    private heroFg_: GameObjects.Image | null = null;
    private glowGraphics: GameObjects.Graphics;
    private label: FloatingLabel;
    private _isNear = false;
    private lastGlowState: ProximityState = 'hidden';
    private usingHero_ = false;

    constructor(scene: Scene, data: LandmarkData, role: LandmarkChapterRole = 'primary') {
        super(scene, data.position.x, data.position.y);
        this.data_ = data;
        this.role = role;

        // Glow effect behind icon
        this.glowGraphics = scene.add.graphics();
        this.glowGraphics.setPosition(data.position.x, data.position.y);
        this.glowGraphics.setAlpha(0);
        this.glowGraphics.setDepth(1);

        // Prefer a user-provided painted hero scene (see public/assets/landmarks/)
        // Falls back to the procedural icon baked in BootScene.
        const heroKey = `landmark-hero-${data.id}`;
        const heroBgKey = `landmark-hero-${data.id}-bg`;
        const heroFgKey = `landmark-hero-${data.id}-fg`;

        if (scene.textures.exists(heroKey)) {
            this.usingHero_ = true;
            if (scene.textures.exists(heroBgKey)) {
                const bg = scene.add.image(0, 0, heroBgKey);
                bg.setDisplaySize(260, 260);
                bg.setOrigin(0.5, 0.9);
                this.add(bg);
                this.heroBg_ = bg;
            }
            this.icon = scene.add.sprite(0, 0, heroKey);
            this.icon.setDisplaySize(220, 220);
            this.icon.setOrigin(0.5, 0.9);
            this.add(this.icon);
            if (scene.textures.exists(heroFgKey)) {
                const fg = scene.add.image(0, 0, heroFgKey);
                fg.setDisplaySize(240, 240);
                fg.setOrigin(0.5, 0.9);
                this.add(fg);
                this.heroFg_ = fg;
            }
        } else {
            this.icon = scene.add.sprite(0, 0, `landmark-${data.id}`);
            this.icon.setDisplaySize(72, 72);
            this.add(this.icon);
        }

        // Floating label positioned above the icon
        this.label = new FloatingLabel(
            scene,
            data.position.x,
            data.position.y - 60,
            data.name,
            data.shortDescription
        );

        // Gentle bob animation — procedural icons bob, hero scenes hold still
        // (a painted scene bobbing looks weird).
        if (!this.usingHero_) {
            scene.tweens.add({
                targets: this.icon,
                y: -6,
                duration: 1500 + Math.random() * 500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
        }

        // Y-sorted depth (shared scheme with trees/player/fauna). +0.02 tiebreak
        // so landmarks sit above trees/player/fauna at the same Y, making the
        // icon always readable when the player is standing right on top of it.
        this.setDepth(2 + data.position.y * 0.001 + 0.02);
        scene.add.existing(this);
    }

    get isNear(): boolean {
        return this._isNear;
    }

    /** Waypoint landmarks trigger elder dialogue only — the full StoryCard is reserved for primary roles. */
    get canOpenStoryCard(): boolean {
        return this.role === 'primary';
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

        const wasNear = this._isNear;
        this._isNear = state === 'near';

        // Emit enter/leave for camera framing + audio ducking
        if (this._isNear && !wasNear) {
            this.scene.events.emit(LANDMARK_EVENTS.NEAR_ENTER, this);
        } else if (!this._isNear && wasNear) {
            this.scene.events.emit(LANDMARK_EVENTS.NEAR_LEAVE, this);
        }

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
        if (this.heroBg_) this.heroBg_.destroy();
        if (this.heroFg_) this.heroFg_.destroy();
        super.destroy(fromScene);
    }
}

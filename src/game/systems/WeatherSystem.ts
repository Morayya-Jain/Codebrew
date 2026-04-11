import { Scene } from 'phaser';
import type { WeatherKind } from '../types';

/**
 * Chapter-driven weather layer. Reuses the existing particle-emitter pattern
 * from GameScene (the same approach used for smoke, embers, dust, fireflies).
 *
 * Supports three kinds for Phase A:
 *   - `clear`: all weather effects off
 *   - `mist`: soft drifting near-white particles, dawn/cold atmospheric feel
 *   - `heat-shimmer`: high-altitude warm haze particles, drier heat feel
 *
 * The emitter is camera-relative (same trick as the dust emitter) so it
 * always produces particles in the visible viewport regardless of where
 * the player has walked.
 */
export class WeatherSystem {
    private readonly scene: Scene;
    private mistEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private shimmerEmitter_: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private kind_: WeatherKind = 'clear';

    constructor(scene: Scene) {
        this.scene = scene;
        this.createEmitters_();
    }

    get kind(): WeatherKind {
        return this.kind_;
    }

    setWeather(kind: WeatherKind): void {
        if (this.kind_ === kind) return;
        this.kind_ = kind;
        this.applyState_();
    }

    /**
     * Camera-follow both emitters so particles appear in the viewport no
     * matter where the player has walked. Call every frame from GameScene.
     */
    update(cameraCenterX: number, cameraCenterY: number): void {
        if (this.mistEmitter_) this.mistEmitter_.setPosition(cameraCenterX, cameraCenterY);
        if (this.shimmerEmitter_) this.shimmerEmitter_.setPosition(cameraCenterX, cameraCenterY);
    }

    destroy(): void {
        this.mistEmitter_?.destroy();
        this.shimmerEmitter_?.destroy();
        this.mistEmitter_ = null;
        this.shimmerEmitter_ = null;
    }

    private createEmitters_(): void {
        // Mist: soft white/blue drifting particles, low altitude, long life.
        // Alpha fades 0.18 -> 0 over the lifespan so the mist feels like it's
        // drifting through the frame rather than popping in hard.
        this.mistEmitter_ = this.scene.add.particles(0, 0, 'particle-soft', {
            frequency: 180,
            lifespan: 9000,
            speedX: { min: -4, max: 4 },
            speedY: { min: -2, max: 2 },
            scale: { start: 1.2, end: 4.0 },
            alpha: { start: 0.18, end: 0 },
            tint: [0xd0e0ec, 0xe0e8f0, 0xc8d8e8],
            quantity: 2,
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-720, -420, 1440, 840),
                quantity: 2,
            } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        });
        this.mistEmitter_.setDepth(6);
        this.mistEmitter_.stop();

        // Heat shimmer: warm ochre haze rising slowly upward.
        this.shimmerEmitter_ = this.scene.add.particles(0, 0, 'particle-soft', {
            frequency: 260,
            lifespan: 6000,
            speedX: { min: -6, max: 6 },
            speedY: { min: -14, max: -2 },
            scale: { start: 0.5, end: 1.8 },
            alpha: { start: 0.14, end: 0 },
            tint: [0xffd8a0, 0xffc080, 0xf0a860],
            quantity: 1,
            emitZone: {
                type: 'random',
                source: new Phaser.Geom.Rectangle(-720, -420, 1440, 840),
                quantity: 1,
            } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        });
        this.shimmerEmitter_.setDepth(6);
        this.shimmerEmitter_.stop();
    }

    private applyState_(): void {
        if (!this.mistEmitter_ || !this.shimmerEmitter_) return;
        this.mistEmitter_.stop();
        this.shimmerEmitter_.stop();
        switch (this.kind_) {
            case 'mist':
                this.mistEmitter_.start();
                break;
            case 'heat-shimmer':
                this.shimmerEmitter_.start();
                break;
            case 'clear':
            default:
                break;
        }
    }
}

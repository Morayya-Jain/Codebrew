import Phaser from 'phaser';

/**
 * Global wind state. A single LFO blended with occasional gusts.
 *
 * `value` is a unitless 0..1.5 strength that other systems multiply into
 * their own animation (canopy sway, grass lean, leaf particles, etc).
 *
 * Use `direction` (radians) for wind-aligned effects.
 *
 * Phase 3: provides sway value. Phase 6 adds particle leaf bursts on gust.
 */

export interface WindSample {
    readonly value: number;
    readonly direction: number;
    readonly isGusting: boolean;
}

export class WindSystem extends Phaser.Events.EventEmitter {
    private baseDir_ = Math.PI * 0.8; // gentle southwesterly
    private time_ = 0;
    private gustUntil_ = 0;
    private gustStrength_ = 0;
    private nextGust_ = 8000;

    /** Advance the wind by `deltaMs`. Call once per frame from GameScene. */
    tick(deltaMs: number): void {
        this.time_ += deltaMs;
        if (this.time_ >= this.nextGust_ && this.gustUntil_ < this.time_) {
            // Start a gust
            this.gustStrength_ = 0.35 + Math.random() * 0.55;
            this.gustUntil_ = this.time_ + 1600 + Math.random() * 1400;
            this.nextGust_ = this.time_ + 7000 + Math.random() * 9000;
            this.emit('gust', this.gustStrength_);
        }
    }

    /** Return the current wind sample. Cheap — call from any update hook. */
    sample(): WindSample {
        const t = this.time_ / 1000;
        const base = (Math.sin(t * 0.35) + Math.sin(t * 0.73 + 1.1)) * 0.18;
        const breeze = 0.35 + base;
        let value = breeze;
        const isGusting = this.time_ < this.gustUntil_;
        if (isGusting) {
            const u = 1 - (this.gustUntil_ - this.time_) / 1600;
            const envelope = Math.sin(Math.min(1, u) * Math.PI);
            value += envelope * this.gustStrength_;
        }
        // Direction wobbles slightly with time so gusts feel organic.
        const direction = this.baseDir_ + Math.sin(t * 0.22) * 0.12;
        return { value, direction, isGusting };
    }
}

export const windSystem = new WindSystem();

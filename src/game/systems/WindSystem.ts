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
    /**
     * Additive override from the current SeasonPreset. A season with
     * windIntensity 0.2 (cold dawn) adds -0.15 here, pulling `value` down;
     * a 0.6 season adds +0.25. Centred around the base `breeze` of 0.35 so
     * presets feel relative to the default. Does NOT touch `time_` or gust
     * scheduling, so LFO phase and gust rhythm stay continuous.
     */
    private presetOffset_ = 0;

    /**
     * Set the preset wind offset. `intensity` is the season's target wind
     * value in the 0..1 range, matching the SeasonPreset.windIntensity field
     * in chapters.json.
     */
    setIntensityOverride(intensity: number): void {
        // Centre on the nominal breeze of 0.35. A preset of 0.35 is neutral.
        this.presetOffset_ = intensity - 0.35;
    }

    clearIntensityOverride(): void {
        this.presetOffset_ = 0;
    }

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
        let value = breeze + this.presetOffset_;
        const isGusting = this.time_ < this.gustUntil_;
        if (isGusting) {
            const u = 1 - (this.gustUntil_ - this.time_) / 1600;
            const envelope = Math.sin(Math.min(1, u) * Math.PI);
            value += envelope * this.gustStrength_;
        }
        // Clamp to a sane range so a very low preset can't produce negatives
        // that flip grass rotation.
        value = Math.max(0.02, value);
        // Direction wobbles slightly with time so gusts feel organic.
        const direction = this.baseDir_ + Math.sin(t * 0.22) * 0.12;
        return { value, direction, isGusting };
    }
}

export const windSystem = new WindSystem();

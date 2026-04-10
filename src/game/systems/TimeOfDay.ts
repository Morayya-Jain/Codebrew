import Phaser from 'phaser';

export enum TimeOfDayState {
    Dawn = 'dawn',
    Morning = 'morning',
    GoldenHour = 'goldenHour',
    Dusk = 'dusk',
    Night = 'night',
}

export interface TimeOfDayPalette {
    /** Multiplicative tint applied to the final color. */
    ambientTint: [number, number, number];
    /** Additive warm lift applied to shadows. */
    warmLift: [number, number, number];
    /** Directional light color (for future Light2D use, hex). */
    directionalColor: number;
    /** Sun angle in degrees (0 = horizon east, 90 = overhead, negative = below horizon). */
    sunAngle: number;
    /** Starfield overlay alpha, 0 = off, 1 = full Milky Way. */
    starfieldAlpha: number;
    /** Per-palette bloom multiplier — more bloom at low-sun times. */
    bloomStrength: number;
    /** Background/letterbox color for the camera. */
    letterboxColor: number;
}

export const TIME_OF_DAY_PALETTES: Record<TimeOfDayState, TimeOfDayPalette> = {
    [TimeOfDayState.Dawn]: {
        ambientTint: [0.94, 0.95, 1.03],
        warmLift: [0.03, 0.02, 0.05],
        directionalColor: 0xe8a8b8,
        sunAngle: 12,
        starfieldAlpha: 0.25,
        bloomStrength: 1.2,
        letterboxColor: 0x150f14,
    },
    [TimeOfDayState.Morning]: {
        ambientTint: [1.02, 1.0, 0.97],
        warmLift: [0.03, 0.02, 0.0],
        directionalColor: 0xfff4d8,
        sunAngle: 55,
        starfieldAlpha: 0,
        bloomStrength: 1.0,
        letterboxColor: 0x1a150c,
    },
    [TimeOfDayState.GoldenHour]: {
        ambientTint: [1.08, 1.0, 0.88],
        warmLift: [0.07, 0.03, -0.01],
        directionalColor: 0xffb060,
        sunAngle: 18,
        starfieldAlpha: 0,
        bloomStrength: 1.4,
        letterboxColor: 0x1a0f08,
    },
    [TimeOfDayState.Dusk]: {
        ambientTint: [1.03, 0.93, 1.0],
        warmLift: [0.05, 0.0, 0.03],
        directionalColor: 0xd06a8a,
        sunAngle: 8,
        starfieldAlpha: 0.35,
        bloomStrength: 1.3,
        letterboxColor: 0x14080e,
    },
    [TimeOfDayState.Night]: {
        ambientTint: [0.62, 0.68, 0.9],
        warmLift: [0.0, 0.0, 0.04],
        directionalColor: 0x4a5a88,
        sunAngle: -30,
        starfieldAlpha: 1.0,
        bloomStrength: 1.8,
        letterboxColor: 0x050610,
    },
};

/**
 * Global time-of-day state. Subscribe via .on('change', (state, palette) => ...)
 * from any scene or system that needs to react to lighting/color shifts.
 *
 * Phase 1: static state, defaults to GoldenHour. Phase 6 adds animated cycling.
 */
class TimeOfDayManager extends Phaser.Events.EventEmitter {
    private current_: TimeOfDayState = TimeOfDayState.GoldenHour;

    get state(): TimeOfDayState {
        return this.current_;
    }

    get palette(): TimeOfDayPalette {
        return TIME_OF_DAY_PALETTES[this.current_];
    }

    setState(state: TimeOfDayState): void {
        if (state === this.current_) return;
        this.current_ = state;
        this.emit('change', state, this.palette);
    }
}

export const timeOfDay = new TimeOfDayManager();

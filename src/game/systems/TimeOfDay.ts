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
        ambientTint: [0.97, 0.97, 1.01],
        warmLift: [0.01, 0.01, 0.01],
        directionalColor: 0xe8a8b8,
        sunAngle: 12,
        starfieldAlpha: 0.25,
        bloomStrength: 0.7,
        letterboxColor: 0x150f14,
    },
    [TimeOfDayState.Morning]: {
        ambientTint: [1.02, 1.0, 0.97],
        warmLift: [0.01, 0.01, 0.0],
        directionalColor: 0xfff4d8,
        sunAngle: 55,
        starfieldAlpha: 0,
        bloomStrength: 0.6,
        letterboxColor: 0x1a150c,
    },
    [TimeOfDayState.GoldenHour]: {
        ambientTint: [1.02, 1.0, 0.96],
        warmLift: [0.02, 0.01, 0.0],
        directionalColor: 0xffb060,
        sunAngle: 18,
        starfieldAlpha: 0,
        bloomStrength: 0.6,
        letterboxColor: 0x1a0f08,
    },
    [TimeOfDayState.Dusk]: {
        ambientTint: [1.02, 0.97, 1.0],
        warmLift: [0.01, 0.0, 0.01],
        directionalColor: 0xd06a8a,
        sunAngle: 8,
        starfieldAlpha: 0.35,
        bloomStrength: 0.7,
        letterboxColor: 0x14080e,
    },
    [TimeOfDayState.Night]: {
        ambientTint: [0.78, 0.82, 0.94],
        warmLift: [0.0, 0.0, 0.01],
        directionalColor: 0x4a5a88,
        sunAngle: -30,
        starfieldAlpha: 1.0,
        bloomStrength: 1.0,
        letterboxColor: 0x050610,
    },
};

/**
 * Global time-of-day state.
 *
 * The cycle runs Golden → Dusk → Night → Dawn → Morning → Golden. Default
 * cycle length is 8 minutes of wall-clock time. Starts frozen on GoldenHour
 * until `start()` is called — keeping the opening scene at the designed
 * lighting for the first minute or two of play.
 *
 * Call `tick(deltaMs)` each frame. The `palette` getter always returns the
 * current interpolated palette (between two adjacent states).
 */

const CYCLE_ORDER: readonly TimeOfDayState[] = [
    TimeOfDayState.GoldenHour,
    TimeOfDayState.Dusk,
    TimeOfDayState.Night,
    TimeOfDayState.Dawn,
    TimeOfDayState.Morning,
];

const DEFAULT_CYCLE_MS = 8 * 60 * 1000; // 8 min full loop
const HOLD_BEFORE_CYCLE_MS = 90 * 1000; // hold golden hour for 90s on entry

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function lerpRgbHex(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(lerp(ar, br, t));
    const g = Math.round(lerp(ag, bg, t));
    const bl = Math.round(lerp(ab, bb, t));
    return (r << 16) | (g << 8) | bl;
}

/**
 * Map a season-preset string ("golden-hour", "goldenHour", "dawn", etc.) to
 * a TimeOfDayState enum value. Returns null if the string doesn't match any
 * known state.
 */
function parseTimeOfDayString(raw: string): TimeOfDayState | null {
    const normalised = raw.replace(/[-_\s]/g, '').toLowerCase();
    const map: Record<string, TimeOfDayState> = {
        dawn: TimeOfDayState.Dawn,
        morning: TimeOfDayState.Morning,
        goldenhour: TimeOfDayState.GoldenHour,
        golden: TimeOfDayState.GoldenHour,
        midday: TimeOfDayState.GoldenHour,
        dusk: TimeOfDayState.Dusk,
        twilight: TimeOfDayState.Dusk,
        night: TimeOfDayState.Night,
    };
    return map[normalised] ?? null;
}

function lerpPalette(a: TimeOfDayPalette, b: TimeOfDayPalette, t: number): TimeOfDayPalette {
    return {
        ambientTint: [
            lerp(a.ambientTint[0], b.ambientTint[0], t),
            lerp(a.ambientTint[1], b.ambientTint[1], t),
            lerp(a.ambientTint[2], b.ambientTint[2], t),
        ],
        warmLift: [
            lerp(a.warmLift[0], b.warmLift[0], t),
            lerp(a.warmLift[1], b.warmLift[1], t),
            lerp(a.warmLift[2], b.warmLift[2], t),
        ],
        directionalColor: lerpRgbHex(a.directionalColor, b.directionalColor, t),
        sunAngle: lerp(a.sunAngle, b.sunAngle, t),
        starfieldAlpha: lerp(a.starfieldAlpha, b.starfieldAlpha, t),
        bloomStrength: lerp(a.bloomStrength, b.bloomStrength, t),
        letterboxColor: lerpRgbHex(a.letterboxColor, b.letterboxColor, t),
    };
}

class TimeOfDayManager extends Phaser.Events.EventEmitter {
    private running_ = false;
    private cycleMs_ = DEFAULT_CYCLE_MS;
    private elapsedMs_ = 0;
    private holdRemainingMs_ = HOLD_BEFORE_CYCLE_MS;
    private cachedPalette_: TimeOfDayPalette = TIME_OF_DAY_PALETTES[TimeOfDayState.GoldenHour];
    private cachedState_: TimeOfDayState = TimeOfDayState.GoldenHour;

    get state(): TimeOfDayState {
        return this.cachedState_;
    }

    get palette(): TimeOfDayPalette {
        return this.cachedPalette_;
    }

    /** Start the cycle. Call once after the player's first input (Phase 2 audio gate is a good place). */
    start(): void {
        this.running_ = true;
    }

    /** Reset to a given state and stop cycling. */
    setState(state: TimeOfDayState): void {
        this.cachedState_ = state;
        this.cachedPalette_ = TIME_OF_DAY_PALETTES[state];
        this.running_ = false;
        this.emit('change', state, this.cachedPalette_);
    }

    /**
     * Accept a season preset string (kebab-case or camelCase) and apply the
     * matching state. Used by SeasonPreset.applySeasonPreset(). Unknown strings
     * are ignored so a malformed chapters.json doesn't crash the scene.
     */
    setPreset(timeOfDay: string): void {
        const state = parseTimeOfDayString(timeOfDay);
        if (state === null) {
            // eslint-disable-next-line no-console
            console.warn(`[TimeOfDay] unknown preset state: ${timeOfDay}`);
            return;
        }
        this.setState(state);
    }

    /** Called every frame from GameScene. Advances the cycle + interpolates the palette. */
    tick(deltaMs: number): void {
        if (!this.running_) return;
        if (this.holdRemainingMs_ > 0) {
            this.holdRemainingMs_ -= deltaMs;
            return;
        }
        this.elapsedMs_ = (this.elapsedMs_ + deltaMs) % this.cycleMs_;
        const segments = CYCLE_ORDER.length;
        const segmentMs = this.cycleMs_ / segments;
        const segIndex = Math.floor(this.elapsedMs_ / segmentMs);
        const segT = (this.elapsedMs_ - segIndex * segmentMs) / segmentMs;
        const currentState = CYCLE_ORDER[segIndex];
        const nextState = CYCLE_ORDER[(segIndex + 1) % segments];
        this.cachedState_ = currentState;
        this.cachedPalette_ = lerpPalette(
            TIME_OF_DAY_PALETTES[currentState],
            TIME_OF_DAY_PALETTES[nextState],
            segT,
        );
        // Emit change events only on state transitions, not every frame.
        // Interpolation clients poll `palette` each frame directly.
        this.emit('tick', this.cachedPalette_);
    }
}

export const timeOfDay = new TimeOfDayManager();

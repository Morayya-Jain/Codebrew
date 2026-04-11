import { Scene } from 'phaser';

/**
 * Ambient audio driven entirely by the Web Audio API — no asset files.
 *
 * Layered design:
 *  - Global "bed": wind (brown noise + LFO), cicada (band-passed saw with AM),
 *    occasional bird chirps (scheduled envelopes on oscillators).
 *  - Biome layers: campfire crackle, river water — volume attenuates by player
 *    distance to the nearest site of that type.
 *  - Footsteps: triggered by Player 'step' events, short filtered noise burst.
 *
 * Gracefully degrades:
 *  - No AudioContext? All methods no-op.
 *  - Browser blocks autoplay? Nothing plays until `start()` is called after
 *    the first user input.
 *  - Muted? Master gain is zero, oscillators still run (cheap), localStorage
 *    remembers preference.
 */

interface PointSource {
    readonly x: number;
    readonly y: number;
    readonly kind: 'fire' | 'water';
}

interface LayerHandle {
    readonly gain: GainNode;
    readonly targetBase: number;
    readonly sources: readonly AudioScheduledSourceNode[];
    /**
     * Optional post-gain that sits between the layer's main gain and the
     * master. Only used for the wind and cicada beds, so SeasonPreset can
     * multiply them cleanly without touching the base LFO/AM path.
     */
    readonly presetGain?: GainNode;
}

/**
 * Season-specific ambient bed multipliers, applied to each layer's
 * `presetGain` node. Keys are the bed IDs from chapters.json -> SeasonPreset.
 */
const AMBIENT_BED_PRESETS: Record<string, { wind: number; cicada: number }> = {
    'default':          { wind: 1.0, cicada: 1.0 },
    'dusk-cicadas':     { wind: 1.0, cicada: 1.0 },
    'dawn-birdsong':    { wind: 0.8, cicada: 0.2 },
    'morning-quiet':    { wind: 0.9, cicada: 0.4 },
    'evening-crickets': { wind: 0.7, cicada: 0.6 },
    'midday-cicadas':   { wind: 1.0, cicada: 1.8 },
    'night-fire':       { wind: 0.4, cicada: 0.1 },
};

const WIND_BED_GAIN = 0.22;
const CICADA_BED_GAIN = 0.02;
const FIRE_MAX_GAIN = 0.28;
const WATER_MAX_GAIN = 0.24;
const MASTER_FADE_SEC = 1.8;

const FIRE_RANGE = 650;
const WATER_RANGE = 900;

const MUTE_STORAGE_KEY = 'indigenous-australia:muted';

export class AmbientAudio {
    private ctx_: AudioContext | null = null;
    private master_: GainNode | null = null;
    private started_ = false;
    private muted_ = false;

    private windLayer_: LayerHandle | null = null;
    private cicadaLayer_: LayerHandle | null = null;
    private fireLayer_: LayerHandle | null = null;
    private waterLayer_: LayerHandle | null = null;

    private birdTimer_: number | null = null;
    private stepCooldown_ = 0;

    private points_: PointSource[] = [];

    /**
     * Remembered between `setPreset()` and `start()` so a preset applied
     * before the layers have built still lands once they do.
     */
    private pendingBedPreset_: { wind: number; cicada: number } | null = null;

    constructor(scene: Scene) {
        const manager = scene.sound as Phaser.Sound.WebAudioSoundManager;
        const ctx = manager?.context;
        if (!(ctx instanceof (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext))) {
            return;
        }
        this.ctx_ = ctx;
        this.master_ = ctx.createGain();
        this.master_.gain.value = 0;
        this.master_.connect(ctx.destination);
        this.muted_ = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    }

    /** Idempotent — safe to call from every keydown listener. */
    start(): void {
        if (!this.ctx_ || !this.master_ || this.started_) return;
        if (this.ctx_.state === 'suspended') {
            void this.ctx_.resume();
        }
        this.started_ = true;

        this.windLayer_ = this.buildWind_();
        this.cicadaLayer_ = this.buildCicada_();
        this.fireLayer_ = this.buildFireCrackle_();
        this.waterLayer_ = this.buildWaterBed_();

        this.scheduleNextBird_(2000 + Math.random() * 3000);

        // If a season preset was set before start(), apply it now that the
        // layers are built.
        if (this.pendingBedPreset_) {
            this.applyBedPreset_(this.pendingBedPreset_);
        }

        this.fadeMasterTo_(this.muted_ ? 0 : 0.7, MASTER_FADE_SEC);
    }

    destroy(): void {
        if (this.birdTimer_ !== null) {
            window.clearTimeout(this.birdTimer_);
            this.birdTimer_ = null;
        }
        for (const layer of [this.windLayer_, this.cicadaLayer_, this.fireLayer_, this.waterLayer_]) {
            if (!layer) continue;
            for (const src of layer.sources) {
                try { src.stop(); } catch { /* ignore */ }
            }
        }
        this.windLayer_ = null;
        this.cicadaLayer_ = null;
        this.fireLayer_ = null;
        this.waterLayer_ = null;
        if (this.master_) {
            try { this.master_.disconnect(); } catch { /* ignore */ }
        }
    }

    isMuted(): boolean {
        return this.muted_;
    }

    toggleMute(): void {
        this.setMuted(!this.muted_);
    }

    setMuted(muted: boolean): void {
        this.muted_ = muted;
        try {
            if (muted) localStorage.setItem(MUTE_STORAGE_KEY, '1');
            else localStorage.removeItem(MUTE_STORAGE_KEY);
        } catch { /* private mode */ }
        if (this.started_) {
            this.fadeMasterTo_(muted ? 0 : 0.7, 0.35);
        }
    }

    addPointSource(x: number, y: number, kind: 'fire' | 'water'): void {
        this.points_.push({ x, y, kind });
    }

    /**
     * Apply a season's ambient bed. Looks up multipliers for the named bed
     * and smoothly ramps the wind + cicada post-gains. Safe to call before
     * `start()` — the multipliers are remembered and applied when the layers
     * actually build.
     */
    setPreset(bedId: string): void {
        const preset = AMBIENT_BED_PRESETS[bedId] ?? AMBIENT_BED_PRESETS['default'];
        this.pendingBedPreset_ = preset;
        if (this.started_ && this.ctx_) {
            this.applyBedPreset_(preset);
        }
    }

    clearPreset(): void {
        const neutral = AMBIENT_BED_PRESETS['default'];
        this.pendingBedPreset_ = neutral;
        if (this.started_ && this.ctx_) {
            this.applyBedPreset_(neutral);
        }
    }

    private applyBedPreset_(preset: { wind: number; cicada: number }): void {
        if (!this.ctx_) return;
        const now = this.ctx_.currentTime;
        const windPost = this.windLayer_?.presetGain;
        const cicadaPost = this.cicadaLayer_?.presetGain;
        if (windPost) {
            windPost.gain.setTargetAtTime(preset.wind, now, 0.4);
        }
        if (cicadaPost) {
            cicadaPost.gain.setTargetAtTime(preset.cicada, now, 0.4);
        }
    }

    /**
     * Update positional layer gains based on player position. Call every frame
     * from GameScene.update — cheap, just a few distance checks and gain writes.
     */
    update(playerX: number, playerY: number, deltaMs: number): void {
        this.stepCooldown_ = Math.max(0, this.stepCooldown_ - deltaMs);
        if (!this.started_ || !this.ctx_) return;

        let nearestFire = Infinity;
        let nearestWater = Infinity;
        for (const p of this.points_) {
            const dx = p.x - playerX;
            const dy = p.y - playerY;
            const d = Math.hypot(dx, dy);
            if (p.kind === 'fire' && d < nearestFire) nearestFire = d;
            if (p.kind === 'water' && d < nearestWater) nearestWater = d;
        }

        const fireGain = attenuate(nearestFire, FIRE_RANGE) * FIRE_MAX_GAIN;
        const waterGain = attenuate(nearestWater, WATER_RANGE) * WATER_MAX_GAIN;

        const now = this.ctx_.currentTime;
        if (this.fireLayer_) {
            this.fireLayer_.gain.gain.setTargetAtTime(fireGain, now, 0.25);
        }
        if (this.waterLayer_) {
            this.waterLayer_.gain.gain.setTargetAtTime(waterGain, now, 0.3);
        }
    }

    /** Trigger a footstep burst — rate-limited so a held key doesn't machine-gun. */
    step(surface: 'dirt' | 'grass' = 'dirt'): void {
        if (!this.started_ || !this.ctx_ || !this.master_) return;
        if (this.stepCooldown_ > 0) return;
        this.stepCooldown_ = 260 + Math.random() * 70;

        const now = this.ctx_.currentTime;
        const noise = this.ctx_.createBufferSource();
        noise.buffer = this.makeBrownNoise_(0.2);
        const filter = this.ctx_.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = surface === 'grass' ? 1400 : 700;
        filter.Q.value = 1.2;
        const gain = this.ctx_.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.master_);
        noise.start(now);
        noise.stop(now + 0.2);
    }

    // ------------------------------------------------------------------
    // Layer builders
    // ------------------------------------------------------------------

    private buildWind_(): LayerHandle | null {
        if (!this.ctx_ || !this.master_) return null;
        const ctx = this.ctx_;

        const src = ctx.createBufferSource();
        src.buffer = this.makeBrownNoise_(4.0);
        src.loop = true;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 650;
        lp.Q.value = 0.7;

        const gain = ctx.createGain();
        gain.gain.value = WIND_BED_GAIN;

        // Slow gentle LFO modulates wind gain so it "breathes"
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.11;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = WIND_BED_GAIN * 0.55;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        const presetGain = ctx.createGain();
        presetGain.gain.value = 1.0;

        src.connect(lp);
        lp.connect(gain);
        gain.connect(presetGain);
        presetGain.connect(this.master_);
        src.start();
        lfo.start();

        return { gain, presetGain, targetBase: WIND_BED_GAIN, sources: [src, lfo] };
    }

    private buildCicada_(): LayerHandle | null {
        if (!this.ctx_ || !this.master_) return null;
        const ctx = this.ctx_;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 4200;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 5200;
        bp.Q.value = 22;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        // Cicada amplitude pulse at ~30 Hz
        const amOsc = ctx.createOscillator();
        amOsc.type = 'sine';
        amOsc.frequency.value = 32;
        const amGain = ctx.createGain();
        amGain.gain.value = CICADA_BED_GAIN;
        amOsc.connect(amGain);
        amGain.connect(gain.gain);

        const presetGain = ctx.createGain();
        presetGain.gain.value = 1.0;

        osc.connect(bp);
        bp.connect(gain);
        gain.connect(presetGain);
        presetGain.connect(this.master_);
        osc.start();
        amOsc.start();

        return { gain, presetGain, targetBase: CICADA_BED_GAIN, sources: [osc, amOsc] };
    }

    private buildFireCrackle_(): LayerHandle | null {
        if (!this.ctx_ || !this.master_) return null;
        const ctx = this.ctx_;

        const src = ctx.createBufferSource();
        src.buffer = this.makeCrackleBuffer_(6.0);
        src.loop = true;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 400;
        hp.Q.value = 0.5;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        src.connect(hp);
        hp.connect(gain);
        gain.connect(this.master_);
        src.start();

        return { gain, targetBase: FIRE_MAX_GAIN, sources: [src] };
    }

    private buildWaterBed_(): LayerHandle | null {
        if (!this.ctx_ || !this.master_) return null;
        const ctx = this.ctx_;

        const src = ctx.createBufferSource();
        src.buffer = this.makePinkNoise_(4.0);
        src.loop = true;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1400;
        bp.Q.value = 0.8;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        // Slow LFO gives the water a soft flow-rate wobble
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.18;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.master_);
        src.start();
        lfo.start();

        return { gain, targetBase: WATER_MAX_GAIN, sources: [src, lfo] };
    }

    // ------------------------------------------------------------------
    // Birds — procedural chirps on a random timer
    // ------------------------------------------------------------------

    private scheduleNextBird_(delayMs: number): void {
        this.birdTimer_ = window.setTimeout(() => {
            if (this.started_ && !this.muted_) {
                this.playBirdChirp_();
            }
            this.scheduleNextBird_(2500 + Math.random() * 6500);
        }, delayMs);
    }

    private playBirdChirp_(): void {
        if (!this.ctx_ || !this.master_) return;
        const ctx = this.ctx_;
        const now = ctx.currentTime;

        const kind = Math.random();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (kind < 0.35) {
            // Magpie carol — warbling glissando
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(820, now);
            osc.frequency.exponentialRampToValueAtTime(1280, now + 0.11);
            osc.frequency.exponentialRampToValueAtTime(940, now + 0.23);
            osc.frequency.exponentialRampToValueAtTime(1180, now + 0.36);
            osc.frequency.exponentialRampToValueAtTime(720, now + 0.5);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (kind < 0.65) {
            // Short chirp — sharp downward
            osc.type = 'square';
            osc.frequency.setValueAtTime(2400, now);
            osc.frequency.exponentialRampToValueAtTime(1500, now + 0.07);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.15);
        } else {
            // Kookaburra-ish rolling chortle
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(640, now);
            osc.frequency.linearRampToValueAtTime(1100, now + 0.08);
            osc.frequency.linearRampToValueAtTime(720, now + 0.2);
            osc.frequency.linearRampToValueAtTime(1050, now + 0.32);
            osc.frequency.linearRampToValueAtTime(560, now + 0.48);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            osc.start(now);
            osc.stop(now + 0.6);
        }

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500;
        bp.Q.value = 2.0;

        osc.connect(bp);
        bp.connect(gain);
        gain.connect(this.master_);
    }

    // ------------------------------------------------------------------
    // Noise buffer helpers
    // ------------------------------------------------------------------

    private makeBrownNoise_(seconds: number): AudioBuffer {
        const ctx = this.ctx_!;
        const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 3.2;
        }
        return buf;
    }

    private makePinkNoise_(seconds: number): AudioBuffer {
        const ctx = this.ctx_!;
        const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        // Voss-McCartney pink noise approximation
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;
            data[i] = pink * 0.11;
        }
        return buf;
    }

    private makeCrackleBuffer_(seconds: number): AudioBuffer {
        const ctx = this.ctx_!;
        const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        // Sparse crackle events plus a quiet brown-noise bed
        let last = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            last = (last + 0.015 * w) / 1.015;
            data[i] = last * 1.2;
        }
        const eventCount = Math.floor(seconds * 14);
        for (let e = 0; e < eventCount; e++) {
            const start = Math.floor(Math.random() * (len - 500));
            const intensity = 0.4 + Math.random() * 0.8;
            const length = 60 + Math.floor(Math.random() * 220);
            for (let k = 0; k < length; k++) {
                const env = (1 - k / length) * intensity;
                data[start + k] += (Math.random() * 2 - 1) * env;
            }
        }
        // Clamp
        for (let i = 0; i < len; i++) {
            if (data[i] > 1) data[i] = 1;
            else if (data[i] < -1) data[i] = -1;
        }
        return buf;
    }

    private fadeMasterTo_(target: number, seconds: number): void {
        if (!this.ctx_ || !this.master_) return;
        const now = this.ctx_.currentTime;
        this.master_.gain.cancelScheduledValues(now);
        this.master_.gain.setValueAtTime(this.master_.gain.value, now);
        this.master_.gain.linearRampToValueAtTime(target, now + seconds);
    }
}

function attenuate(distance: number, maxRange: number): number {
    if (!isFinite(distance)) return 0;
    const t = Math.max(0, 1 - distance / maxRange);
    return t * t;
}

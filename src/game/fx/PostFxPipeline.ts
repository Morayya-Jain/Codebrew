import Phaser from 'phaser';
import type { TimeOfDayPalette } from '../systems/TimeOfDay';

/**
 * Golden-hour post-processing pipeline.
 *
 * Single-pass fragment shader that does:
 *   - cheap 5x5 tap bloom on bright pixels (landmark glows, campfire, water sparkle)
 *   - warm shadow lift + saturation + ambient tint (time-of-day driven)
 *   - animated film grain
 *   - soft vignette
 *
 * Wired through `onDraw` (the canonical PostFXPipeline hook) after reading Phaser's
 * PostFXPipeline.js — postBatch() boots the pipeline then calls onDraw(renderTarget),
 * and uniform setters auto-bind the program so they're safe to call here.
 *
 * `resizeUniform = 'uResolution'` asks Phaser to auto-refresh the resolution uniform
 * whenever the renderer resizes.
 */

const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uAmbientTint;
uniform vec3 uWarmLift;
uniform float uBloomStrength;
uniform float uBloomThreshold;
uniform float uGrainStrength;
uniform float uVignetteStrength;
uniform float uSaturation;

varying vec2 outTexCoord;

float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

// Hash-based pseudo-random noise for film grain.
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    vec2 uv = outTexCoord;
    vec3 col = texture2D(uMainSampler, uv).rgb;

    // ---- Cheap bloom: 5x5 taps at 5-texel spacing, smooth-thresholded brightness ----
    // Computed dark-scene luminances before tuning:
    //   ground 0.19, river 0.25, campfire icon 0.52, tan dot-art 0.77.
    // Threshold 0.42 + smoothstep window keeps ground/river out, lets landmark
    // accents and glows contribute to the bloom.
    vec2 texel = 1.0 / uResolution;
    vec3 bloom = vec3(0.0);
    for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
            vec2 off = vec2(float(i), float(j)) * texel * 5.0;
            vec3 s = texture2D(uMainSampler, uv + off).rgb;
            float l = luma(s);
            float bright = smoothstep(uBloomThreshold, uBloomThreshold + 0.15, l);
            bloom += s * bright;
        }
    }
    bloom *= (1.0 / 25.0);
    col += bloom * uBloomStrength;

    // ---- Warm lift in shadows (additive, weighted by darkness) ----
    float shadowMask = 1.0 - smoothstep(0.0, 0.45, luma(col));
    col += uWarmLift * shadowMask;

    // ---- Saturation ----
    float l = luma(col);
    col = mix(vec3(l), col, uSaturation);

    // ---- Ambient tint (multiplicative, time-of-day driven) ----
    col *= uAmbientTint;

    // ---- Animated film grain ----
    float g = hash12(uv * uResolution + vec2(uTime * 37.0, uTime * 91.0)) - 0.5;
    col += g * uGrainStrength;

    // ---- Soft vignette ----
    vec2 v = uv - 0.5;
    float dist = dot(v, v);
    float vig = smoothstep(0.2, 0.55, dist);
    col *= 1.0 - vig * uVignetteStrength;

    gl_FragColor = vec4(col, 1.0);
}
`;

export class PostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    private ambientTint_: [number, number, number] = [1.12, 1.0, 0.82];
    private warmLift_: [number, number, number] = [0.12, 0.05, -0.02];
    private bloomStrength_ = 2.5;
    private bloomThreshold_ = 0.42;
    private grainStrength_ = 0.045;
    private vignetteStrength_ = 0.4;
    private saturation_ = 1.12;

    constructor(game: Phaser.Game) {
        super({
            game,
            name: 'PostFxPipeline',
            fragShader,
        });
        // Tell Phaser to auto-update `uResolution` on renderer resize.
        this.resizeUniform = 'uResolution';
    }

    applyPalette(palette: TimeOfDayPalette): void {
        this.ambientTint_ = [palette.ambientTint[0], palette.ambientTint[1], palette.ambientTint[2]];
        this.warmLift_ = [palette.warmLift[0], palette.warmLift[1], palette.warmLift[2]];
        this.bloomStrength_ = palette.bloomStrength;
    }

    onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
        const t = this.game.loop.time / 1000;
        this.set1f('uTime', t);
        this.set3f('uAmbientTint', this.ambientTint_[0], this.ambientTint_[1], this.ambientTint_[2]);
        this.set3f('uWarmLift', this.warmLift_[0], this.warmLift_[1], this.warmLift_[2]);
        this.set1f('uBloomStrength', this.bloomStrength_);
        this.set1f('uBloomThreshold', this.bloomThreshold_);
        this.set1f('uGrainStrength', this.grainStrength_);
        this.set1f('uVignetteStrength', this.vignetteStrength_);
        this.set1f('uSaturation', this.saturation_);
        this.bindAndDraw(renderTarget);
    }
}

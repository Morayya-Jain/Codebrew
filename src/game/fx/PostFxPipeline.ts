import Phaser from 'phaser';
import type { TimeOfDayPalette } from '../systems/TimeOfDay';

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

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {
    vec2 uv = outTexCoord;
    vec3 col = texture2D(uMainSampler, uv).rgb;

    // Cheap bloom: 5x5 taps, threshold on bright pixels
    vec2 texel = 1.0 / uResolution;
    vec3 bloom = vec3(0.0);
    for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
            vec2 off = vec2(float(i), float(j)) * texel * 3.0;
            vec3 s = texture2D(uMainSampler, uv + off).rgb;
            float l = luma(s);
            float w = max(l - uBloomThreshold, 0.0);
            bloom += s * w;
        }
    }
    bloom /= 25.0;
    col += bloom * uBloomStrength;

    // Warm lift in shadows (boost shadows toward warm tones)
    float shadowMask = 1.0 - smoothstep(0.0, 0.45, luma(col));
    col += uWarmLift * shadowMask;

    // Saturation control
    float l = luma(col);
    col = mix(vec3(l), col, uSaturation);

    // Ambient tint (multiplicative, time-of-day driven)
    col *= uAmbientTint;

    // Film grain (animated)
    float g = hash12(uv * uResolution + vec2(uTime * 37.0, uTime * 91.0)) - 0.5;
    col += g * uGrainStrength;

    // Vignette (soft corner darken)
    vec2 v = uv - 0.5;
    float dist = dot(v, v);
    float vig = smoothstep(0.2, 0.55, dist);
    col *= 1.0 - vig * uVignetteStrength;

    gl_FragColor = vec4(col, 1.0);
}
`;

export class PostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    private time_ = 0;
    private ambientTint_: [number, number, number] = [1.08, 1.0, 0.86];
    private warmLift_: [number, number, number] = [0.1, 0.04, -0.02];
    private bloomStrength_ = 0.55;
    private bloomThreshold_ = 0.68;
    private grainStrength_ = 0.04;
    private vignetteStrength_ = 0.35;
    private saturation_ = 1.05;

    constructor(game: Phaser.Game) {
        super({
            game,
            name: 'PostFxPipeline',
            fragShader,
        });
    }

    applyPalette(palette: TimeOfDayPalette): void {
        this.ambientTint_ = [...palette.ambientTint];
        this.warmLift_ = [...palette.warmLift];
        this.bloomStrength_ = palette.bloomStrength;
    }

    onPreRender(): void {
        this.time_ += 1 / 60;
        this.set1f('uTime', this.time_);
        this.set2f('uResolution', this.renderer.width, this.renderer.height);
        this.set3f('uAmbientTint', this.ambientTint_[0], this.ambientTint_[1], this.ambientTint_[2]);
        this.set3f('uWarmLift', this.warmLift_[0], this.warmLift_[1], this.warmLift_[2]);
        this.set1f('uBloomStrength', this.bloomStrength_);
        this.set1f('uBloomThreshold', this.bloomThreshold_);
        this.set1f('uGrainStrength', this.grainStrength_);
        this.set1f('uVignetteStrength', this.vignetteStrength_);
        this.set1f('uSaturation', this.saturation_);
    }
}

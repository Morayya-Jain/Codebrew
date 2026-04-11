import type { SeasonPresetData } from '../types';
import { timeOfDay } from './TimeOfDay';
import { windSystem } from './WindSystem';
import type { AmbientAudio } from './AmbientAudio';

/**
 * Apply a SeasonPresetData to the global TimeOfDay + WindSystem singletons
 * and the scene-owned AmbientAudio instance.
 *
 * Called from GameScene once a chapter has been selected, BEFORE the
 * welcome lines play, so the world already looks like the chosen season
 * when the title card fades in.
 *
 * This is an additive layer on top of the existing systems:
 *   - timeOfDay.setState() freezes the palette on the preset's time-of-day
 *   - windSystem.setIntensityOverride() adds an offset to the LFO
 *   - audio.setPreset() ramps the wind+cicada bed gains
 *
 * None of these calls touch internal timing state (LFO phase, gust
 * scheduling, noise buffers), so switching presets mid-session is safe.
 */
export function applySeasonPreset(
    preset: SeasonPresetData,
    audio: AmbientAudio | null,
): void {
    if (preset.timeOfDay) {
        timeOfDay.setPreset(preset.timeOfDay);
    }
    if (typeof preset.windIntensity === 'number') {
        windSystem.setIntensityOverride(preset.windIntensity);
    }
    if (preset.ambientBed) {
        audio?.setPreset(preset.ambientBed);
    }
}

/**
 * Revert any active preset overrides. Used when returning to attract mode
 * so the next visitor sees a neutral world.
 */
export function clearSeasonPreset(audio: AmbientAudio | null): void {
    windSystem.clearIntensityOverride();
    audio?.clearPreset();
    // Note: timeOfDay.setState() is a one-way freeze. Callers who want the
    // cycle to resume must call timeOfDay.start() separately.
}

/**
 * Accessibility + comfort settings modal. DOM-based.
 *
 * Settings are stored in sessionStorage (NOT localStorage) so each museum
 * visitor gets a fresh default experience, but the current session retains
 * their preferences across chapter changes.
 *
 * Current settings:
 *   - reducedMotion: disables weather particles, camera shake, bloom pulse
 *   - textSize: 'small' | 'medium' | 'large' - CSS class on body
 *   - volume: 0..100 - wired to AmbientAudio gain via callback
 *
 * The menu is opened with Escape (from UIScene) during gameplay but is
 * blocked from opening during elder monologues (handled by the caller).
 */

export type TextSize = 'small' | 'medium' | 'large';

export interface SettingsState {
    reducedMotion: boolean;
    textSize: TextSize;
    volume: number; // 0..100
}

const DEFAULT_SETTINGS: SettingsState = {
    reducedMotion: false,
    textSize: 'medium',
    volume: 70,
};

const STORAGE_KEY = 'indigenous-australia:settings';

export class SettingsMenu {
    private readonly overlay: HTMLElement;
    private readonly closeBtn: HTMLButtonElement;
    private readonly reducedMotionEl: HTMLInputElement;
    private readonly textSizeEl: HTMLSelectElement;
    private readonly volumeEl: HTMLInputElement;
    private state_: SettingsState;
    private readonly listeners_: Array<(state: SettingsState) => void> = [];
    private escHandler_: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.overlay = document.getElementById('settings-overlay')!;
        this.closeBtn = this.overlay.querySelector('.settings__close') as HTMLButtonElement;
        this.reducedMotionEl = document.getElementById('sm-reduced-motion') as HTMLInputElement;
        this.textSizeEl = document.getElementById('sm-text-size') as HTMLSelectElement;
        this.volumeEl = document.getElementById('sm-volume') as HTMLInputElement;

        this.state_ = this.load_();
        this.applyState_();
        this.bindControls_();

        this.closeBtn.addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
    }

    get state(): SettingsState {
        return { ...this.state_ };
    }

    /** Subscribe to settings changes. Callback fires immediately with current state. */
    onChange(listener: (state: SettingsState) => void): () => void {
        this.listeners_.push(listener);
        listener(this.state);
        return () => {
            const i = this.listeners_.indexOf(listener);
            if (i >= 0) this.listeners_.splice(i, 1);
        };
    }

    show(): void {
        this.reducedMotionEl.checked = this.state_.reducedMotion;
        this.textSizeEl.value = this.state_.textSize;
        this.volumeEl.value = String(this.state_.volume);
        this.overlay.classList.add('visible');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.escHandler_ = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            }
        };
        window.addEventListener('keydown', this.escHandler_);
    }

    hide(): void {
        this.overlay.classList.remove('visible');
        this.overlay.setAttribute('aria-hidden', 'true');
        if (this.escHandler_) {
            window.removeEventListener('keydown', this.escHandler_);
            this.escHandler_ = null;
        }
    }

    isVisible(): boolean {
        return this.overlay.classList.contains('visible');
    }

    private bindControls_(): void {
        this.reducedMotionEl.addEventListener('change', () => {
            this.state_ = { ...this.state_, reducedMotion: this.reducedMotionEl.checked };
            this.save_();
            this.applyState_();
            this.notify_();
        });
        this.textSizeEl.addEventListener('change', () => {
            this.state_ = { ...this.state_, textSize: this.textSizeEl.value as TextSize };
            this.save_();
            this.applyState_();
            this.notify_();
        });
        this.volumeEl.addEventListener('input', () => {
            this.state_ = { ...this.state_, volume: parseInt(this.volumeEl.value, 10) };
            this.save_();
            this.notify_();
        });
    }

    private applyState_(): void {
        // Text size - body class
        document.body.classList.remove('text-small', 'text-medium', 'text-large');
        document.body.classList.add(`text-${this.state_.textSize}`);
        // Reduced motion - body class, also picked up by @media (prefers-reduced-motion)
        // hooks in CSS that read the body class as a manual opt-in.
        if (this.state_.reducedMotion) {
            document.body.classList.add('reduced-motion');
        } else {
            document.body.classList.remove('reduced-motion');
        }
    }

    private notify_(): void {
        const state = this.state;
        for (const l of this.listeners_) l(state);
    }

    private load_(): SettingsState {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            const parsed = JSON.parse(raw) as Partial<SettingsState>;
            return {
                reducedMotion: parsed.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
                textSize: parsed.textSize ?? DEFAULT_SETTINGS.textSize,
                volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_SETTINGS.volume,
            };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    private save_(): void {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state_));
        } catch { /* private mode / disabled storage */ }
    }
}

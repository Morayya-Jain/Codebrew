import Phaser from 'phaser';

export const IDLE_KIOSK_EVENTS = {
    SOFT_PROMPT: 'idle:soft-prompt',
    WARNING: 'idle:warning',
    RESET: 'idle:reset',
} as const;

const SOFT_PROMPT_MS = 60_000;
const WARNING_MS = 120_000;
const RESET_MS = 180_000;

/**
 * Kiosk idle detection for museum walk-up contexts.
 *
 * Listens to any pointer or keyboard activity and resets its timer. Fires
 * three staged events:
 *   - SOFT_PROMPT at 60s: "still there?" hint, visitor can press any key
 *   - WARNING at 120s: gentle fade overlay
 *   - RESET at 180s: clear chapter state, return to attract/title
 *
 * A hidden staff shortcut (Ctrl+Shift+R) fires an immediate RESET so
 * museum staff can reboot the session without rebooting the browser.
 *
 * The system is attached to a Phaser Scene so its internal timers run on
 * scene time, pausing automatically when the scene is paused (e.g. during
 * StoryCard reading). That's the right behaviour - a visitor staring at
 * a story card shouldn't have an idle timer ticking against them.
 */
export class IdleKiosk extends Phaser.Events.EventEmitter {
    private readonly scene: Phaser.Scene;
    private timerSoft_: Phaser.Time.TimerEvent | null = null;
    private timerWarn_: Phaser.Time.TimerEvent | null = null;
    private timerReset_: Phaser.Time.TimerEvent | null = null;
    private enabled_ = true;
    private keydownHandler_: ((e: KeyboardEvent) => void) | null = null;
    private pointerHandler_: (() => void) | null = null;

    constructor(scene: Phaser.Scene) {
        super();
        this.scene = scene;
        this.bindListeners_();
        this.armTimers_();
    }

    /** Restart all idle timers - called from any activity listener. */
    reset(): void {
        if (!this.enabled_) return;
        this.cancelTimers_();
        this.armTimers_();
    }

    /** Disable temporarily, e.g. during the picker screen where idle should not fire. */
    setEnabled(enabled: boolean): void {
        this.enabled_ = enabled;
        if (!enabled) {
            this.cancelTimers_();
        } else {
            this.armTimers_();
        }
    }

    destroy(): void {
        this.cancelTimers_();
        if (this.keydownHandler_) {
            window.removeEventListener('keydown', this.keydownHandler_);
            this.keydownHandler_ = null;
        }
        if (this.pointerHandler_) {
            window.removeEventListener('pointerdown', this.pointerHandler_);
            window.removeEventListener('pointermove', this.pointerHandler_);
            this.pointerHandler_ = null;
        }
        this.removeAllListeners();
    }

    private armTimers_(): void {
        if (!this.enabled_) return;
        this.timerSoft_ = this.scene.time.delayedCall(SOFT_PROMPT_MS, () => {
            this.emit(IDLE_KIOSK_EVENTS.SOFT_PROMPT);
        });
        this.timerWarn_ = this.scene.time.delayedCall(WARNING_MS, () => {
            this.emit(IDLE_KIOSK_EVENTS.WARNING);
        });
        this.timerReset_ = this.scene.time.delayedCall(RESET_MS, () => {
            this.emit(IDLE_KIOSK_EVENTS.RESET);
        });
    }

    private cancelTimers_(): void {
        this.timerSoft_?.remove(false);
        this.timerWarn_?.remove(false);
        this.timerReset_?.remove(false);
        this.timerSoft_ = null;
        this.timerWarn_ = null;
        this.timerReset_ = null;
    }

    private bindListeners_(): void {
        this.keydownHandler_ = (e: KeyboardEvent) => {
            // Hidden staff shortcut: Ctrl+Shift+R - immediate reset.
            if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
                e.preventDefault();
                this.emit(IDLE_KIOSK_EVENTS.RESET);
                return;
            }
            this.reset();
        };
        this.pointerHandler_ = () => this.reset();
        window.addEventListener('keydown', this.keydownHandler_);
        window.addEventListener('pointerdown', this.pointerHandler_);
        window.addEventListener('pointermove', this.pointerHandler_, { passive: true });
    }
}

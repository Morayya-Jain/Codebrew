import type { NpcData } from '../types';

/**
 * Simple multi-line dialog modal used for NPC conversations. DOM-based like
 * StoryCard but kept as a separate component so changes here cannot regress
 * the landmark reading flow. Shows greeting -> lines[] -> farewell, one line
 * per click of Next, then closes. Escape or clicking outside also closes.
 */
export class DialogCard {
    private overlay: HTMLElement;
    private nameEl: HTMLElement;
    private roleEl: HTMLElement;
    private textEl: HTMLElement;
    private portraitInitialEl: HTMLElement;
    private nextButton: HTMLButtonElement;
    private skipButton: HTMLButtonElement;
    private closeButton: HTMLButtonElement;

    private onCloseCallback: (() => void) | null = null;
    private escHandler: ((e: KeyboardEvent) => void) | null = null;
    private outsideHandler: ((e: MouseEvent) => void) | null = null;

    private script: ReadonlyArray<string> = [];
    private cursor_ = 0;

    constructor() {
        this.overlay = document.getElementById('dialog-card-overlay')!;
        this.nameEl = this.overlay.querySelector('.dialog-card__name')!;
        this.roleEl = this.overlay.querySelector('.dialog-card__role')!;
        this.textEl = this.overlay.querySelector('.dialog-card__text')!;
        this.portraitInitialEl = this.overlay.querySelector('.dialog-card__portrait-initial')!;
        this.nextButton = this.overlay.querySelector('.dialog-card__next-btn') as HTMLButtonElement;
        this.skipButton = this.overlay.querySelector('.dialog-card__skip-btn') as HTMLButtonElement;
        this.closeButton = this.overlay.querySelector('.dialog-card__close-btn') as HTMLButtonElement;

        this.closeButton.addEventListener('click', () => this.hide());
        this.nextButton.addEventListener('click', () => this.advance_());
        this.skipButton.addEventListener('click', () => this.hide());
    }

    show(data: NpcData, onClose: () => void): void {
        this.onCloseCallback = onClose;

        this.nameEl.textContent = data.name;
        this.roleEl.textContent = data.role;
        this.portraitInitialEl.textContent = (data.name[0] ?? '?').toUpperCase();

        // Build the linear conversation: greeting, then each line, then farewell.
        this.script = [data.greeting, ...data.lines, data.farewell];
        this.cursor_ = 0;
        this.textEl.textContent = this.script[0] ?? '';
        this.updateNextLabel_();

        this.overlay.classList.add('visible');
        this.overlay.setAttribute('aria-hidden', 'false');

        this.escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
                return;
            }
            // Enter or Space advances.
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.advance_();
            }
        };
        window.addEventListener('keydown', this.escHandler);

        this.outsideHandler = (e: MouseEvent) => {
            if (e.target === this.overlay) this.hide();
        };
        this.overlay.addEventListener('click', this.outsideHandler);
    }

    hide(): void {
        this.overlay.classList.remove('visible');
        this.overlay.setAttribute('aria-hidden', 'true');

        if (this.escHandler) {
            window.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
        if (this.outsideHandler) {
            this.overlay.removeEventListener('click', this.outsideHandler);
            this.outsideHandler = null;
        }

        if (this.onCloseCallback) {
            const cb = this.onCloseCallback;
            this.onCloseCallback = null;
            // Match the CSS transition duration so the scene resumes after
            // the card has fully faded out.
            setTimeout(() => cb(), 250);
        }
    }

    private advance_(): void {
        if (this.cursor_ >= this.script.length - 1) {
            this.hide();
            return;
        }
        this.cursor_++;
        this.textEl.textContent = this.script[this.cursor_] ?? '';
        this.updateNextLabel_();
    }

    private updateNextLabel_(): void {
        const isLast = this.cursor_ >= this.script.length - 1;
        this.nextButton.textContent = isLast ? 'Farewell' : 'Next';
    }
}

interface TeaserData {
    id: string;
    name: string;
    teaserLine: string;
}

/**
 * Small DOM modal shown when the player interacts with a landmark that is
 * in the treasure hunt selection but is not the current clue target. The
 * landmark's full story stays locked — the player sees only a name and a
 * single evocative line, and the clue chain is untouched.
 *
 * Mirrors the StoryCard API (show(data, onClose) / hide()) so UIScene can
 * drive both with the same lifecycle.
 */
export class TeaserCard {
    private overlay: HTMLElement;
    private nameEl: HTMLElement;
    private lineEl: HTMLElement;
    private continueButton: HTMLButtonElement;
    private closeButton: HTMLButtonElement;
    private onCloseCallback: (() => void) | null = null;
    private escHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.overlay = document.getElementById('teaser-card-overlay')!;
        this.nameEl = this.overlay.querySelector('.teaser-card__name')!;
        this.lineEl = this.overlay.querySelector('.teaser-card__line')!;
        this.continueButton = this.overlay.querySelector('.teaser-card__continue-btn') as HTMLButtonElement;
        this.closeButton = this.overlay.querySelector('.teaser-card__close-btn') as HTMLButtonElement;

        this.continueButton.addEventListener('click', () => this.hide());
        this.closeButton.addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
    }

    show(data: TeaserData, onClose: () => void): void {
        this.onCloseCallback = onClose;
        this.nameEl.textContent = data.name;
        this.lineEl.textContent = data.teaserLine;

        this.overlay.classList.add('visible');
        this.overlay.setAttribute('aria-hidden', 'false');

        this.escHandler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            }
        };
        window.addEventListener('keydown', this.escHandler);
    }

    hide(): void {
        this.overlay.classList.remove('visible');
        this.overlay.setAttribute('aria-hidden', 'true');

        if (this.escHandler) {
            window.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }

        if (this.onCloseCallback) {
            const cb = this.onCloseCallback;
            this.onCloseCallback = null;
            setTimeout(() => cb(), 300);
        }
    }
}

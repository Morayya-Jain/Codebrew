import type { ChapterData, Citation, SeasonPresetData } from '../types';

/**
 * End-of-chapter farewell modal. Triggered by CHAPTER_EVENTS.CHAPTER_COMPLETE.
 *
 * Shows:
 *   - "Thank you for walking with me."
 *   - Chapter title + season
 *   - Citations (from chapters.json)
 *   - Attribution statement
 *   - "Press any key to begin again" prompt
 *
 * Dismissed by:
 *   - Any key or pointer press on the overlay
 *   - 30-second idle auto-dismiss (handled by the scene's IdleKiosk)
 *
 * On dismiss, fires a callback so GameScene can reset the chapter state
 * and either return to attract mode or show the picker again.
 */
export class FarewellScreen {
    private readonly overlay: HTMLElement;
    private readonly chapterEl: HTMLElement;
    private readonly citationsEl: HTMLElement;
    private onDismiss_: (() => void) | null = null;
    private keydownHandler_: ((e: KeyboardEvent) => void) | null = null;
    private clickHandler_: (() => void) | null = null;

    constructor() {
        this.overlay = document.getElementById('farewell-overlay')!;
        this.chapterEl = this.overlay.querySelector('.fw__chapter')!;
        this.citationsEl = this.overlay.querySelector('.fw__citations')!;
    }

    show(
        chapter: ChapterData,
        seasonPreset: SeasonPresetData | null,
        onDismiss: () => void,
    ): void {
        this.onDismiss_ = onDismiss;

        // Title stays as the static farewell line from the HTML. Chapter row
        // carries the human-readable chapter name + season.
        const seasonName = seasonPreset?.displayName ?? chapter.subtitle;
        this.chapterEl.textContent = `${chapter.title}  .  ${seasonName}`;

        this.renderCitations_(chapter.citations);

        this.overlay.classList.add('visible');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.bindInput_();
    }

    hide(): void {
        this.overlay.classList.remove('visible');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.unbindInput_();
    }

    private renderCitations_(citations: ReadonlyArray<Citation>): void {
        this.citationsEl.innerHTML = '';
        for (const c of citations) {
            const li = document.createElement('li');
            if (c.url) {
                const a = document.createElement('a');
                a.href = c.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = `${c.title} - ${c.publisher}`;
                li.appendChild(a);
            } else {
                li.textContent = `${c.title} - ${c.publisher}`;
            }
            this.citationsEl.appendChild(li);
        }
    }

    private bindInput_(): void {
        // Small delay so the keystroke that triggered the chapter end doesn't
        // immediately dismiss the farewell screen. 800ms matches the overlay
        // fade-in so the visitor sees the full screen before they can skip.
        window.setTimeout(() => {
            this.keydownHandler_ = () => this.dismiss_();
            this.clickHandler_ = () => this.dismiss_();
            window.addEventListener('keydown', this.keydownHandler_);
            this.overlay.addEventListener('click', this.clickHandler_);
        }, 800);
    }

    private unbindInput_(): void {
        if (this.keydownHandler_) {
            window.removeEventListener('keydown', this.keydownHandler_);
            this.keydownHandler_ = null;
        }
        if (this.clickHandler_) {
            this.overlay.removeEventListener('click', this.clickHandler_);
            this.clickHandler_ = null;
        }
    }

    private dismiss_(): void {
        const cb = this.onDismiss_;
        this.onDismiss_ = null;
        this.hide();
        if (cb) cb();
    }
}

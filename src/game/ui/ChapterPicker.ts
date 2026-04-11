import type { ChapterData, ChaptersFile, SeasonPresetData } from '../types';
import { TTSManager } from './TTSManager';

/**
 * Fullscreen season selection screen. DOM-based so typography scales with
 * the viewport (the Phaser canvas is FIT-scaled, which would force us to
 * work in game-pixel coordinates; DOM is simpler).
 *
 * Keyboard:
 *   Arrow keys = move focus between cards
 *   Enter / E / Space = confirm the focused card
 * Mouse / touch: click a card to select it.
 *
 * Emits its selection through a callback passed to `show()`. TTS announces
 * the focused card so museum visitors who are blind or low-vision still
 * get the options read to them.
 */
export class ChapterPicker {
    private readonly overlay: HTMLElement;
    private readonly grid: HTMLElement;
    private readonly tts: TTSManager;
    private cards_: HTMLButtonElement[] = [];
    private focusedIndex_ = 0;
    private chapters_: ReadonlyArray<ChapterData> = [];
    private seasonPresets_: ReadonlyArray<SeasonPresetData> = [];
    private onSelected_: ((chapterId: string) => void) | null = null;
    private keydownHandler_: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.overlay = document.getElementById('chapter-picker-overlay')!;
        this.grid = document.getElementById('cp-grid')!;
        this.tts = new TTSManager();
    }

    show(data: ChaptersFile, onSelected: (chapterId: string) => void): void {
        this.chapters_ = data.chapters;
        this.seasonPresets_ = data.seasonPresets;
        this.onSelected_ = onSelected;
        this.renderCards_();
        this.focusedIndex_ = 0;
        this.updateFocus_();
        this.overlay.classList.add('visible');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.bindKeyboard_();
        this.announceCurrent_();
    }

    hide(): void {
        this.overlay.classList.remove('visible');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.unbindKeyboard_();
        this.tts.stop();
    }

    private renderCards_(): void {
        this.grid.innerHTML = '';
        this.cards_ = [];
        this.chapters_.forEach((chapter, idx) => {
            const card = document.createElement('button');
            card.className = 'cp__card';
            card.dataset.chapterId = chapter.id;
            card.dataset.idx = String(idx);
            card.type = 'button';

            const preset = this.seasonPresets_.find(p => p.id === chapter.seasonPresetId);

            const seasonEl = document.createElement('div');
            seasonEl.className = 'cp__season';
            seasonEl.textContent = preset?.displayName ?? chapter.subtitle;

            const titleEl = document.createElement('div');
            titleEl.className = 'cp__chapter-title';
            titleEl.textContent = chapter.title;

            const timeEl = document.createElement('div');
            timeEl.className = 'cp__time';
            timeEl.textContent = this.formatTimeOfDay_(preset);

            card.appendChild(seasonEl);
            card.appendChild(titleEl);
            card.appendChild(timeEl);

            card.addEventListener('mouseenter', () => {
                this.focusedIndex_ = idx;
                this.updateFocus_();
                this.announceCurrent_();
            });
            card.addEventListener('click', () => {
                this.select_(idx);
            });

            this.grid.appendChild(card);
            this.cards_.push(card);
        });
    }

    private formatTimeOfDay_(preset: SeasonPresetData | undefined): string {
        if (!preset) return '';
        const parts: string[] = [];
        if (preset.timeOfDay) parts.push(this.prettyTime_(preset.timeOfDay));
        if (preset.weather && preset.weather !== 'clear') parts.push(preset.weather);
        return parts.join('  .  ');
    }

    private prettyTime_(raw: string): string {
        const map: Record<string, string> = {
            'dawn': 'Dawn',
            'morning': 'Morning',
            'golden-hour': 'Golden hour',
            'goldenHour': 'Golden hour',
            'midday': 'Midday',
            'dusk': 'Dusk',
            'night': 'Night',
        };
        return map[raw] ?? raw;
    }

    private updateFocus_(): void {
        this.cards_.forEach((card, i) => {
            if (i === this.focusedIndex_) {
                card.classList.add('focused');
                card.focus();
            } else {
                card.classList.remove('focused');
            }
        });
    }

    private announceCurrent_(): void {
        if (!this.tts.isSupported()) return;
        const chapter = this.chapters_[this.focusedIndex_];
        if (!chapter) return;
        const preset = this.seasonPresets_.find(p => p.id === chapter.seasonPresetId);
        const text = preset
            ? `${chapter.title}. ${preset.displayName}.`
            : chapter.title;
        this.tts.stop();
        this.tts.speak(text);
    }

    private select_(idx: number): void {
        const chapter = this.chapters_[idx];
        if (!chapter) return;
        const id = chapter.id;
        this.hide();
        // Delay callback one tick so the overlay fade-out can start first.
        setTimeout(() => {
            this.onSelected_?.(id);
            this.onSelected_ = null;
        }, 100);
    }

    private bindKeyboard_(): void {
        if (this.keydownHandler_) return;
        const cols = 3;
        this.keydownHandler_ = (e: KeyboardEvent) => {
            const count = this.cards_.length;
            if (count === 0) return;
            let handled = true;
            switch (e.key) {
                case 'ArrowLeft':
                    this.focusedIndex_ = (this.focusedIndex_ - 1 + count) % count;
                    break;
                case 'ArrowRight':
                    this.focusedIndex_ = (this.focusedIndex_ + 1) % count;
                    break;
                case 'ArrowUp':
                    this.focusedIndex_ = (this.focusedIndex_ - cols + count) % count;
                    break;
                case 'ArrowDown':
                    this.focusedIndex_ = (this.focusedIndex_ + cols) % count;
                    break;
                case 'Enter':
                case ' ':
                case 'e':
                case 'E':
                    this.select_(this.focusedIndex_);
                    return;
                default:
                    handled = false;
            }
            if (handled) {
                e.preventDefault();
                this.updateFocus_();
                this.announceCurrent_();
            }
        };
        window.addEventListener('keydown', this.keydownHandler_);
    }

    private unbindKeyboard_(): void {
        if (this.keydownHandler_) {
            window.removeEventListener('keydown', this.keydownHandler_);
            this.keydownHandler_ = null;
        }
    }
}

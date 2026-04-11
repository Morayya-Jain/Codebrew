import { TTSManager } from './TTSManager';
import type { LandmarkData } from '../types';

export class StoryCard {
    private overlay: HTMLElement;
    private titleEl: HTMLElement;
    private illustrationEl: HTMLElement;
    private storyTextEl: HTMLElement;
    private ttsButton: HTMLButtonElement;
    private closeButton: HTMLButtonElement;
    private tts: TTSManager;
    private onCloseCallback: (() => void) | null = null;
    private escHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.tts = new TTSManager();
        this.overlay = document.getElementById('story-card-overlay')!;
        this.titleEl = this.overlay.querySelector('.story-card__title')!;
        this.illustrationEl = this.overlay.querySelector('.story-card__illustration')!;
        this.storyTextEl = this.overlay.querySelector('.story-card__text')!;
        this.ttsButton = this.overlay.querySelector('.story-card__tts-btn') as HTMLButtonElement;
        this.closeButton = this.overlay.querySelector('.story-card__close-btn') as HTMLButtonElement;

        this.closeButton.addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        if (!this.tts.isSupported()) {
            this.ttsButton.style.display = 'none';
        }
    }

    show(data: LandmarkData, onClose: () => void): void {
        this.tts.stop();
        this.onCloseCallback = onClose;

        this.titleEl.textContent = data.name;
        this.storyTextEl.textContent = data.fullStory;

        this.illustrationEl.style.backgroundColor = data.illustrationColor;
        const label = this.illustrationEl.querySelector('.story-card__illustration-label');
        if (label) {
            label.textContent = data.name;
        }

        this.ttsButton.textContent = 'Read Aloud';
        this.ttsButton.onclick = () => this.toggleTTS(data.fullStory);

        this.overlay.classList.add('visible');

        this.escHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            }
        };
        window.addEventListener('keydown', this.escHandler);
    }

    hide(): void {
        this.tts.stop();
        this.overlay.classList.remove('visible');
        this.ttsButton.textContent = 'Read Aloud';

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

    private toggleTTS(text: string): void {
        if (this.tts.speaking) {
            this.tts.stop();
            this.ttsButton.textContent = 'Read Aloud';
        } else {
            this.tts.speak(text, () => {
                this.ttsButton.textContent = 'Read Aloud';
            });
            this.ttsButton.textContent = 'Stop Reading';
        }
    }
}

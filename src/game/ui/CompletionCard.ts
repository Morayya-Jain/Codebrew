import type { LandmarkData, Region } from '../types';
import { REGION_LABELS } from '../types';

interface CompletionPayload {
    region: Region;
    visited: LandmarkData[];
}

/**
 * End-of-hunt overlay. Shown when the player has visited all 10 clue
 * targets. Lists the landmarks in visit order and offers two outcomes:
 * replay (back to region picker) or exit (back to the title screen).
 */
export class CompletionCard {
    private overlay: HTMLElement;
    private titleEl: HTMLElement;
    private subtitleEl: HTMLElement;
    private listEl: HTMLElement;
    private replayButton: HTMLButtonElement;
    private exitButton: HTMLButtonElement;
    private onReplay: (() => void) | null = null;
    private onExit: (() => void) | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.overlay = document.getElementById('completion-card-overlay')!;
        this.titleEl = this.overlay.querySelector('.completion-card__title')!;
        this.subtitleEl = this.overlay.querySelector('.completion-card__subtitle')!;
        this.listEl = this.overlay.querySelector('.completion-card__list')!;
        this.replayButton = this.overlay.querySelector('.completion-card__replay-btn') as HTMLButtonElement;
        this.exitButton = this.overlay.querySelector('.completion-card__exit-btn') as HTMLButtonElement;

        this.replayButton.addEventListener('click', () => {
            if (this.onReplay) this.onReplay();
        });
        this.exitButton.addEventListener('click', () => {
            if (this.onExit) this.onExit();
        });
    }

    show(
        payload: CompletionPayload,
        onReplay: () => void,
        onExit: () => void,
    ): void {
        this.onReplay = onReplay;
        this.onExit = onExit;

        this.titleEl.textContent = 'You have walked the whole path';
        this.subtitleEl.textContent = `Ten landmarks in ${REGION_LABELS[payload.region]}, followed in order.`;

        // Build the visited list. Immutable: clear and re-append fresh nodes.
        while (this.listEl.firstChild) {
            this.listEl.removeChild(this.listEl.firstChild);
        }
        payload.visited.forEach((lm, i) => {
            const item = document.createElement('li');
            item.className = 'completion-card__list-item';

            const index = document.createElement('span');
            index.className = 'completion-card__list-index';
            index.textContent = `${i + 1}.`;

            const name = document.createElement('span');
            name.className = 'completion-card__list-name';
            name.textContent = lm.name;

            item.appendChild(index);
            item.appendChild(name);
            this.listEl.appendChild(item);
        });

        this.overlay.classList.add('visible');
        this.overlay.setAttribute('aria-hidden', 'false');

        this.keyHandler = (e: KeyboardEvent): void => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (this.onReplay) this.onReplay();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (this.onExit) this.onExit();
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    hide(): void {
        this.overlay.classList.remove('visible');
        this.overlay.setAttribute('aria-hidden', 'true');
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
        this.onReplay = null;
        this.onExit = null;
    }
}

// Module-level reference to the TTSManager that currently owns playback.
// Audio output is effectively a single user-facing stream; before this guard
// multiple instances (StoryCard / ChapterPicker / ElderVoice) could each think
// they were speaking at the same time, leading to overlapping voices and stuck
// UI state. Any speak() from a new instance silences the previous one and
// becomes the new owner.
let activeManager: TTSManager | null = null;

export class TTSManager {
    private _speaking = false;
    private utterance: SpeechSynthesisUtterance | null = null;
    private pendingOnEnd: (() => void) | undefined;

    get speaking(): boolean {
        return this._speaking;
    }

    isSupported(): boolean {
        return 'speechSynthesis' in window;
    }

    speak(text: string, onEnd?: () => void): void {
        if (activeManager && activeManager !== this) {
            activeManager.stop();
        }
        this.stop();
        activeManager = this;

        if (!this.isSupported()) {
            onEnd?.();
            return;
        }

        this.pendingOnEnd = onEnd;
        this._speaking = true;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        this.utterance = utterance;

        const finish = () => {
            if (this.utterance !== utterance) return;
            this.utterance = null;
            this._speaking = false;
            if (activeManager === this) activeManager = null;
            const cb = this.pendingOnEnd;
            this.pendingOnEnd = undefined;
            cb?.();
        };

        utterance.onend = finish;
        utterance.onerror = finish;

        window.speechSynthesis.speak(utterance);
    }

    stop(): void {
        if (this.isSupported()) {
            window.speechSynthesis.cancel();
        }
        this.utterance = null;
        this.pendingOnEnd = undefined;
        this._speaking = false;
        if (activeManager === this) activeManager = null;
    }
}

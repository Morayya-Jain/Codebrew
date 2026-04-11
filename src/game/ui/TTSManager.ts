// Module-level reference to the TTSManager that currently owns the browser's
// speechSynthesis queue. Web Speech is a single global resource, and before
// this guard multiple instances (StoryCard / ChapterPicker / ElderVoice) could
// each think they were speaking at the same time, leading to overlapping
// voices and stuck UI state. Any speak() from a new instance silences the
// previous one and becomes the new owner.
let activeManager: TTSManager | null = null;

export class TTSManager {
    private synth: SpeechSynthesis | null;
    private voice: SpeechSynthesisVoice | null = null;
    private _speaking = false;

    constructor() {
        this.synth = window.speechSynthesis ?? null;
        if (this.synth) {
            this.initVoice();
        }
    }

    get speaking(): boolean {
        return this._speaking;
    }

    isSupported(): boolean {
        return this.synth !== null;
    }

    speak(text: string, onEnd?: () => void): void {
        if (!this.synth) return;

        if (activeManager && activeManager !== this) {
            activeManager.stop();
        }
        this.stop();
        activeManager = this;

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) {
            utterance.voice = this.voice;
        }
        utterance.rate = 0.92;
        utterance.pitch = 1.05;

        utterance.onend = () => {
            this._speaking = false;
            if (activeManager === this) activeManager = null;
            onEnd?.();
        };

        utterance.onerror = () => {
            this._speaking = false;
            if (activeManager === this) activeManager = null;
        };

        this._speaking = true;
        this.synth.speak(utterance);
    }

    stop(): void {
        if (!this.synth) return;
        this.synth.cancel();
        this._speaking = false;
        if (activeManager === this) activeManager = null;
    }

    private initVoice(): void {
        if (!this.synth) return;

        const pickVoice = () => {
            const voices = this.synth!.getVoices();
            const enVoices = voices.filter(v => v.lang.startsWith('en'));

            this.voice =
                // Premium/Enhanced macOS voices (best quality available locally)
                enVoices.find(v => v.name.includes('Premium')) ??
                enVoices.find(v => v.name.includes('Enhanced')) ??
                // Known high-quality macOS enhanced voices by name
                enVoices.find(v => /\b(Zoe|Karen|Daniel|Moira|Tessa)\b/.test(v.name) && !v.localService) ??
                // Microsoft Online Natural voices (Edge browser)
                enVoices.find(v => v.name.includes('Natural') || v.name.includes('Online')) ??
                // Google Neural/Wavenet voices (Chrome)
                enVoices.find(v => v.name.includes('Google') && v.name.includes('UK')) ??
                enVoices.find(v => v.name.includes('Google')) ??
                // Non-local voices tend to be higher quality (cloud-based)
                enVoices.find(v => !v.localService) ??
                // Samantha is decent on macOS
                enVoices.find(v => v.name.includes('Samantha')) ??
                // Any local English voice
                enVoices.find(v => v.localService) ??
                enVoices[0] ??
                null;
        };

        pickVoice();

        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = pickVoice;
        }
    }
}

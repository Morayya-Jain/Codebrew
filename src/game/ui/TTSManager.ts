export class TTSManager {
    private synth: SpeechSynthesis | null;
    private voice: SpeechSynthesisVoice | null = null;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
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

        this.stop();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) {
            utterance.voice = this.voice;
        }
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            this._speaking = false;
            this.currentUtterance = null;
            onEnd?.();
        };

        utterance.onerror = () => {
            this._speaking = false;
            this.currentUtterance = null;
        };

        this.currentUtterance = utterance;
        this._speaking = true;
        this.synth.speak(utterance);
    }

    stop(): void {
        if (!this.synth) return;
        this.synth.cancel();
        this._speaking = false;
        this.currentUtterance = null;
    }

    private initVoice(): void {
        if (!this.synth) return;

        const pickVoice = () => {
            const voices = this.synth!.getVoices();
            const enVoices = voices.filter(v => v.lang.startsWith('en'));

            this.voice =
                enVoices.find(v => v.name.includes('Samantha')) ??
                enVoices.find(v => v.name.includes('Google') && v.name.includes('UK')) ??
                enVoices.find(v => v.name.includes('Google')) ??
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

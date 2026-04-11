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

        this.stop();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) {
            utterance.voice = this.voice;
        }
        utterance.rate = 0.92;
        utterance.pitch = 1.05;

        utterance.onend = () => {
            this._speaking = false;
            onEnd?.();
        };

        utterance.onerror = () => {
            this._speaking = false;
        };

        this._speaking = true;
        this.synth.speak(utterance);
    }

    stop(): void {
        if (!this.synth) return;
        this.synth.cancel();
        this._speaking = false;
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

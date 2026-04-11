// Module-level reference to the TTSManager that currently owns playback.
// Audio output is effectively a single user-facing stream; before this guard
// multiple instances (StoryCard / ChapterPicker / ElderVoice) could each think
// they were speaking at the same time, leading to overlapping voices and stuck
// UI state. Any speak() from a new instance silences the previous one and
// becomes the new owner.
let activeManager: TTSManager | null = null;

const ELEVENLABS_TTS_URL =
    'https://api.elevenlabs.io/v1/text-to-speech/n1PvBOwxb8X6m7tahp2h';
const ELEVENLABS_API_KEY =
    'sk_501483640de965deb23a7af92495caa84389fdde39b8913f';

export class TTSManager {
    private _speaking = false;
    private currentAudio: HTMLAudioElement | null = null;
    private currentObjectUrl: string | null = null;
    private fetchAbort: AbortController | null = null;
    private pendingOnEnd: (() => void) | undefined;

    get speaking(): boolean {
        return this._speaking;
    }

    isSupported(): boolean {
        return true;
    }

    speak(text: string, onEnd?: () => void): void {
        if (activeManager && activeManager !== this) {
            activeManager.stop();
        }
        this.stop();
        activeManager = this;

        this.pendingOnEnd = onEnd;
        this._speaking = true;

        const abort = new AbortController();
        this.fetchAbort = abort;

        const revokeBlobUrl = (url: string) => {
            URL.revokeObjectURL(url);
            if (this.currentObjectUrl === url) {
                this.currentObjectUrl = null;
            }
        };

        const resetAfterPlayback = (url: string) => {
            revokeBlobUrl(url);
            this.currentAudio = null;
            this._speaking = false;
            if (activeManager === this) activeManager = null;
            const cb = this.pendingOnEnd;
            this.pendingOnEnd = undefined;
            cb?.();
        };

        void (async () => {
            try {
                const response = await fetch(ELEVENLABS_TTS_URL, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json',
                        Accept: 'audio/mpeg',
                    },
                    body: JSON.stringify({
                        text,
                        model_id: 'eleven_multilingual_v2',
                    }),
                    signal: abort.signal,
                });

                if (!response.ok) {
                    throw new Error(`ElevenLabs TTS HTTP ${response.status}`);
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);

                if (abort.signal.aborted || activeManager !== this || !this._speaking) {
                    URL.revokeObjectURL(url);
                    return;
                }

                this.currentObjectUrl = url;
                const audio = new Audio(url);
                this.currentAudio = audio;

                audio.onended = () => {
                    if (this.currentAudio !== audio) return;
                    resetAfterPlayback(url);
                };

                audio.onerror = () => {
                    if (this.currentAudio !== audio) return;
                    revokeBlobUrl(url);
                    this.currentAudio = null;
                    this._speaking = false;
                    if (activeManager === this) activeManager = null;
                    const cb = this.pendingOnEnd;
                    this.pendingOnEnd = undefined;
                    cb?.();
                };

                try {
                    await audio.play();
                } catch {
                    if (this.currentAudio !== audio) return;
                    revokeBlobUrl(url);
                    this.currentAudio = null;
                    this._speaking = false;
                    if (activeManager === this) activeManager = null;
                    const cb = this.pendingOnEnd;
                    this.pendingOnEnd = undefined;
                    cb?.();
                }
            } catch {
                if (abort.signal.aborted) return;

                this._speaking = false;
                if (activeManager === this) activeManager = null;
                const cb = this.pendingOnEnd;
                this.pendingOnEnd = undefined;
                cb?.();
            }
        })();
    }

    stop(): void {
        this.fetchAbort?.abort();
        this.fetchAbort = null;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        if (this.currentObjectUrl) {
            URL.revokeObjectURL(this.currentObjectUrl);
            this.currentObjectUrl = null;
        }

        this.pendingOnEnd = undefined;
        this._speaking = false;
        if (activeManager === this) activeManager = null;
    }
}

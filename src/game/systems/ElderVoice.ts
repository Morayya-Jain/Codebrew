import { Events } from 'phaser';
import type { ElderLine } from '../types';
import { TTSManager } from '../ui/TTSManager';

export const ELDER_VOICE_EVENTS = {
    LINE_START: 'elder:line-start',
    LINE_END: 'elder:line-end',
    QUEUE_COMPLETE: 'elder:queue-complete',
} as const;

/**
 * Narration queue for the Elder. Plays ElderLines sequentially.
 *
 * Uses the existing TTSManager today. For later phases, if a pre-recorded
 * audio key exists in the scene cache under `vo-{lineId}`, it will be played
 * instead (and TTS is skipped). This keeps the Phase-1 path working now and
 * makes swapping in a voice actor a pure asset drop.
 *
 * A sensible minimum line duration is enforced so that a visitor without TTS
 * (or with TTS that returns `onend` too fast) still has time to read the
 * subtitle. Duration is computed from the word count unless overridden.
 */
export class ElderVoice extends Events.EventEmitter {
    private readonly tts: TTSManager;
    private readonly getAudioKey: ((lineId: string) => string | null) | null;
    private readonly playAudio: ((audioKey: string, onEnd: () => void) => void) | null;
    private queue_: ElderLine[] = [];
    private currentLine_: ElderLine | null = null;
    private currentTimer_: number | null = null;
    private stopped_ = false;

    constructor(opts?: {
        tts?: TTSManager;
        getAudioKey?: (lineId: string) => string | null;
        playAudio?: (audioKey: string, onEnd: () => void) => void;
    }) {
        super();
        this.tts = opts?.tts ?? new TTSManager();
        this.getAudioKey = opts?.getAudioKey ?? null;
        this.playAudio = opts?.playAudio ?? null;
    }

    get currentLine(): ElderLine | null {
        return this.currentLine_;
    }

    get isSpeaking(): boolean {
        return this.currentLine_ !== null;
    }

    get isEmpty(): boolean {
        return this.queue_.length === 0 && this.currentLine_ === null;
    }

    /** Queue a sequence of lines. Plays immediately if idle. */
    enqueue(lines: ReadonlyArray<ElderLine>): void {
        for (const line of lines) {
            this.queue_.push(line);
        }
        this.stopped_ = false;
        if (this.currentLine_ === null) {
            this.playNext_();
        }
    }

    /** Skip the current line and move to the next in the queue. */
    skip(): void {
        if (this.currentLine_ === null) return;
        this.finishCurrent_();
    }

    /** Stop everything, clear the queue, silence TTS. */
    stop(): void {
        this.stopped_ = true;
        this.queue_ = [];
        if (this.currentTimer_ !== null) {
            window.clearTimeout(this.currentTimer_);
            this.currentTimer_ = null;
        }
        this.tts.stop();
        if (this.currentLine_ !== null) {
            const line = this.currentLine_;
            this.currentLine_ = null;
            this.emit(ELDER_VOICE_EVENTS.LINE_END, line);
        }
    }

    private playNext_(): void {
        if (this.stopped_) return;
        const next = this.queue_.shift();
        if (!next) {
            this.currentLine_ = null;
            this.emit(ELDER_VOICE_EVENTS.QUEUE_COMPLETE);
            return;
        }
        this.currentLine_ = next;
        this.emit(ELDER_VOICE_EVENTS.LINE_START, next);

        const minDurationMs = estimateReadingDuration(next.text);
        const fallbackTimer = window.setTimeout(() => {
            if (this.currentLine_ === next) this.finishCurrent_();
        }, minDurationMs + 1500);
        this.currentTimer_ = fallbackTimer;

        const audioKey = this.getAudioKey?.(next.id) ?? null;
        if (audioKey !== null && this.playAudio !== null) {
            this.playAudio(audioKey, () => {
                if (this.currentLine_ === next) this.finishCurrent_();
            });
            return;
        }

        if (this.tts.isSupported()) {
            this.tts.speak(next.text, () => {
                if (this.currentLine_ === next) this.finishCurrent_();
            });
        } else {
            window.setTimeout(() => {
                if (this.currentLine_ === next) this.finishCurrent_();
            }, minDurationMs);
        }
    }

    private finishCurrent_(): void {
        if (this.currentTimer_ !== null) {
            window.clearTimeout(this.currentTimer_);
            this.currentTimer_ = null;
        }
        this.tts.stop();
        const line = this.currentLine_;
        this.currentLine_ = null;
        if (line) {
            this.emit(ELDER_VOICE_EVENTS.LINE_END, line);
        }
        if (this.stopped_) return;
        this.playNext_();
    }
}

/**
 * Minimum time a line should stay on screen. ~200 wpm reading pace with a
 * 1.8s floor so a 3-word line doesn't flicker past.
 */
function estimateReadingDuration(text: string): number {
    const words = text.trim().split(/\s+/).length;
    const wpm = 200;
    const ms = (words / wpm) * 60_000;
    return Math.max(1800, Math.round(ms));
}

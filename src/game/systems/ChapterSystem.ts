import { Events } from 'phaser';
import type {
    ChapterData,
    ChapterPhase,
    ChaptersFile,
    ElderLine,
    SeasonPresetData,
    Waypoint,
} from '../types';
import { ElderVoice, ELDER_VOICE_EVENTS } from './ElderVoice';

export const CHAPTER_EVENTS = {
    PHASE_CHANGED: 'chapter:phase-changed',
    WAYPOINT_ACTIVE: 'chapter:waypoint-active',
    WAYPOINT_ARRIVED: 'chapter:waypoint-arrived',
    ELDER_LINE_START: 'chapter:elder-line-start',
    ELDER_LINE_END: 'chapter:elder-line-end',
    CHAPTER_READY: 'chapter:ready',
    CHAPTER_COMPLETE: 'chapter:complete',
} as const;

/**
 * Central state machine for the elder-led apprentice journey.
 *
 * Owns:
 *   - The current ChapterData
 *   - The current ChapterPhase (attract / welcome / hub / walking / story / close / farewell)
 *   - The current active waypoint index
 *   - An ElderVoice queue
 *
 * Emits high-level events that the GameScene, UIScene and individual UI
 * components listen to. Other systems never advance phase directly — they
 * call `beginWelcome()`, `beginHub()`, `onWaypointNear(landmarkId)`, etc.
 */
export class ChapterSystem extends Events.EventEmitter {
    readonly elderVoice: ElderVoice;
    private chapter_: ChapterData | null = null;
    private seasonPreset_: SeasonPresetData | null = null;
    private phase_: ChapterPhase = 'attract';
    private activeWaypointIndex_ = 0;
    private arrivedWaypointIds_: Set<string> = new Set();
    private pendingFarewellAfterQueue_ = false;

    constructor(elderVoice?: ElderVoice) {
        super();
        this.elderVoice = elderVoice ?? new ElderVoice();
        this.wireElderVoice_();
    }

    // ---------------------------------------------------------------------
    // Loading
    // ---------------------------------------------------------------------

    load(file: ChaptersFile, chapterId?: string): void {
        const chapter = chapterId
            ? file.chapters.find(c => c.id === chapterId)
            : file.chapters[0];
        if (!chapter) {
            // eslint-disable-next-line no-console
            console.warn(`[ChapterSystem] Chapter not found: ${chapterId ?? '(default)'}`);
            return;
        }
        this.chapter_ = chapter;
        this.seasonPreset_ =
            file.seasonPresets.find(p => p.id === chapter.seasonPresetId) ?? null;
        this.activeWaypointIndex_ = 0;
        this.arrivedWaypointIds_.clear();
        this.emit(CHAPTER_EVENTS.CHAPTER_READY, chapter);
    }

    // ---------------------------------------------------------------------
    // Public accessors
    // ---------------------------------------------------------------------

    get chapter(): ChapterData | null {
        return this.chapter_;
    }

    get seasonPreset(): SeasonPresetData | null {
        return this.seasonPreset_;
    }

    get phase(): ChapterPhase {
        return this.phase_;
    }

    get activeWaypoint(): Waypoint | null {
        if (!this.chapter_) return null;
        return this.chapter_.waypoints[this.activeWaypointIndex_] ?? null;
    }

    get activeWaypointIndex(): number {
        return this.activeWaypointIndex_;
    }

    get totalWaypoints(): number {
        return this.chapter_?.waypoints.length ?? 0;
    }

    isWaypointArrived(waypointId: string): boolean {
        return this.arrivedWaypointIds_.has(waypointId);
    }

    /** The set of landmark IDs this chapter actually spawns. */
    get spawnedLandmarkIds(): ReadonlySet<string> {
        const ids = new Set<string>();
        if (!this.chapter_) return ids;
        for (const wp of this.chapter_.waypoints) ids.add(wp.landmarkId);
        return ids;
    }

    /** Query role for a landmark ID, or null if it isn't in this chapter. */
    landmarkRoleFor(landmarkId: string): 'waypoint' | 'primary' | null {
        if (!this.chapter_) return null;
        // If the same landmark is used by multiple waypoints (e.g. a return
        // visit), the "highest" role wins: primary beats waypoint.
        let best: 'waypoint' | 'primary' | null = null;
        for (const wp of this.chapter_.waypoints) {
            if (wp.landmarkId !== landmarkId) continue;
            if (wp.role === 'primary') return 'primary';
            best = 'waypoint';
        }
        return best;
    }

    // ---------------------------------------------------------------------
    // Phase transitions
    // ---------------------------------------------------------------------

    beginAttract(): void {
        this.setPhase_('attract');
        this.elderVoice.stop();
    }

    beginWelcome(): void {
        if (!this.chapter_) return;
        this.setPhase_('welcome');
        this.elderVoice.enqueue(this.chapter_.welcomeLines);
    }

    beginHub(): void {
        if (!this.chapter_) return;
        this.setPhase_('hub');
        this.elderVoice.enqueue(this.chapter_.hubLines);
    }

    beginWalking(): void {
        if (!this.chapter_) return;
        this.setPhase_('walking');
        const wp = this.activeWaypoint;
        if (wp) {
            this.emit(CHAPTER_EVENTS.WAYPOINT_ACTIVE, wp);
        }
    }

    /**
     * GameScene calls this when Player enters the NEAR range of a landmark.
     * The system checks whether this landmark belongs to the active waypoint
     * and, if so, advances the chapter state.
     */
    onWaypointNear(landmarkId: string): void {
        if (this.phase_ !== 'walking') return;
        const wp = this.activeWaypoint;
        if (!wp || wp.landmarkId !== landmarkId) return;
        if (this.arrivedWaypointIds_.has(wp.id)) return;
        this.arrivedWaypointIds_.add(wp.id);
        this.emit(CHAPTER_EVENTS.WAYPOINT_ARRIVED, wp);
        this.elderVoice.enqueue(wp.elderLinesOnArrival);
    }

    /**
     * Called after the player has read the StoryCard for a primary waypoint,
     * or immediately after the elder lines finish for a non-primary one.
     * Advances to the next waypoint, or to the close phase if this was the
     * last one.
     */
    advanceWaypoint(): void {
        if (!this.chapter_) return;
        const next = this.activeWaypointIndex_ + 1;
        if (next >= this.chapter_.waypoints.length) {
            this.beginClose();
            return;
        }
        this.activeWaypointIndex_ = next;
        const wp = this.activeWaypoint;
        if (wp) {
            this.emit(CHAPTER_EVENTS.WAYPOINT_ACTIVE, wp);
        }
    }

    beginClose(): void {
        if (!this.chapter_) return;
        this.setPhase_('close');
        this.pendingFarewellAfterQueue_ = true;
        this.elderVoice.enqueue(this.chapter_.closeLines);
    }

    beginFarewell(): void {
        if (!this.chapter_) return;
        this.setPhase_('farewell');
        this.pendingFarewellAfterQueue_ = false;
        this.elderVoice.enqueue(this.chapter_.farewellLines);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    private setPhase_(phase: ChapterPhase): void {
        if (this.phase_ === phase) return;
        this.phase_ = phase;
        this.emit(CHAPTER_EVENTS.PHASE_CHANGED, phase);
    }

    private wireElderVoice_(): void {
        this.elderVoice.on(ELDER_VOICE_EVENTS.LINE_START, (line: ElderLine) => {
            this.emit(CHAPTER_EVENTS.ELDER_LINE_START, line);
        });
        this.elderVoice.on(ELDER_VOICE_EVENTS.LINE_END, (line: ElderLine) => {
            this.emit(CHAPTER_EVENTS.ELDER_LINE_END, line);
        });
        this.elderVoice.on(ELDER_VOICE_EVENTS.QUEUE_COMPLETE, () => {
            this.handleQueueComplete_();
        });
    }

    private handleQueueComplete_(): void {
        switch (this.phase_) {
            case 'welcome':
                // After the welcome lines, drop into the hub monologue.
                this.beginHub();
                break;
            case 'hub':
                // After the hub monologue, player is free to walk.
                this.beginWalking();
                break;
            case 'walking': {
                // If the elder just finished the lines for a non-primary
                // waypoint, advance to the next waypoint automatically.
                // For primary waypoints the player must press E and close
                // the StoryCard first; that path calls advanceWaypoint()
                // directly from GameScene.
                const wp = this.activeWaypoint;
                if (wp && wp.role === 'waypoint' && this.arrivedWaypointIds_.has(wp.id)) {
                    this.advanceWaypoint();
                }
                break;
            }
            case 'close':
                if (this.pendingFarewellAfterQueue_) {
                    this.pendingFarewellAfterQueue_ = false;
                    this.beginFarewell();
                }
                break;
            case 'farewell':
                this.emit(CHAPTER_EVENTS.CHAPTER_COMPLETE, this.chapter_);
                break;
            default:
                break;
        }
    }
}

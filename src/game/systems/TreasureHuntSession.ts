import type { LandmarkData, Region } from '../types';

export interface TreasureHuntProgress {
    foundCount: number;
    totalCount: number;
}

export interface ClueUpdatePayload {
    index: number;
    total: number;
    clueText: string;
    targetId: string | null;
    targetName: string;
    isComplete: boolean;
}

/**
 * Authoritative state for a single randomized treasure-hunt playthrough.
 *
 * Given the full landmark pool and a target region, picks LANDMARK_COUNT
 * entries at random, then picks an independent random permutation of that
 * subset as the clue order. Both are deterministic under a seeded RNG so
 * tests can pin the outcome; production defaults to Math.random.
 *
 * All mutation is encapsulated: the only way to advance the chain is
 * advance(); the only way to mark a teaser is markTeased(). The class holds
 * no references to Phaser — callers listen to their own events.
 */
export class TreasureHuntSession {
    static readonly LANDMARK_COUNT = 10;

    readonly region: Region;
    private readonly selection_: ReadonlyArray<LandmarkData>;
    private readonly clueOrder_: ReadonlyArray<string>;
    private currentIndex_ = 0;
    private readonly teasedIds_: Set<string> = new Set();

    private constructor(
        region: Region,
        selection: ReadonlyArray<LandmarkData>,
        clueOrder: ReadonlyArray<string>,
    ) {
        this.region = region;
        this.selection_ = selection;
        this.clueOrder_ = clueOrder;
    }

    /**
     * Build a new session. `pool` is the full landmark list (any regions);
     * it is filtered to `region` before selection. Falls back gracefully if
     * the region has fewer than LANDMARK_COUNT entries (everything available
     * is used, in a random order).
     */
    static create(
        region: Region,
        pool: ReadonlyArray<LandmarkData>,
        rng: () => number = Math.random,
    ): TreasureHuntSession {
        const available = pool.filter(l => l.region === region);

        if (available.length <= TreasureHuntSession.LANDMARK_COUNT) {
            const ordered = TreasureHuntSession.shuffle(available, rng);
            const clueOrder = TreasureHuntSession.shuffle(ordered, rng).map(l => l.id);
            return new TreasureHuntSession(region, ordered, clueOrder);
        }

        const shuffled = TreasureHuntSession.shuffle(available, rng);
        const selection = shuffled.slice(0, TreasureHuntSession.LANDMARK_COUNT);
        const clueOrder = TreasureHuntSession.shuffle(selection, rng).map(l => l.id);
        return new TreasureHuntSession(region, selection, clueOrder);
    }

    private static shuffle<T>(arr: ReadonlyArray<T>, rng: () => number): T[] {
        // Fisher-Yates on a fresh copy — the input array is never mutated,
        // the returned array is a brand-new allocation the caller owns.
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = out[i];
            out[i] = out[j];
            out[j] = tmp;
        }
        return out;
    }

    getSelection(): ReadonlyArray<LandmarkData> {
        return this.selection_;
    }

    getClueOrder(): ReadonlyArray<string> {
        return this.clueOrder_;
    }

    getCurrentTargetId(): string | null {
        if (this.isComplete()) return null;
        return this.clueOrder_[this.currentIndex_];
    }

    getCurrentTarget(): LandmarkData | null {
        const id = this.getCurrentTargetId();
        if (!id) return null;
        return this.selection_.find(l => l.id === id) ?? null;
    }

    getCurrentClueText(): string {
        const target = this.getCurrentTarget();
        return target?.clueText ?? '';
    }

    getCurrentClueIndex(): number {
        return this.currentIndex_;
    }

    getProgress(): TreasureHuntProgress {
        return {
            foundCount: this.currentIndex_,
            totalCount: this.clueOrder_.length,
        };
    }

    buildCluePayload(): ClueUpdatePayload {
        const target = this.getCurrentTarget();
        return {
            index: this.currentIndex_,
            total: this.clueOrder_.length,
            clueText: target?.clueText ?? '',
            targetId: target?.id ?? null,
            targetName: target?.name ?? '',
            isComplete: this.isComplete(),
        };
    }

    isInSelection(id: string): boolean {
        return this.selection_.some(l => l.id === id);
    }

    isCurrentTarget(id: string): boolean {
        return this.getCurrentTargetId() === id;
    }

    hasBeenTeased(id: string): boolean {
        return this.teasedIds_.has(id);
    }

    markTeased(id: string): void {
        this.teasedIds_.add(id);
    }

    /**
     * Advance the clue chain after the player reads the current target.
     * Returns true if this advance completed the hunt, false if clues remain.
     */
    advance(): boolean {
        if (this.isComplete()) return true;
        this.currentIndex_ += 1;
        return this.isComplete();
    }

    isComplete(): boolean {
        return this.currentIndex_ >= this.clueOrder_.length;
    }

    /**
     * Landmarks visited so far, in the order the player read them. Used by
     * the completion overlay to list the journey the player just walked.
     */
    getVisitedInOrder(): LandmarkData[] {
        const visited: LandmarkData[] = [];
        for (let i = 0; i < this.currentIndex_; i++) {
            const id = this.clueOrder_[i];
            const lm = this.selection_.find(l => l.id === id);
            if (lm) visited.push(lm);
        }
        return visited;
    }
}
